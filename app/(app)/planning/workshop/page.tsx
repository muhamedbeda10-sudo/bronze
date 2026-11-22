import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Factory, Hourglass } from "lucide-react";
import { Badge, EmptyState, PriorityBadge, PrintHead } from "@/components/ui";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/server/auth";
import { getFloorLots, type FloorLot } from "@/lib/server/flowQueries";
import { fmtDay } from "@/lib/domain/dates";
import { waitTone } from "@/lib/domain/flow";

export const metadata: Metadata = { title: "Overview" };

/**
 * Manufacturing's overview, as Odoo's work centers: a card per workshop with
 * the pieces waiting there — part of an order can wait at one workshop while
 * the rest is already further on. A card opens that workshop's floor.
 */
export default async function Overview() {
  await pageUser("planning");
  const [lots, workshops] = await Promise.all([getFloorLots(), prisma.workshop.findMany({ orderBy: { code: "asc" } })]);
  const by = new Map<number | null, FloorLot[]>();
  for (const l of lots.sort((a, b) => b.priority - a.priority || (b.waited ?? -1) - (a.waited ?? -1) || (a.dueDate || "9").localeCompare(b.dueDate || "9"))) by.set(l.workshopId, [...(by.get(l.workshopId) ?? []), l]);
  const cards = [...workshops.map((w) => ({ id: w.id as number | null, name: w.name, lots: by.get(w.id) ?? [] })), ...(by.has(null) ? [{ id: null, name: "No workshop", lots: by.get(null)! }] : [])].filter((c) => c.lots.length);
  return (
    <>
      <PrintHead title="Overview" sub="Pieces waiting at each workshop" />
      {!cards.length ? (
        <div className="card"><EmptyState icon={Factory} title="No piece is on the floor" hint="Released orders show here, at the workshops where their pieces wait." /></div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))" }}>
          {cards.map((c) => {
            const pcs = c.lots.reduce((a, l) => a + l.waiting, 0);
            const old = c.lots.filter((l) => (l.waited ?? 0) >= 7).length;
            return (
              <section key={c.id ?? "none"} className="card">
                <div className="card-head">
                  <h2 className="card-title">{c.id ? <Link href={`/workshop/floor?ws=${c.id}`} className="ink">{c.name}</Link> : c.name}</h2>
                  <div className="flex items-center gap-2">
                    {old > 0 && <Badge tone="bad"><Hourglass size={11} aria-hidden /> {old} a week+</Badge>}
                    <span className="badge tone-brand badge-plain">{pcs} pcs · {c.lots.length} order{c.lots.length > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {c.lots.slice(0, 8).map((l) => {
                    const tone = waitTone(l.waited);
                    return (
                      <li key={`${l.id}-${l.seq}`} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Link href={`/work-orders/${l.id}`} className="code ink" style={{ fontWeight: 600 }}>{l.code}</Link>
                            <span className="muted" style={{ fontSize: 12 }}>{l.stage}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {l.waited !== null && <Badge tone={tone} title={l.since ? `Since ${fmtDay(l.since)}` : undefined}><Hourglass size={11} aria-hidden /> {l.waited === 0 ? "today" : `${l.waited} d`}</Badge>}
                            <b style={{ fontVariantNumeric: "tabular-nums" }}>{l.waiting}</b>
                            <span className="muted" style={{ fontSize: 12 }}>/ {l.qty}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, margin: "2px 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.fullName}>{l.fullName}</div>
                        <div className="meta">
                          <span className="lot-flow">{l.from ?? "Release"} <ArrowRight size={12} aria-hidden /> <b>{l.stage}</b> <ArrowRight size={12} aria-hidden /> {l.next ?? "FG stock"}</span>
                          <PriorityBadge priority={l.priority} />
                          <span>Due <b style={{ color: l.late ? "var(--bad-fg)" : undefined }}>{fmtDay(l.dueDate) || "—"}</b></span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {c.id && (
                  <div style={{ padding: "8px 16px" }}>
                    <Link href={`/workshop/floor?ws=${c.id}`} className="btn btn-secondary btn-sm">{c.lots.length > 8 ? `All ${c.lots.length} on the floor` : "Open the floor"} <ArrowRight size={13} aria-hidden /></Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
