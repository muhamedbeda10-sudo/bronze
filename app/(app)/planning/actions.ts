"use server";

import { actionUser } from "@/lib/server/auth";
import { fail, type ActionResult } from "@/lib/server/result";
import { applyStageAction, userMessage } from "@/lib/server/workOrders";
import { ACTION_LABEL, STAGE_ACTIONS, type StageAction } from "@/lib/domain/routing";

const PLANNING: readonly StageAction[] = ["START", "NEXT", "PREV", "REWORK", "HOLD", "WAIT_MATERIAL", "WAIT_TECH_OFFICE", "RESUME"];

/** Planning moves an order along its route; Quality passes or rejects it (app/(app)/quality). */
export async function stageAction(id: number, version: number, action: string, note: string | null): Promise<ActionResult<{ completed: boolean }>> {
  const user = await actionUser("planning", "F");
  if (typeof user === "string") return fail(user);
  if (!(STAGE_ACTIONS as readonly string[]).includes(action) || !PLANNING.includes(action as StageAction)) return fail("That action is not done from Planning.");
  if ((action === "REWORK" || action === "HOLD") && !note?.trim()) return fail("Say why — it goes into the order's history.");
  try {
    const r = await applyStageAction(id, version, action as StageAction, user, { note });
    return { ok: true, data: { completed: r.completed }, message: r.completed ? "Order completed — the pieces went into FG stock." : `${ACTION_LABEL[action as StageAction]} done.` };
  } catch (e) {
    return fail(userMessage(e, "move the order"));
  }
}
