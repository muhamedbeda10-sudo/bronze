// Work-order list views (List / Kanban / Gantt): the quick filters, the
// group-bys, the Kanban columns and what dropping a card on a column means.
// Pure — the screens and the tests share them.

import type { StageAction } from "./routing";
import { PRIORITY_LABEL, statusLabel } from "./status";

/** The fields of an order line the views read. */
export interface ViewRow {
  id: number;
  code: string;
  fullName: string;
  material: string;
  materialCode: string;
  process: string;
  product: string;
  status: string;
  priority: number;
  stage: string | null;
  stageIndex: number | null;
  workshop: string | null;
  dueDate: string;
  late: boolean;
  stages: { name: string; qc: boolean }[];
}

export const FILTERS = {
  open: { label: "Open", test: (r: ViewRow) => r.status !== "COMPLETED" && r.status !== "CANCELLED" },
  late: { label: "Late", test: (r: ViewRow) => r.late },
  due7: { label: "Due in 7 days", test: (r: ViewRow, t: string) => !r.late && !!r.dueDate && r.status !== "COMPLETED" && r.status !== "CANCELLED" && r.dueDate <= t },
  urgent: { label: "Urgent / high", test: (r: ViewRow) => r.priority >= 2 },
  planned: { label: "Not released", test: (r: ViewRow) => r.stageIndex === null && r.status !== "CANCELLED" },
  production: { label: "On the floor", test: (r: ViewRow) => ["IN_PRODUCTION", "REWORK"].includes(r.status) },
  inspection: { label: "Under inspection", test: (r: ViewRow) => r.status === "UNDER_INSPECTION" },
  paused: { label: "On hold / waiting", test: (r: ViewRow) => ["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"].includes(r.status) },
  completed: { label: "Completed", test: (r: ViewRow) => r.status === "COMPLETED" },
  cancelled: { label: "Cancelled", test: (r: ViewRow) => r.status === "CANCELLED" },
} as const;
export type FilterKey = keyof typeof FILTERS;
export const isFilter = (k: string): k is FilterKey => k in FILTERS;

/** Filters of one kind (statuses) widen each other; the others narrow (AND). */
const STATUS_SET: FilterKey[] = ["open", "planned", "production", "inspection", "paused", "completed", "cancelled"];

export function applyFilters<T extends ViewRow>(rows: T[], keys: FilterKey[], text: string, dueBy: string): T[] {
  const status = keys.filter((k) => STATUS_SET.includes(k));
  const other = keys.filter((k) => !STATUS_SET.includes(k));
  const q = text.trim().toLowerCase();
  return rows.filter((r) =>
    (!status.length || status.some((k) => FILTERS[k].test(r, dueBy))) &&
    other.every((k) => FILTERS[k].test(r, dueBy)) &&
    (!q || [r.code, r.fullName, r.material, r.materialCode, r.process, r.product, r.stage ?? ""].some((v) => v.toLowerCase().includes(q))),
  );
}

export const GROUPS = {
  status: { label: "Status", key: (r: ViewRow) => statusLabel(r.status) },
  stage: { label: "Stage", key: (r: ViewRow) => (r.status === "COMPLETED" ? "Complete" : r.stage ?? "Not released") },
  workshop: { label: "Workshop", key: (r: ViewRow) => r.workshop ?? "—" },
  process: { label: "Process", key: (r: ViewRow) => r.process },
  material: { label: "Material", key: (r: ViewRow) => r.material },
  product: { label: "Product", key: (r: ViewRow) => r.product },
  priority: { label: "Priority", key: (r: ViewRow) => `${r.priority} – ${PRIORITY_LABEL[r.priority] ?? ""}` },
} as const;
export type GroupKey = keyof typeof GROUPS;
export const isGroup = (k: string): k is GroupKey => k in GROUPS;

export function groupRows<T extends ViewRow>(rows: T[], g: GroupKey): { key: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = GROUPS[g].key(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map].map(([key, rs]) => ({ key, rows: rs })).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

export const NOT_RELEASED = "Not released";
export const DONE = "Completed";

/**
 * The Kanban's columns: Not released, then every stage name in the order
 * routes run through them (a stage's mean position across the routes that
 * hold it), then Completed.
 */
export function kanbanColumns(routes: string[][]): string[] {
  const pos = new Map<string, number[]>();
  for (const r of routes) r.forEach((name, i) => pos.set(name, [...(pos.get(name) ?? []), r.length > 1 ? i / (r.length - 1) : 0]));
  const stages = [...pos].map(([name, ps]) => ({ name, at: ps.reduce((s, v) => s + v, 0) / ps.length })).sort((a, b) => a.at - b.at || a.name.localeCompare(b.name)).map((x) => x.name);
  return [NOT_RELEASED, ...stages, DONE];
}

export function columnOf(r: ViewRow): string {
  if (r.status === "COMPLETED") return DONE;
  if (r.stageIndex === null) return NOT_RELEASED;
  return r.stages[r.stageIndex]?.name ?? NOT_RELEASED;
}

/**
 * What dropping the card on `column` does: one step along its own route,
 * as Planning would — or why it cannot. A quality stage is left by Quality only.
 */
export function kanbanMove(r: ViewRow, column: string): { ok: true; action: StageAction } | { ok: false; reason: string } {
  const from = columnOf(r);
  if (column === from) return { ok: false, reason: "" };
  if (r.status === "CANCELLED" || r.status === "COMPLETED") return { ok: false, reason: "The order is closed." };
  if (["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"].includes(r.status)) return { ok: false, reason: "Resume the order first." };
  const i = r.stageIndex;
  if (i === null) {
    return column === r.stages[0]?.name ? { ok: true, action: "START" } : { ok: false, reason: `${r.code} starts at ${r.stages[0]?.name ?? "its first stage"}.` };
  }
  if (r.status === "UNDER_INSPECTION") return { ok: false, reason: "It is waiting for inspection — Quality passes or rejects it." };
  const next = i + 1 < r.stages.length ? r.stages[i + 1]!.name : DONE;
  if (column === next) return { ok: true, action: "NEXT" };
  if (i > 0 && column === r.stages[i - 1]!.name) return { ok: true, action: "PREV" };
  return { ok: false, reason: `${r.code} can move to ${next}${i > 0 ? ` or back to ${r.stages[i - 1]!.name}` : ""} only.` };
}
