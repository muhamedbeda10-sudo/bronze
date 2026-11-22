// Stock lines (System Documentation §9.1). Every tab shows Total, Reserved
// and Available (= Total − Reserved); a change of quantity goes into the
// stock ledger with its reason.

import type { StockKind } from "./status";

export const STOCK_SLUG: Record<string, StockKind> = { raw: "RAW", fg: "FG", wip: "WIP", "wip-raw": "WIP_RAW" };
export const KIND_SLUG: Record<StockKind, string> = { RAW: "raw", FG: "fg", WIP: "wip", WIP_RAW: "wip-raw" };

export type StockField = { key: string; label: string; type: "number" | "text" | "material" | "product" | "workshop" | "order"; required?: boolean; unit?: string };

export const STOCK_FIELDS: Record<StockKind, StockField[]> = {
  RAW: [
    { key: "materialId", label: "Material", type: "material", required: true },
    { key: "totalQty", label: "Total qty", type: "number", required: true, unit: "kg" },
    { key: "reservedQty", label: "Reserved", type: "number", unit: "kg" },
    { key: "reservedNote", label: "Reserved note", type: "text" },
  ],
  FG: [
    { key: "productId", label: "Product", type: "product", required: true },
    { key: "materialId", label: "Material", type: "material", required: true },
    { key: "description", label: "Description", type: "text" },
    { key: "od", label: "OD", type: "number", unit: "mm" },
    { key: "innerDia", label: "ID", type: "number", unit: "mm" },
    { key: "length", label: "Length", type: "number", unit: "mm" },
    { key: "totalQty", label: "Total qty", type: "number", required: true, unit: "pcs" },
    { key: "reservedQty", label: "Reserved", type: "number", unit: "pcs" },
    { key: "reservedNote", label: "Reserved note", type: "text" },
  ],
  WIP: [
    { key: "description", label: "Description", type: "text", required: true },
    { key: "productId", label: "Product", type: "product" },
    { key: "materialId", label: "Material", type: "material" },
    { key: "workOrderId", label: "Work order", type: "order" },
    { key: "totalQty", label: "Total qty", type: "number", required: true, unit: "pcs" },
    { key: "reservedQty", label: "Reserved", type: "number", unit: "pcs" },
    { key: "reservedNote", label: "Reserved note", type: "text" },
  ],
  WIP_RAW: [
    { key: "materialId", label: "Material", type: "material", required: true },
    { key: "workshopId", label: "Workshop", type: "workshop", required: true },
    { key: "totalQty", label: "Total qty", type: "number", required: true, unit: "kg" },
    { key: "reservedQty", label: "Reserved", type: "number", unit: "kg" },
    { key: "reservedNote", label: "Reserved note", type: "text" },
  ],
};

export type StockValues = Record<string, string | number | null>;

/** Lookups from what people type (codes, names) to ids — for Excel. */
export type StockLookups = Partial<Record<"material" | "product" | "workshop" | "order", Map<string, number>>>;

/**
 * Check one stock line. From the form, references arrive as ids; from Excel
 * (with `lookups`), as codes or names.
 */
export function validateStock(kind: StockKind, raw: Record<string, unknown>, lookups?: StockLookups): { ok: true; value: StockValues } | { ok: false; error: string } {
  const out: StockValues = {};
  for (const f of STOCK_FIELDS[kind]) {
    const v = raw[f.key];
    const blank = v === undefined || v === null || String(v).trim() === "";
    if (blank) {
      if (f.required) return { ok: false, error: `${f.label} is required.` };
      out[f.key] = f.key === "reservedQty" ? 0 : null;
      continue;
    }
    if (f.type === "number") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${f.label} must be 0 or more.` };
      if (n > 1e9) return { ok: false, error: `${f.label} is too large.` };
      out[f.key] = Math.round(n * 1000) / 1000;
    } else if (f.type === "text") {
      out[f.key] = String(v).trim().slice(0, 300) || null;
    } else {
      let id: number | undefined;
      if (lookups) id = lookups[f.type]?.get(String(v).trim().toLowerCase());
      else {
        const n = Number(v);
        id = Number.isInteger(n) && n > 0 ? n : undefined;
      }
      if (id === undefined) return { ok: false, error: `${f.label}: "${v}" was not found.` };
      out[f.key] = id;
    }
  }
  if ((out.reservedQty as number) > (out.totalQty as number)) return { ok: false, error: "Reserved cannot be more than the total." };
  return { ok: true, value: out };
}

export const available = (total: number, reserved: number) => Math.round((total - reserved) * 1000) / 1000;

/** An issue request (§9.1): material, kg, the workshop asking. */
export function validateIssueRequest(raw: Record<string, unknown>): { ok: true; value: { materialId: number; qtyKg: number; workshopId: number; workOrderId: number | null; note: string | null } } | { ok: false; error: string } {
  const materialId = Number(raw.materialId);
  if (!Number.isInteger(materialId) || materialId < 1) return { ok: false, error: "Choose the material." };
  const workshopId = Number(raw.workshopId);
  if (!Number.isInteger(workshopId) || workshopId < 1) return { ok: false, error: "Choose the workshop." };
  const qtyKg = Number(raw.qtyKg);
  if (!Number.isFinite(qtyKg) || qtyKg <= 0 || qtyKg > 100000) return { ok: false, error: "Enter the quantity in kg (more than 0)." };
  const wo = Number(raw.workOrderId);
  return { ok: true, value: { materialId, workshopId, qtyKg: Math.round(qtyKg * 1000) / 1000, workOrderId: Number.isInteger(wo) && wo > 0 ? wo : null, note: String(raw.note ?? "").trim().slice(0, 300) || null } };
}
