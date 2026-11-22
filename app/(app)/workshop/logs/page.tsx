import type { Metadata } from "next";
import { TabLinks } from "@/components/TabLinks";
import { FilterBar } from "@/components/FilterBar";
import { ActivityLog } from "@/components/WorkshopViews";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listActivities } from "@/lib/server/activities";
import { loadLists } from "@/lib/server/refs";
import { idParam, periodOf } from "@/lib/server/period";
import { addDays, fmtDay } from "@/lib/domain/dates";
import { can } from "@/lib/domain/access";
import { TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/domain/status";
import { WS_TABS } from "@/lib/workshopTabs";

export const metadata: Metadata = { title: "Workshop Logs" };

export default async function WorkshopLogs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await pageUser("workshop");
  const sp = await searchParams;
  const p = periodOf(sp, 14);
  const workshopId = idParam(sp.workshop);
  const status = (TASK_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
  const [rows, lists] = await Promise.all([
    listActivities({
      date: { gte: p.from, lt: addDays(p.to, 1) },
      ...(workshopId ? { workshopId } : {}),
      ...(status ? { taskStatus: status } : {}),
    }),
    loadLists(),
  ]);
  return (
    <>
      <PrintHead title="Workshop Logs" sub={`${fmtDay(p.from)} – ${fmtDay(p.to)}`} />
      <TabLinks items={can(user.access, "workshop", "E") ? WS_TABS : WS_TABS.filter((t) => t.key !== "record")} active="logs" label="Workshop" />
      <FilterBar
        defaults={p.defaults}
        filters={[
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "workshop", label: "Workshop", type: "select", all: "All workshops", options: lists.workshops.map((w) => ({ value: String(w.id), label: w.name })) },
          { key: "status", label: "Status", type: "select", all: "All statuses", options: TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] })) },
        ]}
      />
      <ActivityLog rows={rows} canDelete={can(user.access, "workshop", "F")} />
    </>
  );
}
