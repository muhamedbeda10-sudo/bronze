import type { Metadata } from "next";
import { WorkshopFloor } from "@/components/WorkshopFloor";
import { PrintHead } from "@/components/ui";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/server/auth";
import { getFloorLots } from "@/lib/server/flowQueries";
import { loadLists } from "@/lib/server/refs";
import { canRecordStage } from "@/lib/domain/floor";

export const metadata: Metadata = { title: "Workshop Floor" };

/**
 * A workshop's own page: the pieces the stage before handed over, waiting
 * here — each lot records what was finished now, and moves on by itself.
 */
export default async function Floor({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await pageUser("workshop");
  const sp = await searchParams;
  const [lots, workshops, lists] = await Promise.all([getFloorLots(), prisma.workshop.findMany({ orderBy: { code: "asc" } }), loadLists()]);
  const count = new Map<number, { lots: number; pcs: number }>();
  for (const l of lots) {
    if (l.workshopId === null) continue;
    const c = count.get(l.workshopId) ?? { lots: 0, pcs: 0 };
    c.lots++;
    c.pcs += l.waiting;
    count.set(l.workshopId, c);
  }
  const asked = sp.ws === "all" ? "all" : sp.ws && Number.isInteger(Number(sp.ws)) ? Number(sp.ws) : null;
  const firstBusy = workshops.find((w) => count.has(w.id))?.id ?? "all";
  const selected: number | "all" = asked ?? user.workshopId ?? firstBusy;
  const shown = lots
    .filter((l) => selected === "all" || l.workshopId === selected)
    .sort((a, b) => b.priority - a.priority || (b.waited ?? -1) - (a.waited ?? -1) || (a.dueDate || "9").localeCompare(b.dueDate || "9"))
    .map((l) => ({ ...l, canRecord: !l.paused && canRecordStage(user.access, user.workshopId, l.workshopId, l.qc) }));
  const ws = workshops.map((w) => ({ id: w.id, name: w.name, lots: count.get(w.id)?.lots ?? 0, pcs: count.get(w.id)?.pcs ?? 0 }));
  const title = selected === "all" ? "All workshops" : (workshops.find((w) => w.id === selected)?.name ?? "Workshop");
  return (
    <>
      <PrintHead title={`Workshop Floor — ${title}`} sub="Pieces waiting at each stage" />
      <WorkshopFloor lots={shown} workshops={ws} selected={selected} total={{ lots: lots.length, pcs: lots.reduce((a, l) => a + l.waiting, 0) }} reasons={lists.reasons.map((r) => ({ id: r.id, code: r.code, name: r.name }))} />
    </>
  );
}
