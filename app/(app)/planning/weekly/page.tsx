import type { Metadata } from "next";
import { FilterBar } from "@/components/FilterBar";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { loadLists } from "@/lib/server/refs";
import { idParam } from "@/lib/server/period";
import { addDays, dayKey, fmtDay, parseDay, today, weekStart } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Weekly Production Plan" };

export default async function Weekly({ searchParams }: { searchParams: Promise<{ week?: string; workshop?: string }> }) {
  await pageUser("planning");
  const sp = await searchParams;
  const start = weekStart(parseDay(sp.week) ?? today());
  const end = addDays(start, 6);
  const workshopId = idParam(sp.workshop);
  const [rows, lists] = await Promise.all([
    listOrders({
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      OR: [{ startDate: { lte: end } }, { startDate: null }, { stageIndex: { not: null } }],
      ...(workshopId ? { stages: { some: { workshopId } } } : {}),
    }),
    loadLists(),
  ]);
  return (
    <>
      <PrintHead title="Weekly Production Plan" sub={`Week of ${fmtDay(start)}`} />
      <FilterBar
        defaults={{ week: dayKey(weekStart(today())) }}
        filters={[
          { key: "week", label: `Week (from ${fmtDay(start)})`, type: "date" },
          { key: "workshop", label: "Workshop", type: "select", all: "All workshops", options: lists.workshops.map((w) => ({ value: String(w.id), label: w.name })) },
        ]}
      />
      <WeeklyPlan rows={rows} />
    </>
  );
}
