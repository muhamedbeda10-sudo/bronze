import type { Metadata } from "next";
import { WoCreateForm } from "@/components/WoForm";
import { pageUser } from "@/lib/server/auth";
import { woOptions } from "@/lib/server/woOptions";
import { todayKey } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Create Work Order" };

export default async function NewOrder() {
  await pageUser("workOrders", "E");
  const o = await woOptions();
  return (
    <>
      <WoCreateForm o={o} todayKey={todayKey()} />
    </>
  );
}
