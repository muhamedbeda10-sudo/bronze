import type { Metadata } from "next";
import { PlanTracker } from "@/components/PlanTracker";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { getTracker } from "@/lib/server/flowQueries";
import { loadLists } from "@/lib/server/refs";
import { canRecordStage } from "@/lib/domain/floor";

export const metadata: Metadata = { title: "Plan Tracker" };

/** Every open order against its route's stages, as pieces — and each stage records its own column. */
export default async function Tracker() {
  const user = await pageUser("planning");
  const [groups, lists] = await Promise.all([getTracker(), loadLists()]);
  const view = groups.map((g) => ({ ...g, stages: g.stages.map((s) => ({ ...s, canRecord: canRecordStage(user.access, user.workshopId, s.workshopId, s.qc) })) }));
  return (
    <>
      <PrintHead title="Plan Tracker" sub="Pieces finished at each stage of every open order" />
      <PlanTracker groups={view} reasons={lists.reasons.map((r) => ({ id: r.id, code: r.code, name: r.name }))} />
    </>
  );
}
