import type { Metadata } from "next";
import { TabLinks } from "@/components/TabLinks";
import { WoList } from "@/components/WoList";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { can } from "@/lib/domain/access";
import { WO_TABS } from "@/lib/woTabs";

export const metadata: Metadata = { title: "Work Order History" };

export default async function History() {
  const user = await pageUser("workOrders");
  const rows = await listOrders();
  return (
    <>
      <PrintHead title="Work Order History" />
      <TabLinks items={can(user.access, "workOrders", "E") ? WO_TABS : WO_TABS.filter((t) => t.key !== "new")} active="history" label="Work orders" />
      <WoList rows={rows} mode="history" />
    </>
  );
}
