import type { Metadata } from "next";
import Link from "next/link";
import { Factory } from "lucide-react";
import { TabLinks } from "@/components/TabLinks";
import { EmptyState, PriorityBadge, StatusBadge, PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { fmtDay } from "@/lib/domain/dates";
import { planningTabs } from "@/lib/planningTabs";

export const metadata: Metadata = { title: "Open Order – Workshop" };

/** Each stage's queue — the workshop supervisors' daily list. */
export default async function OpenByWorkshop() {
  await pageUser("planning");
  const [rows, tabs] = await Promise.all([listOrders({ status: { notIn: ["COMPLETED", "CANCELLED"] }, stageIndex: { not: null } }), planningTabs()]);
  const groups = new Map<string, typeof rows>();
  for (const r of rows.sort((a, b) => b.priority - a.priority || (a.dueDate || "9").localeCompare(b.dueDate || "9"))) {
    const k = r.stage ?? "—";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <>
      <PrintHead title="Open orders by production stage" />
      <TabLinks items={tabs} active="workshop" label="Planning" />
      {!groups.size ? (
        <div className="card"><EmptyState icon={Factory} title="No order is on the floor" hint="Released orders show here, grouped by the stage they are at." /></div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))" }}>
          {[...groups].sort((a, b) => a[0].localeCompare(b[0])).map(([stage, list]) => (
            <section key={stage} className="card">
              <div className="card-head">
                <h2 className="card-title">{stage}</h2>
                <span className="badge tone-brand badge-plain">{list.length} active order{list.length > 1 ? "s" : ""}</span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {list.map((r) => (
                  <li key={r.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/work-orders/${r.id}`} className="code ink">{r.code}</Link>
                      <StatusBadge status={r.status} />
                    </div>
                    <div style={{ fontSize: 13, margin: "2px 0 4px" }}>{r.fullName}</div>
                    <div className="meta">
                      <span>{r.process}</span>
                      {r.workshop && <span>{r.workshop}</span>}
                      <PriorityBadge priority={r.priority} />
                      <span>Due <b style={{ color: r.late ? "var(--bad-fg)" : undefined }}>{fmtDay(r.dueDate) || "—"}</b></span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
