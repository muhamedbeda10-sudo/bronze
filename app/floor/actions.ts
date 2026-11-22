"use server";

import { prisma } from "@/lib/db";
import { actionUser } from "@/lib/server/auth";
import { fail, type ActionResult } from "@/lib/server/result";
import { applyStageAction, userMessage } from "@/lib/server/workOrders";
import { loadFlow, recordOutput } from "@/lib/server/flow";
import { recordActivity } from "@/app/(app)/workshop/actions";
import { canConfirmStage, parseScan } from "@/lib/domain/floor";

/** Load the order and check this person may confirm its current stage. */
async function guard(id: number) {
  const user = await actionUser("workshop", "E");
  if (typeof user === "string") return { error: user };
  const wo = await prisma.workOrder.findUnique({ where: { id }, include: { stages: { orderBy: { seq: "asc" } } } });
  if (!wo) return { error: "The order no longer exists." };
  // a supervisor reports on their own workshop's pieces of the order, wherever the rest stands
  const { flow } = await prisma.$transaction((tx) => loadFlow(tx, id));
  const mine = user.workshopId ? flow.find((f) => f.workshopId === user.workshopId && f.waiting > 0 && !f.qcRequired) : null;
  const st = mine ? wo.stages.find((s) => s.seq === mine.seq) : wo.stageIndex === null ? wo.stages[0] : wo.stages[wo.stageIndex];
  if (!st) return { error: "The order has no route." };
  if (!canConfirmStage(user.access, user.workshopId, st.workshopId, st.qcRequired)) return { error: st.qcRequired ? "This is a quality stage — Quality passes it." : `${st.name} is not your workshop's stage.` };
  return { user, wo, st };
}

export async function kioskStart(id: number, version: number): Promise<ActionResult> {
  const g = await guard(id);
  if ("error" in g) return fail(g.error!);
  try {
    await applyStageAction(id, version, "START", g.user);
    return { ok: true, message: `${g.st.name} started.` };
  } catch (e) {
    return fail(userMessage(e, "start the stage"));
  }
}

/**
 * The supervisor's report: what was made on this stage (an activity record),
 * and — when the stage is finished — the order moved to its next stage.
 */
export async function kioskReport(id: number, version: number, raw: Record<string, unknown>, finish: boolean): Promise<ActionResult> {
  const g = await guard(id);
  if ("error" in g) return fail(g.error!);
  if (g.wo.stageIndex === null) return fail("Start the stage first.");
  if (g.wo.version !== version) return fail("Someone moved the order meanwhile — check its stage and report again.");
  // the good and scrap pieces move on the route at this stage (pieces ledger)
  const rec = await recordActivity({ ...raw, workOrderId: String(id), workshopId: String(g.st.workshopId ?? raw.workshopId ?? ""), stageSeq: String(g.st.seq), source: "kiosk", taskStatus: finish ? "COMPLETE" : "UNDER_PROCESS", priority: String(g.wo.priority) });
  if (!rec.ok) return rec;
  if (!finish) return rec;
  try {
    // finish: whatever is still waiting at this stage is done as well
    const { flow } = await prisma.$transaction((tx) => loadFlow(tx, id));
    const left = flow.find((f) => f.seq === g.st.seq)?.waiting ?? 0;
    if (left <= 0) return { ok: true, message: `${rec.message ?? "Output recorded."} Nothing is left at ${g.st.name}.` };
    const r = await recordOutput(id, { seq: g.st.seq, good: left, scrap: 0, source: "kiosk", note: "Finished at the shop-floor kiosk" }, g.user);
    return { ok: true, message: r.completed ? "Order completed — into FG stock." : r.status === "UNDER_INSPECTION" ? "Stage finished — the pieces are waiting for inspection." : `Stage finished — the pieces moved on to ${r.stage ?? "the next stage"}.` };
  } catch (e) {
    return fail(`Output recorded, but the stage was not finished: ${userMessage(e, "finish the stage")}`);
  }
}

/** A typed or scanned order: open it. */
export async function kioskFind(raw: string): Promise<ActionResult<number>> {
  const user = await actionUser("workshop", "E");
  if (typeof user === "string") return fail(user);
  const p = parseScan(raw);
  if (!p) return fail("Type the order like 14444-1, or scan its traveler.");
  const wo = "id" in p ? await prisma.workOrder.findUnique({ where: { id: p.id } }) : await prisma.workOrder.findFirst({ where: { woNo: { equals: p.woNo, mode: "insensitive" }, lineNo: p.lineNo } });
  if (!wo) return fail("No such order.");
  return { ok: true, data: wo.id };
}
