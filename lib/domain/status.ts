// Work order statuses (System Documentation §4, "Status Types").
// Fixed in code: the stage logic, the KPIs and the filters depend on them.

export const WO_STATUSES = [
  "PLANNED",
  "WAITING_MATERIAL",
  "WAITING_TECH_OFFICE",
  "IN_PRODUCTION",
  "UNDER_INSPECTION",
  "REWORK",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
export type WoStatus = (typeof WO_STATUSES)[number];

export const STATUS_LABEL: Record<WoStatus, string> = {
  PLANNED: "Planned",
  WAITING_MATERIAL: "Waiting Material",
  WAITING_TECH_OFFICE: "Waiting Technical Office",
  IN_PRODUCTION: "In Production",
  UNDER_INSPECTION: "Under Inspection",
  REWORK: "Rework",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";

export const STATUS_TONE: Record<WoStatus, Tone> = {
  PLANNED: "neutral",
  WAITING_MATERIAL: "warn",
  WAITING_TECH_OFFICE: "warn",
  IN_PRODUCTION: "info",
  UNDER_INSPECTION: "brand",
  REWORK: "bad",
  ON_HOLD: "warn",
  COMPLETED: "ok",
  CANCELLED: "neutral",
};

/** Closed orders: no longer on the floor. */
export const CLOSED_STATUSES: readonly WoStatus[] = ["COMPLETED", "CANCELLED"];

export function isWoStatus(v: unknown): v is WoStatus {
  return typeof v === "string" && (WO_STATUSES as readonly string[]).includes(v);
}

export function isOpen(status: string): boolean {
  return !CLOSED_STATUSES.includes(status as WoStatus);
}

export function statusLabel(status: string): string {
  return isWoStatus(status) ? STATUS_LABEL[status] : status;
}

export const PRIORITY_LABEL: Record<number, string> = { 1: "Normal", 2: "High", 3: "Urgent" };
export const PRIORITY_TONE: Record<number, Tone> = { 1: "neutral", 2: "warn", 3: "bad" };

export const TASK_STATUSES = ["UNDER_PROCESS", "COMPLETE", "ON_HOLD", "REJECTED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  UNDER_PROCESS: "Under Process",
  COMPLETE: "Complete",
  ON_HOLD: "On Hold",
  REJECTED: "Rejected",
};
export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = { UNDER_PROCESS: "info", COMPLETE: "ok", ON_HOLD: "warn", REJECTED: "bad" };

export const SHIFTS = ["DAY", "NIGHT"] as const;
export type Shift = (typeof SHIFTS)[number];
export const SHIFT_LABEL: Record<Shift, string> = { DAY: "Day", NIGHT: "Night" };

export const REQUEST_STATUS_LABEL: Record<string, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", ISSUED: "Issued" };
export const REQUEST_STATUS_TONE: Record<string, Tone> = { PENDING: "warn", APPROVED: "ok", ISSUED: "ok", REJECTED: "bad" };

export const STOCK_KINDS = ["RAW", "FG", "WIP", "WIP_RAW"] as const;
export type StockKind = (typeof STOCK_KINDS)[number];
export const STOCK_KIND_LABEL: Record<StockKind, string> = {
  RAW: "Raw Materials",
  FG: "FG Products",
  WIP: "WIP Product",
  WIP_RAW: "WIP Raw Material",
};
export const STOCK_KIND_UNIT: Record<StockKind, string> = { RAW: "kg", FG: "pcs", WIP: "pcs", WIP_RAW: "kg" };
