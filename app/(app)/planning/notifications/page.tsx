import type { Metadata } from "next";
import { TabLinks } from "@/components/TabLinks";
import { OvertimeDecisions } from "@/components/OvertimeViews";
import { pageUser } from "@/lib/server/auth";
import { listOvertime } from "@/lib/server/overtime";
import { can } from "@/lib/domain/access";
import { planningTabs } from "@/lib/planningTabs";

export const metadata: Metadata = { title: "Planning Notification" };

export default async function Notifications() {
  const user = await pageUser("planning");
  const [rows, tabs] = await Promise.all([listOvertime({ status: "PENDING" }), planningTabs()]);
  return (
    <>
      <TabLinks items={tabs} active="notifications" label="Planning" />
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>Pending overtime requests for the planner to review.</p>
      <OvertimeDecisions rows={rows} canDecide={can(user.access, "planning", "F") || can(user.access, "overtime", "F")} myId={user.id} />
    </>
  );
}
