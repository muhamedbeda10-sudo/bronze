import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { dayKey } from "@/lib/domain/dates";

export interface ActRow {
  id: number;
  date: string;
  workshop: string;
  workshopId: number;
  machine: string | null;
  shift: string;
  operator: string | null;
  supervisor: string | null;
  wo: string | null;
  woId: number | null;
  stage: string | null;
  taskStatus: string;
  startTime: string;
  endTime: string;
  durationHrs: number;
  qtyProduced: number;
  qtyScrap: number;
  reason: string | null;
  notes: string | null;
  by: string;
}

export async function listActivities(where: Prisma.ActivityWhereInput, take = 2000): Promise<ActRow[]> {
  const rows = await prisma.activity.findMany({
    where,
    include: { workshop: true, machine: true, operator: true, workOrder: true, rejectionReason: true },
    orderBy: [{ date: "desc" }, { startTime: "desc" }, { id: "desc" }],
    take,
  });
  return rows.map((a) => ({
    id: a.id,
    date: dayKey(a.date),
    workshop: a.workshop.name,
    workshopId: a.workshopId,
    machine: a.machine?.name ?? null,
    shift: a.shift,
    operator: a.operator?.name ?? null,
    supervisor: a.supervisor,
    wo: a.workOrder ? `${a.workOrder.woNo}-${a.workOrder.lineNo}` : null,
    woId: a.workOrderId,
    stage: a.stageName,
    taskStatus: a.taskStatus,
    startTime: a.startTime,
    endTime: a.endTime,
    durationHrs: a.durationHrs,
    qtyProduced: a.qtyProduced,
    qtyScrap: a.qtyScrap,
    reason: a.rejectionReason?.name ?? null,
    notes: a.notes,
    by: a.createdByName,
  }));
}
