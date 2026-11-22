import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WoWorkspace } from "@/components/WoWorkspace";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { prisma } from "@/lib/db";
import { can } from "@/lib/domain/access";
import { addDays, dayKey, today } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Work Orders" };

export default async function WorkOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await pageUser("workOrders");
  const sp = await searchParams;
  const saved = await prisma.savedView.findMany({ where: { userId: user.id, page: "work-orders" }, orderBy: { name: "asc" } });
  // a bare address opens the person's default view
  const def = saved.find((s) => s.isDefault);
  if (!Object.keys(sp).length && def?.query) redirect(`/work-orders?${def.query}`);
  const t = today();
  const [rows, stages] = await Promise.all([
    // open orders and those closed in the last half year — older history is in Work Order History
    listOrders({ OR: [{ status: { notIn: ["COMPLETED", "CANCELLED"] } }, { updatedAt: { gte: addDays(t, -183) } }] }),
    prisma.routeStage.findMany({ orderBy: [{ routeCode: "asc" }, { stageNo: "asc" }], select: { routeCode: true, name: true } }),
  ]);
  const routes = [...stages.reduce((m, s) => m.set(s.routeCode, [...(m.get(s.routeCode) ?? []), s.name]), new Map<string, string[]>()).values()];
  return (
    <>
      <PrintHead title="Work Orders" />
      <WoWorkspace
        rows={rows}
        routes={routes}
        canMove={can(user.access, "planning", "F")}
        canEdit={can(user.access, "workOrders", "E")}
        saved={saved.map((s) => ({ id: s.id, name: s.name, query: s.query, isDefault: s.isDefault }))}
        dueBy={dayKey(addDays(t, 7))}
      />
    </>
  );
}
