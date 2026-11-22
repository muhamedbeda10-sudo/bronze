"use server";

import { prisma } from "@/lib/db";
import { actionUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { dbError, fail, type ActionResult } from "@/lib/server/result";
import { readSheet } from "@/lib/server/excelRead";
import { notify, notifyRole } from "@/lib/server/notify";
import { STOCK_FIELDS, validateIssueRequest, validateStock, type StockLookups } from "@/lib/domain/stock";
import { STOCK_KIND_LABEL, STOCK_KIND_UNIT, STOCK_KINDS, type StockKind } from "@/lib/domain/status";
import { today } from "@/lib/domain/dates";

const isKind = (k: string): k is StockKind => (STOCK_KINDS as readonly string[]).includes(k);
const STALE_ROW = "Someone else changed this stock line a moment ago — the page has been refreshed, check it and try again.";

export async function saveStock(kind: string, id: number | null, version: number | null, raw: Record<string, unknown>, reason: string): Promise<ActionResult> {
  if (!isKind(kind)) return fail("Unknown stock list.");
  const user = await actionUser("inventory", "F");
  if (typeof user === "string") return fail(user);
  const v = validateStock(kind, raw);
  if (!v.ok) return fail(v.error);
  const data = { ...v.value, kind, unit: STOCK_KIND_UNIT[kind] } as Record<string, unknown>;
  if (id !== null && !reason.trim()) return fail("Say why the stock is changed (count difference, damage…) — it goes into the stock ledger.");
  try {
    const err = await prisma.$transaction(async (tx) => {
      if (id === null) {
        if (kind === "RAW" && (await tx.stockRow.findFirst({ where: { kind, materialId: data.materialId as number } }))) return "This material already has a raw-stock line — edit that one.";
        const row = await tx.stockRow.create({ data: data as never });
        await tx.stockMove.create({ data: { stockRowId: row.id, delta: row.totalQty, reason: "ADD", ref: reason.trim() || "New line", userName: user.name } });
        await audit(tx, user, "create", "StockRow", row.id, `Added ${STOCK_KIND_LABEL[kind]} line: ${row.totalQty} ${row.unit}`, null, row);
        return null;
      }
      const before = await tx.stockRow.findUnique({ where: { id } });
      if (!before || before.kind !== kind) return "The stock line no longer exists.";
      const res = await tx.stockRow.updateMany({ where: { id, version: version ?? -1 }, data: { ...(data as object), version: { increment: 1 } } });
      if (res.count !== 1) return STALE_ROW;
      const delta = (data.totalQty as number) - before.totalQty;
      if (delta !== 0) await tx.stockMove.create({ data: { stockRowId: id, delta, reason: "EDIT", ref: reason.trim().slice(0, 200), userName: user.name } });
      await audit(tx, user, "update", "StockRow", id, `Adjusted ${STOCK_KIND_LABEL[kind]} line #${id}: ${before.totalQty} → ${data.totalQty} ${before.unit} (${reason.trim()})`, before, data);
      return null;
    });
    if (err) return fail(err);
  } catch (e) {
    return dbError(e, "save the stock line");
  }
  return { ok: true, message: "Saved." };
}

export async function deleteStock(id: number, reason: string): Promise<ActionResult> {
  const user = await actionUser("inventory", "F");
  if (typeof user === "string") return fail(user);
  if (!reason.trim()) return fail("Say why the line is removed.");
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.stockRow.findUniqueOrThrow({ where: { id } });
      await tx.stockRow.delete({ where: { id } });
      await audit(tx, user, "delete", "StockRow", id, `Removed ${STOCK_KIND_LABEL[before.kind as StockKind] ?? before.kind} line #${id} (${before.totalQty} ${before.unit}): ${reason.trim()}`, before, null);
    });
  } catch (e) {
    return dbError(e, "remove the stock line");
  }
  return { ok: true, message: "Removed." };
}

/** Upload: the columns named as the Export names them. Raw material lines are set per material; the others are added. All or nothing. */
export async function importStock(kind: string, form: FormData): Promise<ActionResult> {
  if (!isKind(kind)) return fail("Unknown stock list.");
  const user = await actionUser("inventory", "F");
  if (typeof user === "string") return fail(user);
  const sheet = await readSheet(form.get("file") as File);
  if (!sheet.ok) return fail(sheet.error);
  const [materials, products, workshops, orders] = await Promise.all([prisma.material.findMany(), prisma.product.findMany(), prisma.workshop.findMany(), prisma.workOrder.findMany({ select: { id: true, woNo: true, lineNo: true } })]);
  const lookups: StockLookups = {
    material: new Map(materials.flatMap((m) => [[m.code.toLowerCase(), m.id], [m.name.toLowerCase(), m.id]])),
    product: new Map(products.map((p) => [p.name.toLowerCase(), p.id])),
    workshop: new Map(workshops.flatMap((w) => [[w.code.toLowerCase(), w.id], [w.name.toLowerCase(), w.id]])),
    order: new Map(orders.map((o) => [`${o.woNo}-${o.lineNo}`.toLowerCase(), o.id])),
  };
  const fields = STOCK_FIELDS[kind];
  const byName = new Map(fields.flatMap((f) => [[f.label.toLowerCase(), f.key], [`${f.label} (${f.unit})`.toLowerCase(), f.key], [f.key.toLowerCase(), f.key]]));
  const problems: string[] = [];
  const parsed: Record<string, unknown>[] = [];
  for (const r of sheet.rows) {
    const raw: Record<string, unknown> = {};
    for (const [h, v] of Object.entries(r.cells)) { const k = byName.get(h); if (k) raw[k] = v; }
    const v = validateStock(kind, raw, lookups);
    if (!v.ok) problems.push(`row ${r.rowNo}: ${v.error}`);
    else parsed.push(v.value);
  }
  if (problems.length) return fail(`Nothing was imported — fix ${problems.length} row${problems.length > 1 ? "s" : ""}: ${problems.slice(0, 5).join("; ")}`);
  if (!parsed.length) return fail("The sheet has no rows under its header.");
  try {
    await prisma.$transaction(async (tx) => {
      for (const d of parsed) {
        const data = { ...d, kind, unit: STOCK_KIND_UNIT[kind] };
        const existing = kind === "RAW" ? await tx.stockRow.findFirst({ where: { kind, materialId: d.materialId as number } }) : null;
        if (existing) {
          await tx.stockRow.update({ where: { id: existing.id }, data: { ...(data as object), version: { increment: 1 } } });
          const delta = (d.totalQty as number) - existing.totalQty;
          if (delta) await tx.stockMove.create({ data: { stockRowId: existing.id, delta, reason: "IMPORT", ref: "Excel upload", userName: user.name } });
        } else {
          const row = await tx.stockRow.create({ data: data as never });
          await tx.stockMove.create({ data: { stockRowId: row.id, delta: row.totalQty, reason: "IMPORT", ref: "Excel upload", userName: user.name } });
        }
      }
      await audit(tx, user, "import", "StockRow", null, `Imported ${parsed.length} ${STOCK_KIND_LABEL[kind]} lines from Excel`);
    }, { timeout: 60_000 });
  } catch (e) {
    return dbError(e, "import the sheet");
  }
  return { ok: true, message: `Imported ${parsed.length} lines.` };
}

export async function createIssueRequest(raw: Record<string, unknown>): Promise<ActionResult> {
  const user = await actionUser("inventory", "E");
  if (typeof user === "string") return fail(user);
  const v = validateIssueRequest(raw);
  if (!v.ok) return fail(v.error);
  if (user.workshopId && v.value.workshopId !== user.workshopId && user.access.inventory !== "F") return fail("You request material for your own workshop only.");
  try {
    await prisma.$transaction(async (tx) => {
      const n = (await tx.issueRequest.count()) + 1;
      let reqNo = `IR-${String(n).padStart(4, "0")}`;
      while (await tx.issueRequest.findUnique({ where: { reqNo } })) reqNo = `IR-${String(Number(reqNo.slice(3)) + 1).padStart(4, "0")}`;
      const r = await tx.issueRequest.create({ data: { ...v.value, reqNo, date: today(), requestedById: user.id, requestedBy: user.name } });
      await audit(tx, user, "create", "IssueRequest", r.id, `Issue request ${reqNo}: ${v.value.qtyKg} kg`, null, r);
      await notifyRole(tx, "inventory", "F", { kind: "approval", title: `Issue request ${reqNo}: ${v.value.qtyKg} kg to process`, link: "/inventory/issues" }, user.id);
    });
  } catch (e) {
    return dbError(e, "save the request");
  }
  return { ok: true, message: "Request sent to the store." };
}

/**
 * The store issues the metal: raw stock goes down, the workshop's WIP raw
 * material goes up, both in the ledger. Refused when it would take raw
 * stock below zero.
 */
export async function processIssueRequest(id: number, issue: boolean, note: string): Promise<ActionResult> {
  const user = await actionUser("inventory", "F");
  if (typeof user === "string") return fail(user);
  if (!issue && !note.trim()) return fail("Say why the request is rejected.");
  try {
    const err = await prisma.$transaction(async (tx) => {
      const r = await tx.issueRequest.findUnique({ where: { id }, include: { material: true, workshop: true } });
      if (!r) return "The request no longer exists.";
      const claimed = await tx.issueRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: issue ? "ISSUED" : "REJECTED", processedBy: user.name, processedAt: new Date(), note: note.trim() ? `${r.note ? `${r.note} · ` : ""}${note.trim()}`.slice(0, 300) : r.note } });
      if (claimed.count !== 1) return "Someone already processed this request — the page has been refreshed.";
      if (issue) {
        const raw = await tx.stockRow.findFirst({ where: { kind: "RAW", materialId: r.materialId } });
        if (!raw || raw.totalQty < r.qtyKg) throw new RangeError(`Not enough ${r.material.name} in stock: ${raw?.totalQty ?? 0} kg on hand, ${r.qtyKg} kg asked.`);
        await tx.stockRow.update({ where: { id: raw.id }, data: { totalQty: { decrement: r.qtyKg }, version: { increment: 1 } } });
        await tx.stockMove.create({ data: { stockRowId: raw.id, delta: -r.qtyKg, reason: "ISSUE", ref: r.reqNo, userName: user.name } });
        const wip = (await tx.stockRow.findFirst({ where: { kind: "WIP_RAW", materialId: r.materialId, workshopId: r.workshopId } }))
          ?? (await tx.stockRow.create({ data: { kind: "WIP_RAW", materialId: r.materialId, workshopId: r.workshopId, unit: "kg", totalQty: 0, description: `${r.material.name} at ${r.workshop.name}` } }));
        await tx.stockRow.update({ where: { id: wip.id }, data: { totalQty: { increment: r.qtyKg }, version: { increment: 1 } } });
        await tx.stockMove.create({ data: { stockRowId: wip.id, delta: r.qtyKg, reason: "RECEIVE_WIP_RAW", ref: r.reqNo, userName: user.name } });
      }
      if (r.requestedById) await notify(tx, [r.requestedById], { kind: issue ? "approved" : "rejected", title: `${r.reqNo} ${issue ? "issued" : "rejected"}: ${r.qtyKg} kg ${r.material.name}`, body: note.trim() || null, link: "/inventory/issues" }, user.id);
      await audit(tx, user, issue ? "issue" : "reject", "IssueRequest", id, `${issue ? "Issued" : "Rejected"} ${r.reqNo}: ${r.qtyKg} kg ${r.material.name} to ${r.workshop.name}`);
      return null;
    });
    if (err) return fail(err);
  } catch (e) {
    if (e instanceof RangeError) return fail(e.message);
    return dbError(e, "process the request");
  }
  return { ok: true, message: issue ? "Issued — raw stock moved to the workshop." : "Rejected." };
}
