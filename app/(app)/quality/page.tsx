import type { Metadata } from "next";
import { PendingInspection } from "@/components/QualityViews";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { getFloorLots } from "@/lib/server/flowQueries";
import { loadLists } from "@/lib/server/refs";
import { can } from "@/lib/domain/access";

export const metadata: Metadata = { title: "Pending Inspection" };

/** Every order with pieces waiting at a quality stage — part of an order can wait here while the rest is still being made. */
export default async function Pending() {
  const user = await pageUser("quality");
  const [lots, lists] = await Promise.all([getFloorLots(), loadLists()]);
  const qc = new Map<number, (typeof lots)[number]>();
  for (const l of lots) if (l.qc && !l.paused && !qc.has(l.id)) qc.set(l.id, l);
  const rows = qc.size ? await listOrders({ id: { in: [...qc.keys()] } }) : [];
  const pending = rows
    .map((r) => {
      const l = qc.get(r.id)!;
      return { ...r, waitingSince: l.since, qcStage: l.stage, qcWaiting: l.waiting, qcFrom: l.from, qcNext: l.next, qcStageIndex: l.stageIndex };
    })
    .sort((a, b) => b.priority - a.priority || (a.waitingSince ?? "").localeCompare(b.waitingSince ?? ""));
  return <PendingInspection rows={pending} reasons={lists.reasons.map((r) => ({ id: r.id, code: r.code, name: r.name }))} canDecide={can(user.access, "quality", "F")} />;
}
