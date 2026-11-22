"use server";

import { prisma } from "@/lib/db";
import { getUser, NO_PERMISSION, NOT_SIGNED_IN, actionUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { dbError, fail, type ActionResult } from "@/lib/server/result";
import { notify, notifyRole } from "@/lib/server/notify";
import { validateOvertime } from "@/lib/domain/overtime";
import { can } from "@/lib/domain/access";
import { fmtDay } from "@/lib/domain/dates";

export async function requestOvertime(raw: Record<string, unknown>): Promise<ActionResult> {
  const user = await actionUser("overtime", "E");
  if (typeof user === "string") return fail(user);
  const v = validateOvertime(raw);
  if (!v.ok) return fail(v.error);
  // a supervisor tied to a workshop requests for that workshop only
  if (user.workshopId && !can(user.access, "overtime", "F") && v.value.workshopId !== user.workshopId) return fail("You can request overtime for your own workshop only.");
  const op = await prisma.operator.findUnique({ where: { id: v.value.operatorId } });
  if (!op || !op.active) return fail("The operator was not found or is not active.");
  const clash = await prisma.overtimeRequest.findFirst({ where: { operatorId: op.id, date: v.value.date, status: { not: "REJECTED" } } });
  if (clash) return fail(`${op.name} already has overtime requested on ${fmtDay(v.value.date)}.`);
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.overtimeRequest.create({ data: { ...v.value, requestedById: user.id, requestedBy: user.name } });
      await audit(tx, user, "create", "OvertimeRequest", r.id, `Requested ${v.value.hours} h overtime for ${op.name} on ${fmtDay(v.value.date)}`, null, r);
      const note = { kind: "approval", title: `Overtime to approve: ${op.name}, ${v.value.hours} h on ${fmtDay(v.value.date)}`, body: v.value.reason, link: "/planning/notifications" };
      await notifyRole(tx, "planning", "F", note, user.id);
      await notifyRole(tx, "overtime", "F", note, user.id);
    });
  } catch (e) {
    return dbError(e, "save the request");
  }
  return { ok: true, message: "Request sent for approval." };
}

/** Approve or reject — by planning or HR, and never by the person who asked (§18). */
export async function decideOvertime(id: number, approve: boolean, note: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail(NOT_SIGNED_IN);
  if (!can(user.access, "overtime", "F") && !can(user.access, "planning", "F")) return fail(NO_PERMISSION);
  if (!approve && !note.trim()) return fail("Say why it is rejected.");
  try {
    const msg = await prisma.$transaction(async (tx) => {
      const r = await tx.overtimeRequest.findUnique({ where: { id }, include: { operator: true } });
      if (!r) return "gone";
      if (r.requestedById === user.id) return "self";
      const res = await tx.overtimeRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: approve ? "APPROVED" : "REJECTED", processedById: user.id, processedBy: user.name, processedAt: new Date(), decisionNote: note.trim().slice(0, 500) || null },
      });
      if (res.count !== 1) return "done";
      if (r.requestedById) await notify(tx, [r.requestedById], { kind: approve ? "approved" : "rejected", title: `Overtime ${approve ? "approved" : "rejected"}: ${r.operator.name}, ${r.hours} h on ${fmtDay(r.date)}`, body: note.trim() || null, link: "/overtime/history" }, user.id);
      await audit(tx, user, approve ? "approve" : "reject", "OvertimeRequest", id, `${approve ? "Approved" : "Rejected"} ${r.hours} h overtime for ${r.operator.name} on ${fmtDay(r.date)}`, { status: r.status }, { status: approve ? "APPROVED" : "REJECTED" });
      return null;
    });
    if (msg === "gone") return fail("The request no longer exists.");
    if (msg === "self") return fail("A request is approved by someone other than the person who made it.");
    if (msg === "done") return fail("Someone already decided this request — the page has been refreshed.");
  } catch (e) {
    return dbError(e, "save the decision");
  }
  return { ok: true, message: approve ? "Approved." : "Rejected." };
}
