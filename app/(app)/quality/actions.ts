"use server";

import { actionUser } from "@/lib/server/auth";
import { fail, type ActionResult } from "@/lib/server/result";
import { applyStageAction, userMessage } from "@/lib/server/workOrders";
import { ACTION_LABEL, type StageAction } from "@/lib/domain/routing";

const QC: readonly StageAction[] = ["QC_PASS", "QC_REJECT_LAST", "QC_REJECT_START"];

export async function qcDecision(id: number, version: number, action: string, qtyInspected: number, qtyRejected: number, reasonId: number | null, note: string): Promise<ActionResult> {
  const user = await actionUser("quality", "F");
  if (typeof user === "string") return fail(user);
  if (!QC.includes(action as StageAction)) return fail("Unknown decision.");
  if (!Number.isInteger(qtyInspected) || !Number.isInteger(qtyRejected)) return fail("Quantities are whole pieces.");
  if (qtyRejected > 0 && !reasonId) return fail("Choose the rejection reason — it feeds the scrap analysis.");
  try {
    const r = await applyStageAction(id, version, action as StageAction, user, { note, qc: { qtyInspected, qtyRejected, reasonId } });
    return { ok: true, message: r.completed ? "Passed — the order is complete and in FG stock." : `${ACTION_LABEL[action as StageAction]} recorded.` };
  } catch (e) {
    return fail(userMessage(e, "record the inspection"));
  }
}
