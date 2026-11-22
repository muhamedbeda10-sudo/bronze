import type { Metadata } from "next";
import { TabLinks } from "@/components/TabLinks";
import { WoCreateForm } from "@/components/WoForm";
import { pageUser } from "@/lib/server/auth";
import { woOptions } from "@/lib/server/woOptions";
import { todayKey } from "@/lib/domain/dates";
import { WO_TABS } from "@/lib/woTabs";

export const metadata: Metadata = { title: "Create Work Order" };

export default async function NewOrder() {
  await pageUser("workOrders", "E");
  const o = await woOptions();
  return (
    <>
      <TabLinks items={WO_TABS} active="new" label="Work orders" />
      <WoCreateForm o={o} todayKey={todayKey()} />
    </>
  );
}
