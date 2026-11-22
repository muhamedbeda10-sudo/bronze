import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TabLinks } from "@/components/TabLinks";
import { WoList } from "@/components/WoList";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { can } from "@/lib/domain/access";
import { WO_TABS } from "@/lib/woTabs";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Open Work Orders" };

const FILTERS: { key: string; label: string; where: Prisma.WorkOrderWhereInput }[] = [
  { key: "open", label: "All open", where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } },
  { key: "planned", label: "Planned", where: { status: { in: ["PLANNED", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"] } } },
  { key: "production", label: "In Production", where: { status: { in: ["IN_PRODUCTION", "UNDER_INSPECTION", "REWORK", "ON_HOLD"] } } },
  { key: "completed", label: "Completed", where: { status: "COMPLETED" } },
  { key: "cancelled", label: "Cancelled", where: { status: "CANCELLED" } },
];

export default async function OpenOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await pageUser("workOrders");
  const sp = await searchParams;
  const f = FILTERS.find((x) => x.key === sp.status) ?? FILTERS[0]!;
  const rows = await listOrders(f.where);
  const tabs = can(user.access, "workOrders", "E") ? WO_TABS : WO_TABS.filter((t) => t.key !== "new");
  return (
    <>
      <PrintHead title="Open Work Orders" sub={f.label} />
      <TabLinks items={tabs} active="open" label="Work orders" />
      <WoList
        rows={rows}
        mode="open"
        tools={
          <>
            <nav className="seg" aria-label="Status">
              {FILTERS.map((x) => <Link key={x.key} href={x.key === "open" ? "/work-orders" : `/work-orders?status=${x.key}`} className={x.key === f.key ? "on" : ""} aria-current={x.key === f.key ? "true" : undefined}>{x.label}</Link>)}
            </nav>
            {can(user.access, "workOrders", "E") && <Link href="/work-orders/new" className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> New</Link>}
          </>
        }
      />
    </>
  );
}
