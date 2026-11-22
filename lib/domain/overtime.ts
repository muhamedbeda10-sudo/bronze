import { clockHours, parseDay } from "./dates";

export interface OvertimeInput {
  date: Date;
  operatorId: number;
  workshopId: number;
  fromTime: string;
  toTime: string;
  hours: number;
  reason: string;
}

/** A new request: the hours follow from the times (past midnight allowed), at most 12. */
export function validateOvertime(raw: Record<string, unknown>): { ok: true; value: OvertimeInput } | { ok: false; error: string } {
  const date = parseDay(raw.date);
  if (!date) return { ok: false, error: "Date is required." };
  const operatorId = Number(raw.operatorId);
  if (!Number.isInteger(operatorId) || operatorId < 1) return { ok: false, error: "Choose the operator." };
  const workshopId = Number(raw.workshopId);
  if (!Number.isInteger(workshopId) || workshopId < 1) return { ok: false, error: "Choose the workshop." };
  const fromTime = String(raw.fromTime ?? "");
  const toTime = String(raw.toTime ?? "");
  const hours = clockHours(fromTime, toTime);
  if (hours === null) return { ok: false, error: "Enter the time from and to (HH:MM)." };
  if (hours <= 0 || hours > 12) return { ok: false, error: "Overtime must be more than 0 and at most 12 hours." };
  const reason = String(raw.reason ?? "").trim();
  if (!reason) return { ok: false, error: "Give the reason." };
  return { ok: true, value: { date, operatorId, workshopId, fromTime, toTime, hours, reason: reason.slice(0, 500) } };
}
