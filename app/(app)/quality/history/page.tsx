import type { Metadata } from "next";
import { TabLinks } from "@/components/TabLinks";
import { FilterBar } from "@/components/FilterBar";
import { InspectionHistory } from "@/components/QualityViews";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { periodOf } from "@/lib/server/period";
import { prisma } from "@/lib/db";
import { addDays, fmtDay } from "@/lib/domain/dates";
import { QC_TABS } from "@/lib/qualityTabs";

export const metadata: Metadata = { title: "Inspection History" };

export default async function InspHistory({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageUser("quality");
  const sp = await searchParams;
  const p = periodOf(sp, 30);
  const result = ["PASS", "REJECT_LAST", "REJECT_START"].includes(sp.result ?? "") ? sp.result : undefined;
  const rows = await prisma.inspection.findMany({
    where: { at: { gte: p.from, lt: addDays(p.to, 1) }, ...(result ? { result } : {}) },
    include: { workOrder: { include: { material: true } }, rejectionReason: true },
    orderBy: { at: "desc" },
  });
  return (
    <>
      <PrintHead title="Inspection History" sub={`${fmtDay(p.from)} – ${fmtDay(p.to)}`} />
      <TabLinks items={QC_TABS} active="history" label="Quality" />
      <FilterBar
        defaults={p.defaults}
        filters={[
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "result", label: "Result", type: "select", all: "Pass and reject", options: [{ value: "PASS", label: "Pass" }, { value: "REJECT_LAST", label: "Reject to last" }, { value: "REJECT_START", label: "Reject to start" }] },
        ]}
      />
      <InspectionHistory
        rows={rows.map((x) => ({
          id: x.id, at: x.at.toISOString(), wo: `${x.workOrder.woNo}-${x.workOrder.lineNo}`, woId: x.workOrderId, stage: x.stageName, result: x.result,
          material: x.workOrder.material.name, inspector: x.inspectorName, qtyInspected: x.qtyInspected, qtyRejected: x.qtyRejected, reason: x.rejectionReason?.name ?? null, notes: x.notes,
        }))}
      />
    </>
  );
}
