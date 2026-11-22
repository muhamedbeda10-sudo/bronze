import type { Metadata } from "next";
import { FilterBar } from "@/components/FilterBar";
import { OvertimeHistory } from "@/components/OvertimeViews";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listOvertime } from "@/lib/server/overtime";
import { loadLists } from "@/lib/server/refs";
import { idParam, periodOf } from "@/lib/server/period";
import { addDays, fmtDay } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Overtime History" };

export default async function OvertimeHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageUser("overtime");
  const sp = await searchParams;
  const p = periodOf(sp, 31);
  const workshopId = idParam(sp.workshop);
  const [rows, lists] = await Promise.all([
    listOvertime({ status: { in: ["APPROVED", "REJECTED"] }, date: { gte: p.from, lt: addDays(p.to, 1) }, ...(workshopId ? { workshopId } : {}) }),
    loadLists(),
  ]);
  return (
    <>
      <PrintHead title="Overtime report" sub={`${fmtDay(p.from)} – ${fmtDay(p.to)}`} />
      <FilterBar
        defaults={p.defaults}
        filters={[
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "workshop", label: "Workshop", type: "select", all: "All workshops", options: lists.workshops.map((w) => ({ value: String(w.id), label: w.name })) },
        ]}
      />
      <OvertimeHistory rows={rows} />
    </>
  );
}
