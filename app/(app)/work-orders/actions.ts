"use server";

import { prisma } from "@/lib/db";
import { actionUser } from "@/lib/server/auth";
import { fail, STALE, type ActionResult } from "@/lib/server/result";
import { audit } from "@/lib/server/audit";
import { applyStageAction, createWorkOrder, updateWorkOrderLine, userMessage } from "@/lib/server/workOrders";
import { readSheet } from "@/lib/server/excelRead";
import { validateLine, validateWoInput } from "@/lib/domain/workOrder";
import { dayKey, parseDay } from "@/lib/domain/dates";
import { cleanText } from "@/lib/domain/master";

export async function createWorkOrderAction(raw: { woNo: string; woDate: string; lines: Record<string, unknown>[] }): Promise<ActionResult<number[]>> {
  const user = await actionUser("workOrders", "E");
  if (typeof user === "string") return fail(user);
  const v = validateWoInput(raw);
  if (!v.ok) return fail(v.error);
  try {
    const ids = await createWorkOrder(v.value, user);
    return { ok: true, data: ids, message: `Work order ${v.value.woNo} saved — ${ids.length} line${ids.length > 1 ? "s" : ""}.` };
  } catch (e) {
    return fail(userMessage(e, "save the work order"));
  }
}

export async function updateWorkOrderAction(id: number, version: number, raw: Record<string, unknown>): Promise<ActionResult> {
  const user = await actionUser("workOrders", "E");
  if (typeof user === "string") return fail(user);
  const v = validateLine(raw, "The line", null);
  if (!v.ok) return fail(v.error);
  try {
    await updateWorkOrderLine(id, version, v.value, user);
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(userMessage(e, "save the line"));
  }
}

export async function cancelWorkOrderAction(id: number, version: number, note: string): Promise<ActionResult> {
  const user = await actionUser("workOrders", "F");
  if (typeof user === "string") return fail(user);
  if (!note.trim()) return fail("Say why the order is cancelled.");
  try {
    await applyStageAction(id, version, "CANCEL", user, { note });
    return { ok: true, message: "Order cancelled." };
  } catch (e) {
    return fail(userMessage(e, "cancel the order"));
  }
}

/**
 * Many orders from one sheet — one row per line, grouped by Work Order No.
 * Columns (by name): Work Order No, WO Date, Product, Material, Process,
 * OD, ID, Length, Width, Height, Quantity, Mold, Priority, Start Date,
 * ATP Date, Due Date, Dimension Notes, Comment Notes. All or nothing.
 */
export async function importWorkOrdersAction(form: FormData): Promise<ActionResult> {
  const user = await actionUser("workOrders", "E");
  if (typeof user === "string") return fail(user);
  const sheet = await readSheet(form.get("file") as File);
  if (!sheet.ok) return fail(sheet.error);
  const [products, materials, processes, molds] = await Promise.all([prisma.product.findMany(), prisma.material.findMany(), prisma.process.findMany(), prisma.mold.findMany()]);
  const find = <T,>(list: T[], keys: ((x: T) => string)[], v: unknown): T | undefined => {
    const s = cleanText(v).toLowerCase();
    return s ? list.find((x) => keys.some((k) => k(x).toLowerCase() === s)) : undefined;
  };
  const get = (cells: Record<string, unknown>, ...names: string[]) => names.map((n) => cells[n.toLowerCase()]).find((x) => x !== undefined && x !== null && x !== "");
  const groups = new Map<string, { woDate: unknown; lines: Record<string, unknown>[]; rows: number[] }>();
  const problems: string[] = [];
  for (const r of sheet.rows) {
    const c = r.cells;
    const woNo = cleanText(get(c, "work order no", "wo no", "woNo"));
    if (!woNo) { problems.push(`row ${r.rowNo}: Work Order No is empty`); continue; }
    const p = find(products, [(x) => x.name], get(c, "product"));
    const m = find(materials, [(x) => x.code, (x) => x.name], get(c, "material"));
    const pr = find(processes, [(x) => x.code, (x) => x.name], get(c, "process", "process type"));
    const md = get(c, "mold", "mold #", "mold no") ? find(molds, [(x) => x.moldNo], get(c, "mold", "mold #", "mold no")) : null;
    if (!p) { problems.push(`row ${r.rowNo}: product "${get(c, "product") ?? ""}" not found`); continue; }
    if (!m) { problems.push(`row ${r.rowNo}: material "${get(c, "material") ?? ""}" not found`); continue; }
    if (!pr) { problems.push(`row ${r.rowNo}: process "${get(c, "process", "process type") ?? ""}" not found`); continue; }
    if (md === undefined) { problems.push(`row ${r.rowNo}: mold not found`); continue; }
    const g = groups.get(woNo) ?? { woDate: get(c, "wo date", "date"), lines: [], rows: [] };
    g.lines.push({
      productId: p.id, materialId: m.id, processId: pr.id, moldId: md?.id ?? null,
      od: get(c, "od"), innerDia: get(c, "id", "inner diameter"), length: get(c, "length", "l"), width: get(c, "width", "w"), height: get(c, "height", "h"),
      qty: get(c, "quantity", "qty"), priority: get(c, "priority") ?? 1,
      startDate: get(c, "start date"), atpDate: get(c, "atp date"), dueDate: get(c, "due date"),
      dimensionNotes: get(c, "dimension notes"), commentNotes: get(c, "comment notes", "notes"),
    });
    g.rows.push(r.rowNo);
    groups.set(woNo, g);
  }
  const inputs = [];
  for (const [woNo, g] of groups) {
    const v = validateWoInput({ woNo, woDate: typeof g.woDate === "string" ? g.woDate : g.woDate instanceof Date ? dayKey(g.woDate) : "", lines: g.lines });
    if (!v.ok) { problems.push(`order ${woNo} (rows ${g.rows.join(", ")}): ${v.error}`); continue; }
    if (await prisma.workOrder.findFirst({ where: { woNo } })) { problems.push(`order ${woNo} already exists`); continue; }
    inputs.push(v.value);
  }
  if (problems.length) return fail(`Nothing was imported — fix ${problems.length} problem${problems.length > 1 ? "s" : ""}: ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? "; …" : ""}`);
  if (!inputs.length) return fail("The sheet has no order rows.");
  let lines = 0;
  for (const input of inputs) {
    try {
      lines += (await createWorkOrder(input, user)).length;
    } catch (e) {
      return fail(`Stopped at order ${input.woNo}: ${userMessage(e, "save it")} (the orders before it were saved).`);
    }
  }
  return { ok: true, message: `Imported ${inputs.length} orders, ${lines} lines.` };
}

/** Save the list's current filters under a name (one default per page). */
export async function saveView(page: string, name: string, query: string, isDefault: boolean): Promise<ActionResult> {
  const user = await actionUser("workOrders", "V");
  if (typeof user === "string") return fail(user);
  const n = name.trim().slice(0, 60);
  if (!n) return fail("Give the view a name.");
  if (!/^[a-z/-]{1,40}$/.test(page)) return fail("Unknown page.");
  const q = query.replace(/^\?/, "").slice(0, 1000);
  await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.savedView.updateMany({ where: { userId: user.id, page }, data: { isDefault: false } });
    await tx.savedView.upsert({ where: { userId_page_name: { userId: user.id, page, name: n } }, create: { userId: user.id, page, name: n, query: q, isDefault }, update: { query: q, isDefault } });
  });
  return { ok: true, message: `View "${n}" saved.` };
}

export async function deleteView(id: number): Promise<ActionResult> {
  const user = await actionUser("workOrders", "V");
  if (typeof user === "string") return fail(user);
  await prisma.savedView.deleteMany({ where: { id, userId: user.id } });
  return { ok: true, message: "View removed." };
}

/** The Gantt: a bar dragged or stretched gives the order new start / due dates. */
export async function rescheduleOrder(id: number, version: number, start: string, due: string): Promise<ActionResult> {
  const user = await actionUser("workOrders", "E");
  if (typeof user === "string") return fail(user);
  const s = parseDay(start);
  const d = parseDay(due);
  if (!s || !d) return fail("The dates are not valid.");
  if (d < s) return fail("The due date cannot be before the start date.");
  try {
    const err = await prisma.$transaction(async (tx) => {
      const before = await tx.workOrder.findUnique({ where: { id } });
      if (!before) return "The order no longer exists.";
      if (before.status === "COMPLETED" || before.status === "CANCELLED") return "A closed order cannot be rescheduled.";
      if (d < before.woDate) return "The due date cannot be before the WO date.";
      const res = await tx.workOrder.updateMany({ where: { id, version }, data: { startDate: s, dueDate: d, version: { increment: 1 } } });
      if (res.count !== 1) return STALE;
      await audit(tx, user, "update", "WorkOrder", id, `Rescheduled ${before.woNo}-${before.lineNo}: ${dayKey(before.startDate)} → ${start}, due ${dayKey(before.dueDate)} → ${due}`, { startDate: before.startDate, dueDate: before.dueDate }, { startDate: s, dueDate: d });
      return null;
    });
    if (err) return fail(err);
  } catch (e) {
    return fail(userMessage(e, "reschedule the order"));
  }
  return { ok: true, message: "Rescheduled." };
}
