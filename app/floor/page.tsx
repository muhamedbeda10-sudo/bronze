import Link from "next/link";
import { KioskScan } from "@/components/Kiosk";
import { getUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { PriorityBadge, StatusBadge } from "@/components/ui";

/** Scan a traveler (or type the order), or pick from the orders at this workshop. */
export default async function KioskHome() {
  const user = (await getUser())!;
  const queue = await listOrders({ status: { notIn: ["COMPLETED", "CANCELLED"] }, ...(user.workshopId ? { stages: { some: { workshopId: user.workshopId } } } : { stageIndex: { not: null } }) });
  const mine = user.workshopId ? queue.filter((o) => o.workshopId === user.workshopId) : queue;
  return (
    <>
      <KioskScan />
      <section className="card">
        <div className="card-head"><h2 className="card-title">At {user.workshopId ? "my workshop" : "the floor"} now · {mine.length}</h2></div>
        {mine.length === 0 && <p className="muted" style={{ padding: 16, margin: 0 }}>No order is waiting at this workshop.</p>}
        {mine.sort((a, b) => b.priority - a.priority).map((o) => (
          <Link key={o.id} href={`/floor/wo/${o.id}`} className="flex items-center gap-3" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{o.code} <span className="muted" style={{ fontWeight: 400 }}>· {o.product} {o.material}</span></div>
              <div className="muted" style={{ fontSize: 13 }}>{o.stage}{o.stageState === "IN_PROGRESS" ? " · started" : " · waiting"} · qty {o.qty}</div>
            </div>
            <PriorityBadge priority={o.priority} />
            <StatusBadge status={o.status} />
          </Link>
        ))}
      </section>
    </>
  );
}
