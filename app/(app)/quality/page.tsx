import type { Metadata } from "next";
import { PendingInspection } from "@/components/QualityViews";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { loadLists } from "@/lib/server/refs";
import { prisma } from "@/lib/db";
import { can } from "@/lib/domain/access";

export const metadata: Metadata = { title: "Pending Inspection" };

export default async function Pending() {
  const user = await pageUser("quality");
  const [rows, lists] = await Promise.all([listOrders({ status: "UNDER_INSPECTION" }), loadLists()]);
  const since = await prisma.stageMove.groupBy({ by: ["workOrderId"], where: { workOrderId: { in: rows.map((r) => r.id) }, toStatus: "UNDER_INSPECTION" }, _max: { at: true } });
  const at = new Map(since.map((s) => [s.workOrderId, s._max.at?.toISOString() ?? null]));
  const pending = rows.map((r) => ({ ...r, waitingSince: at.get(r.id) ?? null })).sort((a, b) => b.priority - a.priority || (a.waitingSince ?? "").localeCompare(b.waitingSince ?? ""));
  return (
    <>
      <PendingInspection rows={pending} reasons={lists.reasons.map((r) => ({ id: r.id, code: r.code, name: r.name }))} canDecide={can(user.access, "quality", "F")} />
    </>
  );
}
