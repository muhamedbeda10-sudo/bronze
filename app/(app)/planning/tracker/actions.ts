"use server";

import { prisma } from "@/lib/db";
import { getUser, NOT_SIGNED_IN, NO_PERMISSION } from "@/lib/server/auth";
import { fail, type ActionResult } from "@/lib/server/result";
import { loadFlow, recordOutput } from "@/lib/server/flow";
import { userMessage } from "@/lib/server/workOrders";
import { canRecordStage } from "@/lib/domain/floor";
import { totalToDelta } from "@/lib/domain/flow";

/**
 * Record pieces at one stage of an order — the Plan Tracker (mode "total":
 * the stage's new finished total) and the workshop floor (mode "add": pieces
 * finished now). Scrap is always pieces lost now, with its reason.
 */
export async function recordPieces(input: { woId: number; seq: number; mode: "total" | "add"; good: number; scrap: number; reasonId: number | null; note?: string; source: "tracker" | "floor" }): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const { woId, seq, mode, scrap, reasonId } = input;
  if (!Number.isInteger(woId) || !Number.isInteger(seq)) return fail("Choose the order and stage.");
  if (!Number.isInteger(input.good) || !Number.isInteger(scrap)) return fail("Quantities are whole pieces.");
  if (mode === "add" && (input.good < 0 || scrap < 0)) return fail("Enter the pieces finished now (0 or more).");
  if (mode === "total" && input.good < 0) return fail("The total cannot be below 0.");
  if (scrap < 0) return fail("Scrap is the pieces lost now (0 or more).");
  const stage = await prisma.workOrderStage.findUnique({ where: { workOrderId_seq: { workOrderId: woId, seq } } });
  if (!stage) return fail("That stage is not on the order's route.");
  if (!canRecordStage(user.access, user.workshopId, stage.workshopId, stage.qcRequired)) return fail(stage.qcRequired ? "Only Quality records a quality stage." : NO_PERMISSION);
  try {
    let good = input.good;
    if (mode === "total") {
      const { flow } = await prisma.$transaction((tx) => loadFlow(tx, woId));
      good = totalToDelta(flow, seq, input.good);
    }
    if (good === 0 && scrap === 0) return { ok: true, message: "Nothing changed." };
    const r = await recordOutput(woId, { seq, good, scrap, reasonId, note: input.note ?? null, source: input.source }, user);
    const what = [good ? `${good > 0 ? good : `${-good} taken back`} good` : "", scrap ? `${scrap} scrap` : ""].filter(Boolean).join(", ");
    return { ok: true, message: r.completed ? `${what} at ${stage.name} — the order is complete and in FG stock.` : `${what} at ${stage.name}.` };
  } catch (e) {
    return fail(userMessage(e, "record the pieces"));
  }
}
