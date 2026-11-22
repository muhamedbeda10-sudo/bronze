// Master Data (System Documentation §4): one spec per tab, read by the
// table, the add/edit form, the Excel import and the Excel export alike —
// so a field is checked the same way whichever way it comes in.
//
// Fixes from §14 built in: codes are unique and upper-cased (no duplicate
// WS-03 / MAC-08), names are trimmed of stray separators ("Shakeout &
// Fettling|"), and a route has no typed "next stage" to get wrong.

export const MASTER_TABS = [
  "materials",
  "products",
  "statuses",
  "workshops",
  "processes",
  "routing",
  "machines",
  "molds",
  "operators",
  "rejection-reasons",
] as const;
export type MasterTab = (typeof MASTER_TABS)[number];
/** The tabs kept in the database (Status Types are fixed in code). */
export type MasterEntity = Exclude<MasterTab, "statuses">;

export type RefSource = "material" | "process" | "workshop" | "product" | "operator";
export type FieldType = "text" | "textarea" | "number" | "int" | "bool" | "select" | "ref";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  ref?: RefSource;
  unit?: string;
  min?: number;
  max?: number;
  /** upper-case the value (codes) */
  code?: boolean;
  /** shown in the table (default true) */
  list?: boolean;
  help?: string;
}

export interface EntitySpec {
  tab: MasterEntity;
  label: string;
  singular: string;
  /** the field(s) a row is known by — the import updates a row with the same key */
  keyFields: string[];
  fields: Field[];
  hint: string;
}

export const SKILL_LEVELS = ["Unskilled", "Semi-Skilled", "Skilled"] as const;
export const MACHINE_STATUSES = ["Active", "Under Maintenance", "Inactive"] as const;
export const ACTIVE_STATUSES = ["Active", "Inactive"] as const;

export const SPECS: Record<MasterEntity, EntitySpec> = {
  materials: {
    tab: "materials",
    label: "Materials",
    singular: "material",
    keyFields: ["code"],
    hint: "One code per alloy. The density is used in every work order's weight.",
    fields: [
      { key: "code", label: "Material code", type: "text", required: true, code: true, help: "e.g. BRZ-08" },
      { key: "name", label: "Name", type: "text", required: true, help: "e.g. C90500, RG7, LG2 — Arabic names are allowed" },
      { key: "family", label: "Family", type: "text" },
      { key: "density", label: "Density", type: "number", unit: "g/cm³", required: true, min: 0.5, max: 25 },
      { key: "composition", label: "Alloy composition", type: "textarea", list: false },
      { key: "scrapPct", label: "Scrap", type: "number", unit: "%", min: 0, max: 100 },
      { key: "defaultProcessId", label: "Default process", type: "ref", ref: "process" },
      { key: "status", label: "Status", type: "select", options: ACTIVE_STATUSES },
    ],
  },
  products: {
    tab: "products",
    label: "FG Products",
    singular: "product",
    keyFields: ["name"],
    hint: "Product types and how their dimensions are entered on a work order.",
    fields: [
      { key: "name", label: "Product type", type: "text", required: true, help: "Bushings, Bars, Plates, Impellers, Custom" },
      { key: "dimensionFormat", label: "Dimension format", type: "select", required: true, options: ["OD_ID_L", "W_L_H", "IMPELLER", "CUSTOM"] },
      { key: "compatibleProcesses", label: "Compatible processes", type: "text", help: "Process codes, comma separated" },
    ],
  },
  workshops: {
    tab: "workshops",
    label: "Workshops",
    singular: "workshop",
    keyFields: ["code"],
    hint: "Each code once — a workshop listed twice splits its load and its reports.",
    fields: [
      { key: "code", label: "Workshop ID", type: "text", required: true, code: true, help: "e.g. WS-01" },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "stageName", label: "Associated stage", type: "text" },
      { key: "supervisor", label: "Supervisor", type: "text" },
    ],
  },
  processes: {
    tab: "processes",
    label: "Manufacturing Processes",
    singular: "process",
    keyFields: ["code"],
    hint: "The process of a work order decides its route.",
    fields: [
      { key: "code", label: "Process ID", type: "text", required: true, code: true, help: "e.g. PRC-01" },
      { key: "name", label: "Type", type: "text", required: true, help: "e.g. Sand Casting" },
      { key: "description", label: "Description", type: "textarea", list: false },
      { key: "routeCode", label: "Default routing", type: "text", required: true, code: true, help: "Route ID from Routing Master, e.g. RT-01" },
      { key: "compatibleProducts", label: "Compatible products", type: "text" },
    ],
  },
  routing: {
    tab: "routing",
    label: "Routing Master",
    singular: "route stage",
    keyFields: ["routeCode", "stageNo"],
    hint: "A route is its stages in order; the last stage ends it. Orders already saved keep the route they were saved with.",
    fields: [
      { key: "routeCode", label: "Route ID", type: "text", required: true, code: true },
      { key: "stageNo", label: "Stage no.", type: "int", required: true, min: 1, max: 99 },
      { key: "name", label: "Stage name", type: "text", required: true },
      { key: "workshopId", label: "Workshop", type: "ref", ref: "workshop" },
      { key: "stdTimeMin", label: "Std time", type: "number", unit: "min/unit", min: 0 },
      { key: "operatorsRequired", label: "Operators required", type: "int", min: 0, max: 50 },
      { key: "qcRequired", label: "QC required", type: "bool" },
      { key: "skillLevel", label: "Skill level", type: "select", options: SKILL_LEVELS },
    ],
  },
  machines: {
    tab: "machines",
    label: "Machines",
    singular: "machine",
    keyFields: ["code"],
    hint: "Active machines count toward utilization.",
    fields: [
      { key: "code", label: "Machine ID", type: "text", required: true, code: true, help: "e.g. MAC-01" },
      { key: "workshopId", label: "Workshop", type: "ref", ref: "workshop", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "number", label: "Number", type: "text", list: false },
      { key: "type", label: "Type", type: "text" },
      { key: "productionRate", label: "Production rate", type: "number", min: 0 },
      { key: "rateUnit", label: "Rate unit", type: "text", help: "e.g. kg/hr", list: false },
      { key: "capacity", label: "Capacity", type: "number", unit: "kg", min: 0 },
      { key: "defaultOperatorId", label: "Default operator", type: "ref", ref: "operator", list: false },
      { key: "setupMin", label: "Setup time", type: "number", unit: "min", min: 0, list: false },
      { key: "changeoverMin", label: "Changeover time", type: "number", unit: "min", min: 0, list: false },
      { key: "maintIntervalDays", label: "Maintenance interval", type: "int", unit: "days", min: 0, list: false },
      { key: "status", label: "Status", type: "select", options: MACHINE_STATUSES },
    ],
  },
  molds: {
    tab: "molds",
    label: "Molds",
    singular: "mold",
    keyFields: ["moldNo"],
    hint: "The approx. product weight gives a work order's mold-based weight.",
    fields: [
      { key: "moldNo", label: "Mold no.", type: "text", required: true, code: true },
      { key: "processId", label: "Process", type: "ref", ref: "process" },
      { key: "productId", label: "Product", type: "ref", ref: "product" },
      { key: "description", label: "Description", type: "text" },
      { key: "diaMin", label: "Diameter min", type: "number", unit: "mm", min: 0, list: false },
      { key: "diaMax", label: "Diameter max", type: "number", unit: "mm", min: 0, list: false },
      { key: "lenMin", label: "Length min", type: "number", unit: "mm", min: 0, list: false },
      { key: "lenMax", label: "Length max", type: "number", unit: "mm", min: 0, list: false },
      { key: "processTimeMin", label: "Process time", type: "number", unit: "min", min: 0, list: false },
      { key: "type", label: "Type", type: "text" },
      { key: "usageCount", label: "Usage counter", type: "int", min: 0 },
      { key: "maintCycle", label: "Maintenance cycle", type: "int", unit: "uses", min: 0, list: false },
      { key: "approxWeightKg", label: "Approx. product weight", type: "number", unit: "kg", min: 0 },
      { key: "available", label: "Available", type: "bool" },
    ],
  },
  operators: {
    tab: "operators",
    label: "Operators",
    singular: "operator",
    keyFields: ["code"],
    hint: "These names appear in Workshop Execution and Overtime.",
    fields: [
      { key: "code", label: "Operator ID", type: "text", required: true, code: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "workshopId", label: "Workshop", type: "ref", ref: "workshop" },
      { key: "skillLevel", label: "Skill level", type: "select", options: SKILL_LEVELS },
      { key: "active", label: "Active", type: "bool" },
    ],
  },
  "rejection-reasons": {
    tab: "rejection-reasons",
    label: "Rejection Reasons",
    singular: "rejection reason",
    keyFields: ["code"],
    hint: "Feeds the scrap analysis — pick one whenever scrap or a rejection is recorded.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true, code: true, help: "e.g. REJ-01" },
      { key: "name", label: "Name", type: "text", required: true, help: "e.g. Porosity" },
      { key: "description", label: "Defect description", type: "textarea" },
    ],
  },
};

export const TAB_LABEL: Record<MasterTab, string> = {
  ...Object.fromEntries(Object.values(SPECS).map((s) => [s.tab, s.label])),
  statuses: "Status Types",
} as Record<MasterTab, string>;

export function isMasterTab(v: unknown): v is MasterTab {
  return typeof v === "string" && (MASTER_TABS as readonly string[]).includes(v);
}
export function isMasterEntity(v: unknown): v is MasterEntity {
  return isMasterTab(v) && v !== "statuses";
}

/** A reference's options: id ↔ the code people type (case-insensitive on the way in). */
export interface RefMap {
  byId: Map<number, string>;
  byCode: Map<string, number>;
}
export type RefMaps = Partial<Record<RefSource, RefMap>>;

export function refMap(rows: { id: number; code: string }[]): RefMap {
  return { byId: new Map(rows.map((r) => [r.id, r.code])), byCode: new Map(rows.map((r) => [r.code.trim().toLowerCase(), r.id])) };
}

/** Trim, collapse spaces, drop stray separators at either end. */
export function cleanText(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[|;,/\\]+|[|;,/\\]+$/g, "")
    .trim();
}

const TRUE = new Set(["true", "yes", "y", "1", "on", "x", "✓"]);
const FALSE = new Set(["false", "no", "n", "0", "off", ""]);

export type ParsedRow = Record<string, string | number | boolean | null>;

/**
 * Check one row against its spec. `refsBy` says how references arrive: as ids
 * (the form) or as codes (an Excel sheet). Returns the clean values or the
 * first problem, named by the field's label.
 */
export function parseRow(spec: EntitySpec, raw: Record<string, unknown>, refs: RefMaps, refsBy: "id" | "code"): { ok: true; data: ParsedRow } | { ok: false; error: string } {
  const data: ParsedRow = {};
  for (const f of spec.fields) {
    const v = raw[f.key];
    const blank = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (f.type === "bool") {
      if (blank) {
        data[f.key] = f.key === "qcRequired" ? false : true;
        continue;
      }
      const s = String(v).trim().toLowerCase();
      if (typeof v === "boolean") data[f.key] = v;
      else if (TRUE.has(s)) data[f.key] = true;
      else if (FALSE.has(s)) data[f.key] = false;
      else return { ok: false, error: `${f.label}: "${v}" is not yes or no.` };
      continue;
    }
    if (blank) {
      if (f.required) return { ok: false, error: `${f.label} is required.` };
      data[f.key] = f.type === "select" && f.options ? (f.key === "status" ? f.options[0] : null) : null;
      continue;
    }
    switch (f.type) {
      case "text":
      case "textarea": {
        let s = cleanText(v);
        if (f.code) s = s.toUpperCase().replace(/\s+/g, "");
        if (!s && f.required) return { ok: false, error: `${f.label} is required.` };
        if (s.length > 500) return { ok: false, error: `${f.label} is too long.` };
        data[f.key] = s || null;
        break;
      }
      case "number":
      case "int": {
        const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
        if (!Number.isFinite(n)) return { ok: false, error: `${f.label}: "${v}" is not a number.` };
        if (f.type === "int" && !Number.isInteger(n)) return { ok: false, error: `${f.label} must be a whole number.` };
        if (f.min !== undefined && n < f.min) return { ok: false, error: `${f.label} must be at least ${f.min}.` };
        if (f.max !== undefined && n > f.max) return { ok: false, error: `${f.label} must be at most ${f.max}.` };
        data[f.key] = n;
        break;
      }
      case "select": {
        const s = cleanText(v);
        const hit = f.options?.find((o) => o.toLowerCase() === s.toLowerCase());
        if (!hit) return { ok: false, error: `${f.label}: "${s}" is not one of ${f.options?.join(", ")}.` };
        data[f.key] = hit;
        break;
      }
      case "ref": {
        const map = refs[f.ref!];
        let id: number | undefined;
        if (refsBy === "id") {
          const n = Number(v);
          id = Number.isInteger(n) && map?.byId.has(n) ? n : undefined;
        } else {
          id = map?.byCode.get(cleanText(v).toLowerCase());
        }
        if (id === undefined) return { ok: false, error: `${f.label}: "${v}" was not found.` };
        data[f.key] = id;
        break;
      }
    }
  }
  if (spec.tab === "molds") {
    const pairs: [string, string][] = [["diaMin", "diaMax"], ["lenMin", "lenMax"]];
    for (const [lo, hi] of pairs) {
      if (typeof data[lo] === "number" && typeof data[hi] === "number" && (data[lo] as number) > (data[hi] as number)) {
        return { ok: false, error: "A minimum is larger than its maximum." };
      }
    }
  }
  return { ok: true, data };
}

/** The key a row is known by — for finding duplicates in an import. */
export function rowKey(spec: EntitySpec, data: ParsedRow): string {
  return spec.keyFields.map((k) => String(data[k] ?? "").toLowerCase()).join("|");
}

/** A value as it goes into an Excel cell or a table cell. */
export function displayValue(f: Field, v: unknown, refs: RefMaps): string | number {
  if (v === null || v === undefined) return "";
  if (f.type === "bool") return v ? "Yes" : "No";
  if (f.type === "ref") return refs[f.ref!]?.byId.get(Number(v)) ?? "";
  if (typeof v === "number") return v;
  return String(v);
}
