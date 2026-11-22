import "server-only";
import { prisma, type Tx } from "@/lib/db";
import { audit } from "./audit";
import type { SessionUser } from "./auth";
import { notifyRole } from "./notify";
import { UserError } from "./errors";
import { checkOutput, flowOf, statusAfter, summarize, type StageFlow } from "@/lib/domain/flow";
import { today } from "@/lib/domain/dates";
import type { WoStatus } from "@/lib/domain/status";

// The pieces ledger on the server: every record goes through recordOutput (or,
// for the Planning and Quality buttons, writeOutput + syncOrder inside
// applyStageAction), so the checks, the FG stock and the order's state stay one.

type Actor = Pick<SessionUser, "id" | "name">;

export const OUTPUT_SOURCES = ["tracker", "floor", "activity", "kiosk", "planning", "qc", "backfill"] as const;
export type OutputSource = (typeof OUTPUT_SOURCES)[number];

const PAUSED: readonly string[] = ["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"];

/** One order at a time: two people recording on it wait for each other. */
export async function lockOrder(tx: Tx, id: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "WorkOrder" WHERE id = ${id} FOR UPDATE`;
}

export async function loadFlow(tx: Tx, id: number) {
  const wo = await tx.workOrder.findUnique({ where: { id }, include: { stages: { orderBy: { seq: "asc" } }, outputs: { select: { seq: true, good: true, scrap: true } } } });
  if (!wo) throw new UserError("The order no longer exists.");
  const flow = flowOf(wo.qty, wo.stages.map((s) => ({ seq: s.seq, name: s.name, workshopId: s.workshopId, qcRequired: s.qcRequired })), wo.outputs);
  return { wo, flow };
}
type Loaded = Awaited<ReturnType<typeof loadFlow>>;

/** Why this order takes no record now, or null. */
export function closedReason(wo: { status: string; stageIndex: number | null }): string | null {
  if (wo.status === "CANCELLED") return "The order is cancelled.";
  if (wo.status === "COMPLETED") return "The order is already completed.";
  if (PAUSED.includes(wo.status)) return "The order is paused — resume it first.";
  if (wo.status === "PLANNED" && wo.stageIndex === null) return "The order is not released yet — start its first stage on the Execution Board.";
  return null;
}

export interface OutputInput {
  seq: number;
  good: number;
  scrap: number;
  reasonId?: number | null;
  date?: Date;
  note?: string | null;
  source: OutputSource;
  activityId?: number | null;
  /** a quality stage's record also writes an inspection (false when the caller writes its own) */
  inspection?: boolean;
}

/** The finished pieces go into (or come back out of) the order's FG stock row. */
async function fgDelta(tx: Tx, wo: Loaded["wo"], delta: number, user: Actor): Promise<void> {
  if (!delta) return;
  const ref = `${wo.woNo}-${wo.lineNo}`;
  const row = await tx.stockRow.findFirst({ where: { kind: "FG", workOrderId: wo.id }, orderBy: { id: "asc" } });
  if (!row) {
    if (delta < 0) throw new UserError("Those finished pieces are no longer in FG stock — they cannot be taken back.");
    const r = await tx.stockRow.create({ data: { kind: "FG", materialId: wo.materialId, productId: wo.productId, workOrderId: wo.id, description: wo.fullName, od: wo.od, innerDia: wo.innerDia, length: wo.length, unit: "pcs", totalQty: delta } });
    await tx.stockMove.create({ data: { stockRowId: r.id, delta, reason: "WO_COMPLETE", ref, userName: user.name } });
    return;
  }
  if (row.totalQty + delta < row.reservedQty || row.totalQty + delta < 0) throw new UserError(`Only ${Math.max(0, row.totalQty - row.reservedQty)} of the order's finished pieces are free in FG stock — they cannot be taken back.`);
  await tx.stockRow.update({ where: { id: row.id }, data: { totalQty: { increment: delta }, version: { increment: 1 } } });
  await tx.stockMove.create({ data: { stockRowId: row.id, delta, reason: "WO_COMPLETE", ref, userName: user.name } });
}

/** Write one checked row of the ledger (the order's state is synced by syncOrder). */
export async function writeOutput(tx: Tx, loaded: Loaded, rec: OutputInput, user: Actor): Promise<StageFlow> {
  const { wo, flow } = loaded;
  const err = checkOutput(flow, rec.seq, rec.good, rec.scrap);
  if (err) throw new UserError(err);
  if (rec.scrap > 0 && !rec.reasonId) throw new UserError("Choose the rejection reason for the scrap — it feeds the scrap analysis.");
  const stage = flow.find((f) => f.seq === rec.seq)!;
  await tx.stageOutput.create({
    data: {
      workOrderId: wo.id,
      seq: rec.seq,
      date: rec.date ?? today(),
      good: rec.good,
      scrap: rec.scrap,
      rejectionReasonId: rec.scrap > 0 ? (rec.reasonId ?? null) : null,
      source: rec.source,
      activityId: rec.activityId ?? null,
      userId: user.id,
      userName: user.name,
      note: rec.note?.slice(0, 500) || null,
    },
  });
  if (stage.seq === flow[flow.length - 1]!.seq) await fgDelta(tx, wo, rec.good, user);
  if (stage.qcRequired && rec.inspection !== false && rec.good + rec.scrap > 0) {
    await tx.inspection.create({ data: { workOrderId: wo.id, stageName: stage.name, result: "PASS", qtyInspected: rec.good + rec.scrap, qtyRejected: Math.max(0, rec.scrap), rejectionReasonId: rec.scrap > 0 ? (rec.reasonId ?? null) : null, inspectorId: user.id, inspectorName: user.name, notes: rec.note?.slice(0, 500) || null } });
  }
  // the loaded flow moves on with the row, for a second write in the same transaction
  stage.good += rec.good;
  stage.scrap += rec.scrap;
  const i = flow.indexOf(stage);
  for (let k = i; k < flow.length; k++) {
    const f = flow[k]!;
    if (k > i) f.arrived = flow[k - 1]!.good;
    f.waiting = f.arrived - f.good - f.scrap;
  }
  return stage;
}

const qcWaiting = (flow: StageFlow[]) => flow.reduce((a, f) => a + (f.qcRequired ? Math.max(0, f.waiting) : 0), 0);

/**
 * Bring the order's current stage and status in line with its ledger, log the
 * move when they change, and tell Quality / Planning what needs them.
 */
export async function syncOrder(tx: Tx, id: number, user: Actor, before: StageFlow[], opts: { action?: string; note?: string | null; forceStatus?: WoStatus } = {}): Promise<{ completed: boolean; status: WoStatus; stage: string | null }> {
  const { wo, flow } = await loadFlow(tx, id);
  const s = summarize(flow, wo.qty);
  const prev = { status: wo.status as WoStatus, stageIndex: wo.stageIndex };
  const status = opts.forceStatus ?? statusAfter(prev, s, flow);
  const completed = status === "COMPLETED";
  const stageIndex = completed ? flow.length - 1 : (s.stageIndex ?? wo.stageIndex);
  const stageState = completed ? null : s.inProgress ? "IN_PROGRESS" : "WAITING";
  const now = new Date();
  await tx.workOrder.update({
    where: { id },
    data: {
      status,
      stageIndex,
      stageState,
      version: { increment: 1 },
      ...(s.started && !wo.startedAt ? { startedAt: now } : {}),
      ...(completed && wo.status !== "COMPLETED" ? { completedAt: now } : {}),
    },
  });
  const fromStage = wo.stageIndex !== null ? (wo.stages[wo.stageIndex]?.name ?? null) : null;
  const toStage = completed ? "Complete" : stageIndex !== null ? (wo.stages[stageIndex]?.name ?? null) : null;
  const code = `${wo.woNo}-${wo.lineNo}`;
  if (opts.action || status !== wo.status || stageIndex !== wo.stageIndex) {
    await tx.stageMove.create({ data: { workOrderId: id, userId: user.id, userName: user.name, action: completed && wo.status !== "COMPLETED" ? "COMPLETE" : (opts.action ?? "OUTPUT"), fromStage, toStage, fromStatus: wo.status, toStatus: status, note: opts.note?.slice(0, 500) || null } });
  }
  const qcNow = qcWaiting(flow);
  const qcBefore = qcWaiting(before);
  if (qcNow > qcBefore) {
    const at = flow.find((f) => f.qcRequired && f.waiting > 0)?.name ?? "Quality";
    await notifyRole(tx, "quality", "F", { kind: "inspection", title: `${code}: ${qcNow - qcBefore} pc${qcNow - qcBefore === 1 ? "" : "s"} waiting for inspection`, body: `${at} · ${qcNow} waiting in all`, link: "/quality" }, user.id);
  }
  if (completed && wo.status !== "COMPLETED") {
    await notifyRole(tx, "planning", "F", { kind: "completed", title: `${code} is complete — ${s.finished} pcs into FG stock`, link: `/work-orders/${id}` }, user.id);
  }
  return { completed, status, stage: toStage };
}

/**
 * Record pieces finished (or taken back) at one stage of an order — the Plan
 * Tracker, the workshop floor and the activity log all come here.
 */
export async function recordOutput(woId: number, rec: OutputInput, user: Actor, outer?: Tx): Promise<{ completed: boolean; status: WoStatus; stage: string | null }> {
  const run = async (tx: Tx) => {
    await lockOrder(tx, woId);
    const loaded = await loadFlow(tx, woId);
    const why = closedReason(loaded.wo);
    if (why) throw new UserError(why);
    const before = loaded.flow.map((f) => ({ ...f }));
    const stage = await writeOutput(tx, loaded, rec, user);
    const r = await syncOrder(tx, woId, user, before);
    const parts = [rec.good ? `${rec.good > 0 ? "" : "took back "}${Math.abs(rec.good)} good` : "", rec.scrap ? `${Math.abs(rec.scrap)} scrap${rec.scrap < 0 ? " taken back" : ""}` : ""].filter(Boolean).join(", ");
    await audit(tx, user, "output", "WorkOrder", woId, `${loaded.wo.woNo}-${loaded.wo.lineNo}: ${parts} at ${stage.name} (${rec.source})`, null, { seq: rec.seq, good: rec.good, scrap: rec.scrap, source: rec.source });
    return r;
  };
  return outer ? run(outer) : prisma.$transaction(run);
}

/** Take back the rows an activity record wrote (when the record is deleted). */
export async function reverseActivityOutputs(tx: Tx, activityId: number, user: Actor): Promise<void> {
  const rows = await tx.stageOutput.findMany({ where: { activityId } });
  const byOrder = new Map<number, typeof rows>();
  for (const r of rows) byOrder.set(r.workOrderId, [...(byOrder.get(r.workOrderId) ?? []), r]);
  for (const [woId, list] of byOrder) {
    await lockOrder(tx, woId);
    const loaded = await loadFlow(tx, woId);
    if (loaded.wo.status === "COMPLETED" || loaded.wo.status === "CANCELLED") throw new UserError(`Order ${loaded.wo.woNo}-${loaded.wo.lineNo} is closed — the pieces this record moved stay recorded.`);
    const before = loaded.flow.map((f) => ({ ...f }));
    for (const r of list) {
      const err = checkOutput(loaded.flow, r.seq, -r.good, -r.scrap);
      if (err) throw new UserError(`The record cannot be deleted: ${err}`);
      await tx.stageOutput.delete({ where: { id: r.id } });
      const stage = loaded.flow.find((f) => f.seq === r.seq)!;
      if (stage.seq === loaded.flow[loaded.flow.length - 1]!.seq) await fgDelta(tx, loaded.wo, -r.good, user);
      stage.good -= r.good;
      stage.scrap -= r.scrap;
      const i = loaded.flow.indexOf(stage);
      for (let k = i; k < loaded.flow.length; k++) {
        const f = loaded.flow[k]!;
        if (k > i) f.arrived = loaded.flow[k - 1]!.good;
        f.waiting = f.arrived - f.good - f.scrap;
      }
    }
    await syncOrder(tx, woId, user, before, { action: "OUTPUT", note: "Activity record deleted" });
  }
}
