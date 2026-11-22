import "server-only";
import { prisma, type Tx } from "@/lib/db";
import { audit } from "./audit";
import type { SessionUser } from "./auth";
import { getSettings } from "./settings";
import { notifyRole } from "./notify";
import { STALE } from "./result";
import { UserError } from "./errors";
import { loadFlow, lockOrder, syncOrder, writeOutput, type OutputSource } from "./flow";
import { calcWeights, dimensionText, fullName } from "@/lib/domain/weight";
import { ACTION_LABEL, stageNameAt, transition, type StageAction, type WoState } from "@/lib/domain/routing";
import type { WoLineInput, WoInput } from "@/lib/domain/workOrder";
import type { WoStatus } from "@/lib/domain/status";

type Actor = Pick<SessionUser, "id" | "name">;

export { UserError };

/** The weights, name and route of one line, worked out from master data. */
async function lineFacts(tx: Tx, woNo: string, lineNo: number, lineCount: number, l: WoLineInput, allowancePct: number, defaultDensity: number) {
  const [product, material, process, mold] = await Promise.all([
    tx.product.findUnique({ where: { id: l.productId } }),
    tx.material.findUnique({ where: { id: l.materialId } }),
    tx.process.findUnique({ where: { id: l.processId } }),
    l.moldId ? tx.mold.findUnique({ where: { id: l.moldId } }) : Promise.resolve(null),
  ]);
  const n = `Line ${lineNo}`;
  if (!product) throw new UserError(`${n}: the product no longer exists.`);
  if (!material) throw new UserError(`${n}: the material no longer exists.`);
  if (!process) throw new UserError(`${n}: the process no longer exists.`);
  if (l.moldId && !mold) throw new UserError(`${n}: the mold no longer exists.`);
  const stages = await tx.routeStage.findMany({ where: { routeCode: process.routeCode }, orderBy: { stageNo: "asc" } });
  if (!stages.length) throw new UserError(`${n}: process ${process.code} has no route — add the stages of ${process.routeCode} in Master Data → Routing Master.`);
  const w = calcWeights({
    format: product.dimensionFormat,
    od: l.od,
    innerDia: l.innerDia,
    length: l.length,
    width: l.width,
    height: l.height,
    qty: l.qty,
    density: material.density > 0 ? material.density : defaultDensity,
    allowancePct,
    moldPieceKg: mold?.approxWeightKg ?? null,
  });
  const name = fullName({ woNo, lineNo, lineCount, product: product.name, material: material.name, dims: dimensionText(product.dimensionFormat, l), qty: l.qty });
  return { w, name, stages };
}

/** Save a new order: one WorkOrder per line, each with its own copy of its route. */
export async function createWorkOrder(input: WoInput, user: Actor): Promise<number[]> {
  const settings = await getSettings();
  return prisma.$transaction(async (tx) => {
    const exists = await tx.workOrder.findFirst({ where: { woNo: input.woNo } });
    if (exists) throw new UserError(`Work order ${input.woNo} already exists — open it from Open Work Orders, or use another number.`);
    const ids: number[] = [];
    const count = input.lines.length;
    for (let i = 0; i < count; i++) {
      const l = input.lines[i]!;
      const lineNo = i + 1;
      const { w, name, stages } = await lineFacts(tx, input.woNo, lineNo, count, l, settings.rawAllowancePct, settings.defaultDensity);
      const wo = await tx.workOrder.create({
        data: {
          woNo: input.woNo,
          lineNo,
          lineCount: count,
          woDate: input.woDate,
          ...l,
          densityUsed: w.densityUsed,
          unitWeightKg: w.unitKg,
          totalWeightKg: w.totalKg ?? w.moldKg,
          rawReqKg: w.rawReqKg,
          moldWeightKg: w.moldKg,
          fullName: name,
          status: "PLANNED",
          createdById: user.id,
          stages: { create: stages.map((s, idx) => ({ seq: idx, name: s.name, workshopId: s.workshopId, stdTimeMin: s.stdTimeMin, qcRequired: s.qcRequired })) },
        },
      });
      if (l.moldId) await tx.mold.update({ where: { id: l.moldId }, data: { usageCount: { increment: 1 } } });
      ids.push(wo.id);
      await audit(tx, user, "create", "WorkOrder", wo.id, `Created ${name}`, null, wo);
    }
    return ids;
  });
}

/** Change a line: weights and name worked out again; a new process re-copies the route, only before release. */
export async function updateWorkOrderLine(id: number, version: number, l: WoLineInput, user: Actor): Promise<void> {
  const settings = await getSettings();
  await prisma.$transaction(async (tx) => {
    const before = await tx.workOrder.findUnique({ where: { id } });
    if (!before) throw new UserError("The order no longer exists.");
    if (before.version !== version) throw new UserError(STALE);
    if (before.status === "COMPLETED" || before.status === "CANCELLED") throw new UserError("A closed order cannot be edited.");
    if (before.processId !== l.processId && before.stageIndex !== null) throw new UserError("The process cannot change once production has started — its route is already running.");
    if (before.woDate && l.dueDate && l.dueDate < before.woDate) throw new UserError("The due date is before the WO date.");
    const { w, name, stages } = await lineFacts(tx, before.woNo, before.lineNo, before.lineCount, l, settings.rawAllowancePct, settings.defaultDensity);
    const res = await tx.workOrder.updateMany({
      where: { id, version },
      data: {
        ...l,
        densityUsed: w.densityUsed,
        unitWeightKg: w.unitKg,
        totalWeightKg: w.totalKg ?? w.moldKg,
        rawReqKg: w.rawReqKg,
        moldWeightKg: w.moldKg,
        fullName: name,
        version: { increment: 1 },
      },
    });
    if (res.count !== 1) throw new UserError(STALE);
    if (before.processId !== l.processId) {
      await tx.workOrderStage.deleteMany({ where: { workOrderId: id } });
      await tx.workOrderStage.createMany({ data: stages.map((s, idx) => ({ workOrderId: id, seq: idx, name: s.name, workshopId: s.workshopId, stdTimeMin: s.stdTimeMin, qcRequired: s.qcRequired })) });
    }
    const after = await tx.workOrder.findUnique({ where: { id } });
    await audit(tx, user, "update", "WorkOrder", id, `Edited ${name}`, before, after);
  });
}

export interface QcDetail {
  qtyInspected: number;
  qtyRejected: number;
  reasonId: number | null;
}

/** The buttons that move pieces — they write the ledger, and the order's state follows it. */
const QTY_ACTIONS: readonly StageAction[] = ["NEXT", "PREV", "QC_PASS", "QC_REJECT_LAST", "QC_REJECT_START"];

/**
 * Next / Prev / Pass / Reject as quantities: Next finishes every piece waiting
 * at the current stage, Prev sends them back one stage, Pass finishes the
 * pieces waiting at the quality stage (the rejected ones as scrap), Reject
 * sends them back to be made again.
 */
async function qtyAction(tx: Tx, id: number, action: StageAction, user: Actor, opts: { note?: string | null; qc?: QcDetail; source?: OutputSource }): Promise<{ completed: boolean; toStatus: WoStatus }> {
  const loaded = await loadFlow(tx, id);
  const { wo, flow } = loaded;
  const before = flow.map((f) => ({ ...f }));
  const source: OutputSource = opts.source ?? (action.startsWith("QC_") ? "qc" : "planning");
  if (action === "NEXT" || action === "PREV") {
    const stages = wo.stages.map((s) => ({ name: s.name, qcRequired: s.qcRequired }));
    const t = transition({ status: wo.status as WoStatus, stageIndex: wo.stageIndex, stageState: wo.stageState as WoState["stageState"], heldFrom: wo.heldFrom as WoStatus | null }, action, stages);
    if (!t.ok) throw new UserError(t.error);
    const cur = flow[wo.stageIndex!]!;
    if (cur.waiting <= 0) throw new UserError(`No pieces are waiting at ${cur.name}.`);
    if (action === "NEXT") await writeOutput(tx, loaded, { seq: cur.seq, good: cur.waiting, scrap: 0, source, note: opts.note }, user);
    else await writeOutput(tx, loaded, { seq: flow[wo.stageIndex! - 1]!.seq, good: -cur.waiting, scrap: 0, source, note: opts.note ?? `Sent back from ${cur.name}` }, user);
    const r = await syncOrder(tx, id, user, before, { action, note: opts.note });
    await audit(tx, user, "stage", "WorkOrder", id, `${wo.woNo}-${wo.lineNo}: ${ACTION_LABEL[action]} — ${cur.waiting} pcs (${cur.name} → ${r.stage ?? "—"})`, { status: wo.status, stage: cur.name }, { status: r.status, stage: r.stage });
    return { completed: r.completed, toStatus: r.status };
  }
  // quality: the first quality stage holding pieces
  if (["CANCELLED", "COMPLETED", "ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"].includes(wo.status)) throw new UserError(wo.status === "CANCELLED" || wo.status === "COMPLETED" ? "The order is closed." : "Resume the order first.");
  const qi = flow.findIndex((f) => f.qcRequired && f.waiting > 0);
  if (qi < 0) throw new UserError("No pieces of this order are waiting for inspection.");
  const q = flow[qi]!;
  const qc = opts.qc;
  if (!qc) throw new UserError("Enter the inspected quantity.");
  if (qc.qtyInspected < 1 || qc.qtyInspected > q.waiting) throw new UserError(`The inspected quantity must be between 1 and the ${q.waiting} pieces waiting.`);
  if (qc.qtyRejected < 0 || qc.qtyRejected > qc.qtyInspected) throw new UserError("The rejected quantity must be between 0 and the inspected quantity.");
  if (action !== "QC_PASS" && !qc.reasonId) throw new UserError("Choose the rejection reason — it feeds the scrap analysis.");
  if (action === "QC_PASS" && qc.qtyRejected > 0 && !qc.reasonId) throw new UserError("Choose the rejection reason — it feeds the scrap analysis.");
  let toName: string | null;
  let r: Awaited<ReturnType<typeof syncOrder>>;
  if (action === "QC_PASS") {
    // what was inspected leaves the stage: passed on, the rejected pieces scrapped
    await writeOutput(tx, loaded, { seq: q.seq, good: qc.qtyInspected - qc.qtyRejected, scrap: qc.qtyRejected, reasonId: qc.reasonId, source, note: opts.note, inspection: false }, user);
    r = await syncOrder(tx, id, user, before, { action, note: opts.note });
    toName = r.stage;
  } else {
    // the rejected pieces go back to be made again from the stage before (or the first)
    const to = action === "QC_REJECT_START" ? 0 : Math.max(0, qi - 1);
    for (let k = qi - 1; k >= to; k--) await writeOutput(tx, loaded, { seq: flow[k]!.seq, good: -qc.qtyRejected, scrap: 0, source, note: `${ACTION_LABEL[action]} from ${q.name}${opts.note ? ` — ${opts.note}` : ""}` }, user);
    r = await syncOrder(tx, id, user, before, { action, note: opts.note, forceStatus: "REWORK" });
    toName = flow[to]!.name;
  }
  await tx.workOrder.update({ where: { id }, data: { qualityStatus: action === "QC_PASS" ? "Passed" : "Rejected" } });
  await tx.inspection.create({
    data: {
      workOrderId: id,
      stageName: q.name,
      result: action === "QC_PASS" ? "PASS" : action === "QC_REJECT_LAST" ? "REJECT_LAST" : "REJECT_START",
      qtyInspected: qc.qtyInspected,
      qtyRejected: qc.qtyRejected,
      rejectionReasonId: qc.reasonId,
      inspectorId: user.id,
      inspectorName: user.name,
      notes: opts.note?.slice(0, 500) || null,
    },
  });
  const code = `${wo.woNo}-${wo.lineNo}`;
  if (action !== "QC_PASS") await notifyRole(tx, "planning", "F", { kind: "rejection", title: `${code}: ${qc.qtyRejected} pcs rejected at ${q.name} — back to ${toName}`, body: opts.note ?? null, link: `/work-orders/${id}` }, user.id);
  await audit(tx, user, "stage", "WorkOrder", id, `${code}: ${ACTION_LABEL[action]} at ${q.name} — inspected ${qc.qtyInspected}, rejected ${qc.qtyRejected}${action !== "QC_PASS" ? ` (back to ${toName})` : ""}`, { status: wo.status, stage: q.name }, { status: r.status, stage: r.stage });
  return { completed: r.completed, toStatus: r.status };
}

/**
 * Move an order along its route (Planning and Quality). The version the
 * screen was drawn on must still be current — two people clicking at once
 * cannot move it twice.
 */
export async function applyStageAction(id: number, version: number, action: StageAction, user: Actor, opts: { note?: string | null; qc?: QcDetail; source?: OutputSource } = {}): Promise<{ completed: boolean; toStatus: WoStatus }> {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, id);
    const wo = await tx.workOrder.findUnique({ where: { id }, include: { stages: { orderBy: { seq: "asc" } } } });
    if (!wo) throw new UserError("The order no longer exists.");
    if (wo.version !== version) throw new UserError(STALE);
    if (!wo.stages.length) throw new UserError("This order has no route — set up its process's routing in Master Data.");
    if (QTY_ACTIONS.includes(action)) return qtyAction(tx, id, action, user, opts);
    const stages = wo.stages.map((s) => ({ name: s.name, qcRequired: s.qcRequired }));
    const state: WoState = { status: wo.status as WoStatus, stageIndex: wo.stageIndex, stageState: wo.stageState as WoState["stageState"], heldFrom: wo.heldFrom as WoStatus | null };
    const t = transition(state, action, stages);
    if (!t.ok) throw new UserError(t.error);
    // Start, Rework, Hold / Waiting, Resume, Cancel: the order's label only — no piece moves
    const now = new Date();
    const res = await tx.workOrder.updateMany({
      where: { id, version },
      data: {
        status: t.state.status,
        stageIndex: t.state.stageIndex,
        stageState: t.state.stageState,
        heldFrom: t.state.heldFrom,
        version: { increment: 1 },
        ...(action === "START" && !wo.startedAt ? { startedAt: now } : {}),
      },
    });
    if (res.count !== 1) throw new UserError(STALE);
    const fromStage = stageNameAt(stages, wo.stageIndex);
    const toStage = stageNameAt(stages, t.state.stageIndex);
    await tx.stageMove.create({
      data: { workOrderId: id, userId: user.id, userName: user.name, action, fromStage, toStage, fromStatus: wo.status, toStatus: t.state.status, note: opts.note?.slice(0, 500) || null },
    });
    if (t.state.status === "UNDER_INSPECTION" && wo.status !== "UNDER_INSPECTION") {
      await notifyRole(tx, "quality", "F", { kind: "inspection", title: `${wo.woNo}-${wo.lineNo} is waiting for inspection`, body: toStage, link: "/quality" }, user.id);
    }
    await audit(tx, user, "stage", "WorkOrder", id, `${wo.woNo}-${wo.lineNo}: ${ACTION_LABEL[action]}${fromStage ? ` (${fromStage} → ${toStage ?? "—"})` : ""}`, { status: wo.status, stage: fromStage }, { status: t.state.status, stage: toStage });
    return { completed: false, toStatus: t.state.status };
  });
}

/** A failure a person can act on, or a plain one (logged). */
export function userMessage(e: unknown, what: string): string {
  if (e instanceof UserError) return e.message;
  const code = (e as { code?: string })?.code;
  if (code === "P2002") return "That work order number is already used.";
  console.error(`[${what}]`, e);
  return `Could not ${what} — try again, or tell the admin if it keeps failing.`;
}
