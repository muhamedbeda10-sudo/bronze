import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getSettings } from "./settings";
import { addDays } from "@/lib/domain/dates";
import { computeKpis, type Kpis } from "@/lib/domain/kpi";

export interface DashFilter {
  from: Date;
  to: Date;
  today: Date;
  workshopId: number | null;
  processId: number | null;
}

/** The dashboard's figures for a period, narrowed to a workshop and/or a process. */
export async function loadKpis(f: DashFilter): Promise<Kpis> {
  const settings = await getSettings();
  const woWhere: Prisma.WorkOrderWhereInput = {
    ...(f.processId ? { processId: f.processId } : {}),
    ...(f.workshopId ? { stages: { some: { workshopId: f.workshopId } } } : {}),
  };
  const end = addDays(f.to, 1);
  const [orders, activities, inspections, overtime, machines, workshops] = await Promise.all([
    prisma.workOrder.findMany({ where: woWhere, select: { id: true, status: true, qty: true, woDate: true, dueDate: true, completedAt: true, rawReqKg: true } }),
    prisma.activity.findMany({
      where: { date: { gte: f.from, lt: end }, ...(f.workshopId ? { workshopId: f.workshopId } : {}), ...(f.processId ? { workOrder: { processId: f.processId } } : {}) },
      select: { date: true, workshopId: true, machineId: true, workOrderId: true, durationHrs: true, qtyProduced: true, qtyScrap: true, rejectionReason: { select: { name: true } } },
    }),
    prisma.inspection.findMany({
      where: { at: { gte: f.from, lt: end }, ...(f.processId || f.workshopId ? { workOrder: woWhere } : {}) },
      select: { at: true, qtyRejected: true, rejectionReason: { select: { name: true } } },
    }),
    prisma.overtimeRequest.aggregate({ where: { status: "APPROVED", date: { gte: f.from, lt: end }, ...(f.workshopId ? { workshopId: f.workshopId } : {}) }, _sum: { hours: true } }),
    prisma.machine.findMany({ where: f.workshopId ? { workshopId: f.workshopId } : {}, select: { id: true, workshopId: true, status: true } }),
    prisma.workshop.findMany({ where: f.workshopId ? { id: f.workshopId } : {}, orderBy: { code: "asc" }, select: { id: true, name: true } }),
  ]);
  return computeKpis({
    orders,
    activities: activities.map((a) => ({ ...a, reason: a.rejectionReason?.name ?? null })),
    inspections: inspections.map((i) => ({ at: i.at, qtyRejected: i.qtyRejected, reason: i.rejectionReason?.name ?? null })),
    overtimeHours: overtime._sum.hours ?? 0,
    machines: machines.map((m) => ({ id: m.id, workshopId: m.workshopId, active: m.status === "Active" })),
    workshops,
    from: f.from,
    to: f.to,
    today: f.today,
    machineHoursPerDay: settings.machineHoursPerDay,
  });
}
