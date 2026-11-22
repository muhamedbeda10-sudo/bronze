import type { Metadata } from "next";
import { RecordForm } from "@/components/WorkshopViews";
import { Notice } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { loadLists } from "@/lib/server/refs";
import { listOrders } from "@/lib/server/woQueries";
import { can } from "@/lib/domain/access";
import { todayKey } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Workshop Record" };

export default async function WorkshopRecord() {
  const user = await pageUser("workshop");
  const canRecord = can(user.access, "workshop", "E");
  if (!canRecord) {
    return (<><Notice tone="info">Your account can view the workshop history and logs, not record activity.</Notice></>);
  }
  const [lists, orders] = await Promise.all([loadLists(), listOrders({ status: { notIn: ["COMPLETED", "CANCELLED"] } })]);
  const own = can(user.access, "workshop", "F") ? null : user.workshopId;
  return (
    <>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>Log what each machine and operator did. Log setup and maintenance with <b>None</b> as the work order so machine utilization stays right; always enter scrap, even 0.</p>
      <RecordForm
        todayKey={todayKey()}
        ownWorkshop={own}
        me={user.name}
        o={{
          workshops: lists.workshops.map((w) => ({ id: w.id, name: w.name, supervisor: w.supervisor })),
          machines: lists.machines.map((m) => ({ id: m.id, name: m.name, code: m.code, workshopId: m.workshopId, status: m.status, defaultOperatorId: m.defaultOperatorId })),
          operators: lists.operators.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name, workshopId: x.workshopId })),
          orders: orders.map((r) => ({ id: r.id, code: r.code, name: `${r.code} · ${r.product} ${r.material} ${r.dims}`, stage: r.stage, workshopId: r.workshopId, priority: r.priority })),
          reasons: lists.reasons.map((r) => ({ id: r.id, code: r.code, name: r.name })),
        }}
      />
    </>
  );
}
