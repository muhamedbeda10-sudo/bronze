import { notFound } from "next/navigation";
import { KioskOrder } from "@/components/Kiosk";
import { RouteSteps } from "@/components/RouteSteps";
import { PriorityBadge, StatusBadge, Badge } from "@/components/ui";
import { getUser } from "@/lib/server/auth";
import { getOrder, toRow } from "@/lib/server/woQueries";
import { prisma } from "@/lib/db";
import { canConfirmStage } from "@/lib/domain/floor";
import { fmtDay, PLANT_TZ, todayKey } from "@/lib/domain/dates";
import { fmtNum } from "@/lib/format";

export default async function KioskOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getUser())!;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const wo = await getOrder(id);
  if (!wo) notFound();
  const r = toRow(wo);
  const st = wo.stageIndex === null ? wo.stages[0] : wo.stages[wo.stageIndex];
  const closed = wo.status === "COMPLETED" || wo.status === "CANCELLED";
  const paused = ["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"].includes(wo.status);
  const ok = !!st && !closed && !paused && canConfirmStage(user.access, user.workshopId, st.workshopId, st.qcRequired);
  const reason = !st ? "This order has no route." : closed ? "This order is closed." : paused ? "The order is paused — the planner resumes it." : st.qcRequired ? "This is a quality stage — Quality passes it." : `${st.name} belongs to ${st.workshop?.name ?? "another workshop"}.`;
  const [machines, operators, reasons] = await Promise.all([
    prisma.machine.findMany({ where: { workshopId: st?.workshopId ?? -1, status: { not: "Inactive" } }, orderBy: { code: "asc" } }),
    prisma.operator.findMany({ where: { active: true, OR: [{ workshopId: st?.workshopId ?? -1 }, { workshopId: null }] }, orderBy: { name: "asc" } }),
    prisma.rejectionReason.findMany({ orderBy: { code: "asc" } }),
  ]);
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: PLANT_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const hour = Number(hm.slice(0, 2));
  const today = wo.activities.filter((a) => a.date.toISOString().slice(0, 10) === todayKey());
  return (
    <>
      <section className="card card-pad flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.code}</div>
            <div style={{ fontSize: 16 }}>{wo.product.name} · {wo.material.name} · {r.dims}</div>
          </div>
          <div className="flex flex-col items-end gap-1"><StatusBadge status={wo.status} /><PriorityBadge priority={wo.priority} /></div>
        </div>
        <div className="stat-line" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          <div><div className="l">Stage now</div><div className="v" style={{ fontSize: 18 }}>{st?.name ?? "—"}</div></div>
          <div><div className="l">Quantity</div><div className="v" style={{ fontSize: 18 }}>{wo.qty} pcs</div></div>
          <div><div className="l">Due</div><div className="v" style={{ fontSize: 18, color: r.late ? "var(--bad-fg)" : undefined }}>{fmtDay(wo.dueDate) || "—"}</div></div>
          <div><div className="l">Made today</div><div className="v" style={{ fontSize: 18 }}>{fmtNum(today.reduce((s, a) => s + a.qtyProduced, 0), 0)}</div></div>
        </div>
        <RouteSteps stages={r.stages} stageIndex={wo.stageIndex} status={wo.status} />
        {wo.stageState === "IN_PROGRESS" && <Badge tone="info">Stage started</Badge>}
        {(wo.dimensionNotes || wo.commentNotes) && <div style={{ fontSize: 14 }}><b>Notes:</b> {[wo.dimensionNotes, wo.commentNotes].filter(Boolean).join(" · ")}</div>}
      </section>
      <KioskOrder
        d={{
          id: wo.id,
          version: wo.version,
          started: wo.stageIndex !== null && wo.stageState === "IN_PROGRESS",
          released: wo.stageIndex !== null,
          canConfirm: ok,
          reason: ok ? null : reason,
          qty: wo.qty,
          machines: machines.map((m) => ({ id: m.id, name: `${m.code} — ${m.name}` })),
          operators: operators.map((o) => ({ id: o.id, name: o.name })),
          reasons: reasons.map((x) => ({ id: x.id, name: x.name })),
          defaultShift: hour >= 7 && hour < 19 ? "DAY" : "NIGHT",
          now: hm,
          date: todayKey(),
        }}
      />
    </>
  );
}
