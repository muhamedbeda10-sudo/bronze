"use server";

import { prisma } from "@/lib/db";
import { actionUser } from "@/lib/server/auth";
import { fail, type ActionResult } from "@/lib/server/result";
import { applyStageAction, userMessage } from "@/lib/server/workOrders";
import { recordActivity } from "@/app/(app)/workshop/actions";
import { canConfirmStage, parseScan } from "@/lib/domain/floor";

/** Load the order and check this person may confirm its current stage. */
async function guard(id: number) {
  const user = await actionUser("workshop", "E");
  if (typeof user === "string") return { error: user };
  const wo = await prisma.workOrder.findUnique({ where: { id }, include: { stages: { orderBy: { seq: "asc" } } } });
  if (!wo) return { error: "The order no longer exists." };
  const st = wo.stageIndex === null ? wo.stages[0] : wo.stages[wo.stageIndex];
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
  const rec = await recordActivity({ ...raw, workOrderId: String(id), workshopId: String(g.st.workshopId ?? raw.workshopId ?? ""), taskStatus: finish ? "COMPLETE" : "UNDER_PROCESS", priority: String(g.wo.priority) });
  if (!rec.ok) return rec;
  if (!finish) return { ok: true, message: "Output recorded." };
  try {
    const fresh = await prisma.workOrder.findUniqueOrThrow({ where: { id }, select: { version: true } });
    if (fresh.version !== version) return fail("Output recorded, but someone moved the order meanwhile — check its stage before finishing it.");
    const r = await applyStageAction(id, version, "NEXT", g.user, { note: "Finished at the shop-floor kiosk" });
    return { ok: true, message: r.completed ? "Order completed — into FG stock." : r.toStatus === "UNDER_INSPECTION" ? "Stage finished — the order is waiting for inspection." : "Stage finished — the order moved to its next stage." };
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
