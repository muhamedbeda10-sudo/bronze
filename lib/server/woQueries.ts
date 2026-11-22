import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { dayKey, delayDays, daysBetween, today } from "@/lib/domain/dates";
import { dimensionText } from "@/lib/domain/weight";
import { isOpen } from "@/lib/domain/status";

const include = {
  product: true,
  material: true,
  process: true,
  mold: true,
  stages: { orderBy: { seq: "asc" as const }, include: { workshop: true } },
} satisfies Prisma.WorkOrderInclude;

export type WoWithAll = Prisma.WorkOrderGetPayload<{ include: typeof include }>;

/** One order line as the lists show it — plain data a client table can take. */
export interface WoRow {
  id: number;
  version: number;
  code: string;
  woNo: string;
  lineNo: number;
  lineCount: number;
  fullName: string;
  woDate: string;
  product: string;
  material: string;
  materialCode: string;
  process: string;
  processCode: string;
  dims: string;
  qty: number;
  priority: number;
  status: string;
  stage: string | null;
  stageState: string | null;
  stageIndex: number | null;
  workshop: string | null;
  workshopId: number | null;
  startDate: string;
  atpDate: string;
  dueDate: string;
  deliveryDate: string;
  completedAt: string;
  expectedKg: number | null;
  rawReqKg: number | null;
  actualKg: number | null;
  qualityStatus: string | null;
  finalStage: string | null;
  ageDays: number;
  delayDays: number;
  late: boolean;
  stages: { name: string; qc: boolean; workshop: string | null }[];
}

export function toRow(w: WoWithAll, t = today()): WoRow {
  const st = w.stageIndex !== null ? w.stages[w.stageIndex] : null;
  const done = w.completedAt ? new Date(Date.UTC(w.completedAt.getUTCFullYear(), w.completedAt.getUTCMonth(), w.completedAt.getUTCDate())) : null;
  const delay = w.status === "CANCELLED" ? 0 : delayDays(w.dueDate, done, t);
  return {
    id: w.id,
    version: w.version,
    code: `${w.woNo}-${w.lineNo}`,
    woNo: w.woNo,
    lineNo: w.lineNo,
    lineCount: w.lineCount,
    fullName: w.fullName,
    woDate: dayKey(w.woDate),
    product: w.product.name,
    material: w.material.name,
    materialCode: w.material.code,
    process: w.process.name,
    processCode: w.process.code,
    dims: dimensionText(w.product.dimensionFormat, w),
    qty: w.qty,
    priority: w.priority,
    status: w.status,
    stage: w.status === "COMPLETED" ? "Complete" : (st?.name ?? null),
    stageState: w.stageState,
    stageIndex: w.stageIndex,
    workshop: st?.workshop?.name ?? null,
    workshopId: st?.workshopId ?? null,
    startDate: dayKey(w.startDate),
    atpDate: dayKey(w.atpDate),
    dueDate: dayKey(w.dueDate),
    deliveryDate: dayKey(w.deliveryDate),
    completedAt: w.completedAt ? dayKey(done) : "",
    expectedKg: w.totalWeightKg,
    rawReqKg: w.rawReqKg,
    actualKg: w.actualWeightKg,
    qualityStatus: w.qualityStatus,
    finalStage: w.stages.length ? w.stages[w.stages.length - 1]!.name : null,
    ageDays: daysBetween(w.woDate, done ?? t),
    delayDays: delay,
    late: isOpen(w.status) && delay > 0,
    stages: w.stages.map((s) => ({ name: s.name, qc: s.qcRequired, workshop: s.workshop?.name ?? null })),
  };
}

export async function listOrders(where: Prisma.WorkOrderWhereInput = {}): Promise<WoRow[]> {
  const rows = await prisma.workOrder.findMany({ where, include, orderBy: [{ woDate: "desc" }, { woNo: "desc" }, { lineNo: "asc" }] });
  const t = today();
  return rows.map((r) => toRow(r, t));
}

export async function getOrder(id: number) {
  return prisma.workOrder.findUnique({
    where: { id },
    include: {
      ...include,
      moves: { orderBy: { at: "desc" } },
      activities: { orderBy: [{ date: "desc" }, { id: "desc" }], include: { workshop: true, machine: true, operator: true, rejectionReason: true } },
      inspections: { orderBy: { at: "desc" }, include: { rejectionReason: true } },
    },
  });
}
