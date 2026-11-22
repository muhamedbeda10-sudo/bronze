import type { Metadata } from "next";
import { OvertimeDecisions, OvertimeRequestButton } from "@/components/OvertimeViews";
import { pageUser } from "@/lib/server/auth";
import { listOvertime } from "@/lib/server/overtime";
import { loadLists } from "@/lib/server/refs";
import { can } from "@/lib/domain/access";
import { todayKey } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Overtime" };

export default async function OvertimePage() {
  const user = await pageUser("overtime");
  const [rows, lists] = await Promise.all([listOvertime({ status: "PENDING" }), loadLists()]);
  const canDecide = can(user.access, "overtime", "F") || can(user.access, "planning", "F");
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Requests waiting for approval. Planning sees them in Planning Notification too; approved hours feed the dashboard and the payroll report.</p>
        {can(user.access, "overtime", "E") && (
          <OvertimeRequestButton
            operators={lists.operators.filter((o) => o.active).map((o) => ({ id: o.id, name: o.name, workshopId: o.workshopId }))}
            workshops={lists.workshops.map((w) => ({ id: w.id, name: w.name }))}
            todayKey={todayKey()}
            ownWorkshop={can(user.access, "overtime", "F") ? null : user.workshopId}
          />
        )}
      </div>
      <OvertimeDecisions rows={rows} canDecide={canDecide} myId={user.id} />
    </>
  );
}
