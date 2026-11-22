import { clockHours, parseDay } from "./dates";
import { SHIFTS, TASK_STATUSES } from "./status";

export interface ActivityInput {
  date: Date;
  workshopId: number;
  machineId: number | null;
  shift: string;
  operatorId: number | null;
  supervisor: string | null;
  priority: number;
  workOrderId: number | null;
  taskStatus: string;
  startTime: string;
  endTime: string;
  durationHrs: number;
  qtyProduced: number;
  qtyScrap: number;
  rejectionReasonId: number | null;
  notes: string | null;
}

const id = (v: unknown): number | null => {
  const n = Number(v);
  return v !== "" && v !== null && v !== undefined && Number.isInteger(n) && n > 0 ? n : null;
};

/** One shop-floor record (§7.1). Scrap needs its reason, so the scrap analysis shows real causes. */
export function validateActivity(raw: Record<string, unknown>): { ok: true; value: ActivityInput } | { ok: false; error: string } {
  const date = parseDay(raw.date);
  if (!date) return { ok: false, error: "Date is required." };
  const workshopId = id(raw.workshopId);
  if (!workshopId) return { ok: false, error: "Choose the workshop." };
  const shift = String(raw.shift ?? "");
  if (!(SHIFTS as readonly string[]).includes(shift)) return { ok: false, error: "Choose the shift." };
  const taskStatus = String(raw.taskStatus ?? "");
  if (!(TASK_STATUSES as readonly string[]).includes(taskStatus)) return { ok: false, error: "Choose the task status." };
  const startTime = String(raw.startTime ?? "");
  const endTime = String(raw.endTime ?? "");
  const durationHrs = clockHours(startTime, endTime);
  if (durationHrs === null) return { ok: false, error: "Enter the start and end time (HH:MM)." };
  if (durationHrs <= 0 || durationHrs > 16) return { ok: false, error: "The duration must be more than 0 and at most 16 hours." };
  const qtyProduced = Number(raw.qtyProduced ?? 0);
  const qtyScrap = Number(raw.qtyScrap ?? 0);
  if (!Number.isFinite(qtyProduced) || qtyProduced < 0) return { ok: false, error: "Qty Produced must be 0 or more." };
  if (!Number.isFinite(qtyScrap) || qtyScrap < 0) return { ok: false, error: "Qty Scrap must be 0 or more — enter 0 when there is none." };
  const workOrderId = id(raw.workOrderId);
  if (!workOrderId && (qtyProduced > 0 || qtyScrap > 0)) return { ok: false, error: "Maintenance / setup time produces nothing — choose the work order, or set the quantities to 0." };
  const rejectionReasonId = id(raw.rejectionReasonId);
  if (qtyScrap > 0 && !rejectionReasonId) return { ok: false, error: "Choose the rejection reason for the scrap." };
  const priority = Number(raw.priority ?? 1);
  return {
    ok: true,
    value: {
      date,
      workshopId,
      machineId: id(raw.machineId),
      shift,
      operatorId: id(raw.operatorId),
      supervisor: String(raw.supervisor ?? "").trim().slice(0, 100) || null,
      priority: [1, 2, 3].includes(priority) ? priority : 1,
      workOrderId,
      taskStatus,
      startTime,
      endTime,
      durationHrs,
      qtyProduced,
      qtyScrap,
      rejectionReasonId: qtyScrap > 0 ? rejectionReasonId : null,
      notes: String(raw.notes ?? "").trim().slice(0, 1000) || null,
    },
  };
}
