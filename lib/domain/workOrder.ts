// A work order as it is typed (System Documentation §5.1): a header (WO
// date, WO number) and one line per item. Checked here, the same for the
// form and anything else that creates orders.

import { parseDay } from "./dates";

export interface WoLineInput {
  productId: number;
  materialId: number;
  processId: number;
  od: number | null;
  innerDia: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  qty: number;
  moldId: number | null;
  priority: 1 | 2 | 3;
  startDate: Date | null;
  atpDate: Date | null;
  dueDate: Date | null;
  dimensionNotes: string | null;
  commentNotes: string | null;
}

export interface WoInput {
  woNo: string;
  woDate: Date;
  lines: WoLineInput[];
}

export const MAX_LINES = 50;
const WO_NO = /^[A-Za-z0-9][A-Za-z0-9\-_/.]{0,29}$/;

type R<T> = { ok: true; value: T } | { ok: false; error: string };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

function num(v: unknown, label: string, opts: { int?: boolean; min?: number; max?: number; required?: boolean } = {}): R<number | null> {
  if (blank(v)) return opts.required ? { ok: false, error: `${label} is required.` } : { ok: true, value: null };
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a number.` };
  if (opts.int && !Number.isInteger(n)) return { ok: false, error: `${label} must be a whole number.` };
  if (opts.min !== undefined && n < opts.min) return { ok: false, error: `${label} must be at least ${opts.min}.` };
  if (opts.max !== undefined && n > opts.max) return { ok: false, error: `${label} must be at most ${opts.max}.` };
  return { ok: true, value: n };
}

function day(v: unknown, label: string): R<Date | null> {
  if (blank(v)) return { ok: true, value: null };
  const d = parseDay(v);
  return d ? { ok: true, value: d } : { ok: false, error: `${label} is not a valid date.` };
}

function text(v: unknown, max = 500): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

/** One line, as the form or the edit dialog sends it. `n` names it in errors. */
export function validateLine(raw: Record<string, unknown>, n: string, woDate: Date | null): R<WoLineInput> {
  const ids: Record<string, number> = {};
  for (const [k, label] of [["productId", "Product"], ["materialId", "Material"], ["processId", "Process Type"]] as const) {
    const r = num(raw[k], `${n}: ${label}`, { int: true, min: 1, required: true });
    if (!r.ok) return { ok: false, error: r.error.replace("must be at least 1", "is required") };
    ids[k] = r.value!;
  }
  const dims: Record<string, number | null> = {};
  for (const [k, label] of [["od", "OD"], ["innerDia", "ID"], ["length", "Length"], ["width", "Width"], ["height", "Height"]] as const) {
    const r = num(raw[k], `${n}: ${label}`, { min: 0, max: 100000 });
    if (!r.ok) return r;
    dims[k] = r.value;
  }
  if (dims.od !== null && dims.innerDia !== null && dims.innerDia > 0 && dims.innerDia >= dims.od) return { ok: false, error: `${n}: the ID must be smaller than the OD.` };
  const qty = num(raw.qty, `${n}: Quantity`, { int: true, min: 1, max: 1_000_000, required: true });
  if (!qty.ok) return qty;
  const mold = num(raw.moldId, `${n}: Mold`, { int: true, min: 1 });
  if (!mold.ok) return mold;
  const pr = num(raw.priority ?? 1, `${n}: Priority`, { int: true, min: 1, max: 3 });
  if (!pr.ok) return pr;
  const dates: Record<string, Date | null> = {};
  for (const [k, label] of [["startDate", "Start Date"], ["atpDate", "ATP Date"], ["dueDate", "Due Date"]] as const) {
    const r = day(raw[k], `${n}: ${label}`);
    if (!r.ok) return r;
    dates[k] = r.value;
  }
  if (dates.startDate && dates.dueDate && dates.dueDate < dates.startDate) return { ok: false, error: `${n}: the due date is before the start date.` };
  if (woDate && dates.dueDate && dates.dueDate < woDate) return { ok: false, error: `${n}: the due date is before the WO date.` };
  return {
    ok: true,
    value: {
      productId: ids.productId!,
      materialId: ids.materialId!,
      processId: ids.processId!,
      od: dims.od!,
      innerDia: dims.innerDia!,
      length: dims.length!,
      width: dims.width!,
      height: dims.height!,
      qty: qty.value!,
      moldId: mold.value,
      priority: (pr.value ?? 1) as 1 | 2 | 3,
      startDate: dates.startDate!,
      atpDate: dates.atpDate!,
      dueDate: dates.dueDate!,
      dimensionNotes: text(raw.dimensionNotes),
      commentNotes: text(raw.commentNotes),
    },
  };
}

export function validateWoInput(raw: { woNo?: unknown; woDate?: unknown; lines?: unknown }): R<WoInput> {
  const woNo = String(raw.woNo ?? "").trim();
  if (!woNo) return { ok: false, error: "Work Order No is required." };
  if (!WO_NO.test(woNo)) return { ok: false, error: "Work Order No may hold letters, digits and - _ / . only (30 at most)." };
  const woDate = parseDay(raw.woDate);
  if (!woDate) return { ok: false, error: "WO Date is required." };
  const lines = Array.isArray(raw.lines) ? raw.lines : [];
  if (!lines.length) return { ok: false, error: "Add at least one line." };
  if (lines.length > MAX_LINES) return { ok: false, error: `An order holds ${MAX_LINES} lines at most.` };
  const out: WoLineInput[] = [];
  for (let i = 0; i < lines.length; i++) {
    const r = validateLine((lines[i] ?? {}) as Record<string, unknown>, `Line ${i + 1}`, woDate);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return { ok: true, value: { woNo, woDate, lines: out } };
}
