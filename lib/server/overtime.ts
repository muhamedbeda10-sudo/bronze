import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { dayKey } from "@/lib/domain/dates";

export interface OtRow {
  id: number;
  date: string;
  operator: string;
  workshop: string;
  fromTime: string;
  toTime: string;
  hours: number;
  reason: string;
  status: string;
  requestedBy: string;
  requestedById: number | null;
  processedBy: string | null;
  processedAt: string | null;
  decisionNote: string | null;
}

export async function listOvertime(where: Prisma.OvertimeRequestWhereInput): Promise<OtRow[]> {
  const rows = await prisma.overtimeRequest.findMany({ where, include: { operator: true, workshop: true }, orderBy: [{ date: "desc" }, { id: "desc" }] });
  return rows.map((r) => ({
    id: r.id,
    date: dayKey(r.date),
    operator: r.operator.name,
    workshop: r.workshop.name,
    fromTime: r.fromTime,
    toTime: r.toTime,
    hours: r.hours,
    reason: r.reason,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedById: r.requestedById,
    processedBy: r.processedBy,
    processedAt: r.processedAt?.toISOString() ?? null,
    decisionNote: r.decisionNote,
  }));
}
