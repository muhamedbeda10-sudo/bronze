import type { Metadata } from "next";
import { WoList } from "@/components/WoList";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";

export const metadata: Metadata = { title: "Work Order History" };

export default async function History() {
  await pageUser("workOrders");
  const rows = await listOrders();
  return (
    <>
      <PrintHead title="Work Order History" />
      <WoList rows={rows} mode="history" />
    </>
  );
}
