"use server";

import { prisma } from "@/lib/db";
import { actionUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { dbError, fail, type ActionResult } from "@/lib/server/result";
import { loadFlow, lockOrder, recordOutput, reverseActivityOutputs } from "@/lib/server/flow";
import { UserError } from "@/lib/server/errors";
import { validateActivity } from "@/lib/domain/activity";
import { can } from "@/lib/domain/access";
import { fmtDay } from "@/lib/domain/dates";

export async function recordActivity(raw: Record<string, unknown>): Promise<ActionResult> {
  const user = await actionUser("workshop", "E");
  if (typeof user === "string") return fail(user);
  const v = validateActivity(raw);
  if (!v.ok) return fail(v.error);
  const a = v.value;
  if (user.workshopId && !can(user.access, "workshop", "F") && a.workshopId !== user.workshopId) return fail("You record for your own workshop only.");
  const [machine, wo] = await Promise.all([
    a.machineId ? prisma.machine.findUnique({ where: { id: a.machineId } }) : null,
    a.workOrderId ? prisma.workOrder.findUnique({ where: { id: a.workOrderId }, include: { stages: { orderBy: { seq: "asc" } } } }) : null,
  ]);
  if (a.machineId && (!machine || machine.workshopId !== a.workshopId)) return fail("That machine is not in the chosen workshop.");
  if (a.workOrderId && !wo) return fail("The work order no longer exists.");
  if (wo && (wo.status === "CANCELLED" || wo.status === "COMPLETED")) return fail(`Order ${wo.woNo}-${wo.lineNo} is closed.`);
  if (machine && a.machineId) {
    // the same machine cannot run two records at the same time of the same day and shift
    const same = await prisma.activity.findMany({ where: { machineId: a.machineId, date: a.date, shift: a.shift } });
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const s = toMin(a.startTime);
    const e = s + a.durationHrs * 60;
    const clash = same.find((x) => { const xs = toMin(x.startTime); const xe = xs + x.durationHrs * 60; return s < xe && xs < e; });
    if (clash) return fail(`${machine.name} already has a record from ${clash.startTime} to ${clash.endTime} on that shift.`);
  }
  const moves = a.qtyProduced > 0 || a.qtyScrap > 0;
  if (moves && (!Number.isInteger(a.qtyProduced) || !Number.isInteger(a.qtyScrap))) return fail("Produced and scrap are whole pieces.");
  const wantSeq = raw.stageSeq === undefined || raw.stageSeq === "" ? null : Number(raw.stageSeq);
  let message = "Activity recorded.";
  try {
    await prisma.$transaction(async (tx) => {
      // the pieces it made move on the order's route: at the stage of this workshop that holds them
      let seq: number | null = null;
      let stageName = wo && wo.stageIndex !== null ? (wo.stages[wo.stageIndex]?.name ?? null) : null;
      if (wo && moves) {
        await lockOrder(tx, wo.id);
        const { flow } = await loadFlow(tx, wo.id);
        const here = flow.filter((f) => !f.qcRequired && (f.workshopId === a.workshopId || (wantSeq !== null && f.seq === wantSeq)));
        const st = wantSeq !== null ? here.find((f) => f.seq === wantSeq) : (here.find((f) => f.waiting > 0) ?? here[0]);
        if (!st) throw new UserError(`${wo.woNo}-${wo.lineNo} has no stage at this workshop on its route.`);
        seq = st.seq;
        stageName = st.name;
      }
      const row = await tx.activity.create({ data: { ...a, stageName, createdById: user.id, createdByName: user.name } });
      if (wo && moves && seq !== null) {
        const r = await recordOutput(wo.id, { seq, good: a.qtyProduced, scrap: a.qtyScrap, reasonId: a.rejectionReasonId, date: a.date, source: raw.source === "kiosk" ? "kiosk" : "activity", activityId: row.id, note: a.notes }, user, tx);
        message = r.completed ? "Activity recorded — the order is complete." : `Activity recorded — ${a.qtyProduced} pcs passed ${stageName}.`;
      }
      await audit(tx, user, "create", "Activity", row.id, `Recorded ${a.durationHrs} h ${wo ? `on ${wo.woNo}-${wo.lineNo}` : "maintenance/setup"}${machine ? ` (${machine.name})` : ""} on ${fmtDay(a.date)}`, null, row);
    });
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    return dbError(e, "record the activity");
  }
  return { ok: true, message };
}

export async function deleteActivity(id: number): Promise<ActionResult> {
  const user = await actionUser("workshop", "F");
  if (typeof user === "string") return fail(user);
  try {
    await prisma.$transaction(async (tx) => {
      // the pieces it moved go back first — refused when a later stage already used them
      await reverseActivityOutputs(tx, id, user);
      const before = await tx.activity.delete({ where: { id } });
      await audit(tx, user, "delete", "Activity", id, `Deleted the activity of ${fmtDay(before.date)} (${before.startTime}–${before.endTime})`, before, null);
    });
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    return dbError(e, "delete the record");
  }
  return { ok: true, message: "Deleted." };
}
