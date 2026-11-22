import type { Metadata } from "next";
import { FilterBar } from "@/components/FilterBar";
import { ActivityCards } from "@/components/WorkshopViews";
import { pageUser } from "@/lib/server/auth";
import { listActivities } from "@/lib/server/activities";
import { loadLists } from "@/lib/server/refs";
import { idParam, periodOf } from "@/lib/server/period";
import { addDays } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Workshop History" };

export default async function WorkshopHistory({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageUser("workshop");
  const sp = await searchParams;
  const p = periodOf(sp, 3);
  const workshopId = idParam(sp.workshop);
  const machineId = idParam(sp.machine);
  const [rows, lists] = await Promise.all([
    listActivities({ date: { gte: p.from, lt: addDays(p.to, 1) }, ...(workshopId ? { workshopId } : {}), ...(machineId ? { machineId } : {}) }, 300),
    loadLists(),
  ]);
  return (
    <>
      <FilterBar
        defaults={p.defaults}
        filters={[
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "workshop", label: "Workshop", type: "select", all: "All workshops", options: lists.workshops.map((w) => ({ value: String(w.id), label: w.name })) },
          { key: "machine", label: "Machine", type: "select", all: "All machines", options: lists.machines.filter((m) => !workshopId || m.workshopId === workshopId).map((m) => ({ value: String(m.id), label: `${m.code} — ${m.name}` })) },
        ]}
      />
      <ActivityCards rows={rows} />
    </>
  );
}
