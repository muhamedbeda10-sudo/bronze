"use server";

import { prisma } from "@/lib/db";
import { actionUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { dbError, fail, type ActionResult } from "@/lib/server/result";
import { delegate, ENTITY_NAME, keyWhere } from "@/lib/server/master";
import { loadRefMaps } from "@/lib/server/refs";
import { readSheet } from "@/lib/server/excelRead";
import { isMasterEntity, parseRow, rowKey, SPECS, type ParsedRow } from "@/lib/domain/master";

const label = (data: ParsedRow, keys: string[]) => keys.map((k) => data[k]).join(" / ");

export async function saveMasterRow(tab: string, id: number | null, values: Record<string, unknown>): Promise<ActionResult> {
  if (!isMasterEntity(tab)) return fail("Unknown list.");
  const user = await actionUser("masterData", "E");
  if (typeof user === "string") return fail(user);
  const spec = SPECS[tab];
  const parsed = parseRow(spec, values, await loadRefMaps(), "id");
  if (!parsed.ok) return fail(parsed.error);
  const data = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const d = delegate(tab, tx);
      if (id === null) {
        const row = await d.create({ data });
        await audit(tx, user, "create", ENTITY_NAME[tab], row.id as number, `Added ${spec.singular} ${label(data, spec.keyFields)}`, null, row);
      } else {
        const before = await d.findUnique({ where: { id } });
        if (!before) throw Object.assign(new Error("gone"), { code: "P2025" });
        const row = await d.update({ where: { id }, data });
        await audit(tx, user, "update", ENTITY_NAME[tab], id, `Edited ${spec.singular} ${label(data, spec.keyFields)}`, before, row);
      }
    });
  } catch (e) {
    return dbError(e, `save the ${spec.singular}`);
  }
  return { ok: true, message: id === null ? `${spec.singular[0]!.toUpperCase()}${spec.singular.slice(1)} added.` : "Saved." };
}

export async function deleteMasterRow(tab: string, id: number): Promise<ActionResult> {
  if (!isMasterEntity(tab)) return fail("Unknown list.");
  // deleting master data is for full access only (§18: Admin)
  const user = await actionUser("masterData", "F");
  if (typeof user === "string") return fail(user);
  const spec = SPECS[tab];
  try {
    await prisma.$transaction(async (tx) => {
      const d = delegate(tab, tx);
      const before = await d.findUnique({ where: { id } });
      if (!before) throw Object.assign(new Error("gone"), { code: "P2025" });
      await d.delete({ where: { id } });
      await audit(tx, user, "delete", ENTITY_NAME[tab], id, `Deleted ${spec.singular} ${label(before as ParsedRow, spec.keyFields)}`, before, null);
    });
  } catch (e) {
    return dbError(e, `delete the ${spec.singular}`);
  }
  return { ok: true, message: "Deleted." };
}

/**
 * Upload from Excel: the first row names the columns (the labels the
 * Export writes, or the field keys). All or nothing — one bad row and
 * nothing is saved, with the rows to fix named.
 */
export async function importMaster(tab: string, form: FormData): Promise<ActionResult> {
  if (!isMasterEntity(tab)) return fail("Unknown list.");
  const user = await actionUser("masterData", "E");
  if (typeof user === "string") return fail(user);
  const spec = SPECS[tab];
  const sheet = await readSheet(form.get("file") as File);
  if (!sheet.ok) return fail(sheet.error);
  if (!sheet.rows.length) return fail("The sheet has no rows under its header.");

  const names = new Map<string, string>();
  for (const f of spec.fields) {
    names.set(f.label.toLowerCase(), f.key);
    names.set(f.key.toLowerCase(), f.key);
  }
  const missing = spec.fields.filter((f) => f.required && !sheet.headers.some((h) => names.get(h.toLowerCase()) === f.key));
  if (missing.length) return fail(`The sheet is missing the column${missing.length > 1 ? "s" : ""}: ${missing.map((f) => f.label).join(", ")}.`);

  const refs = await loadRefMaps();
  const problems: string[] = [];
  const parsed: ParsedRow[] = [];
  const seen = new Set<string>();
  for (const r of sheet.rows) {
    const raw: Record<string, unknown> = {};
    for (const [h, v] of Object.entries(r.cells)) {
      const key = names.get(h);
      if (key) raw[key] = v;
    }
    const p = parseRow(spec, raw, refs, "code");
    if (!p.ok) { problems.push(`row ${r.rowNo}: ${p.error}`); continue; }
    const k = rowKey(spec, p.data);
    if (seen.has(k)) { problems.push(`row ${r.rowNo}: ${label(p.data, spec.keyFields)} appears twice in the sheet.`); continue; }
    seen.add(k);
    parsed.push(p.data);
  }
  if (problems.length) return fail(`Nothing was imported — fix ${problems.length} row${problems.length > 1 ? "s" : ""}: ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? "; …" : ""}`);

  let added = 0;
  let updated = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const d = delegate(tab, tx);
      for (const data of parsed) {
        const existing = await d.findFirst({ where: keyWhere(tab, spec.keyFields, data) });
        if (existing) { await d.update({ where: { id: existing.id }, data }); updated++; }
        else { await d.create({ data }); added++; }
      }
      await audit(tx, user, "import", ENTITY_NAME[tab], null, `Imported ${spec.label} from Excel: ${added} added, ${updated} updated`);
    }, { timeout: 60_000 });
  } catch (e) {
    return dbError(e, "import the sheet");
  }
  return { ok: true, message: `Imported: ${added} added, ${updated} updated.` };
}
