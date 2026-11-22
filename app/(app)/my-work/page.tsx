import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, AtSign, CalendarClock, ClipboardCheck, ClipboardList, Clock, Factory, Hourglass, PackageOpen, Plus, Rocket, Tablet } from "lucide-react";
import { CpanelActions } from "@/components/Cpanel";
import { Badge, EmptyState, PriorityBadge, StatusBadge } from "@/components/ui";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { prisma } from "@/lib/db";
import { can, visibleModules } from "@/lib/domain/access";
import { addDays, dayKey, fmtDay, fmtInstant, today } from "@/lib/domain/dates";
import { fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "My Work" };

function Panel({ title, icon, count, href, children, tone }: { title: string; icon: ReactNode; count?: number; href?: string; children: ReactNode; tone?: "bad" | "warn" }) {
  return (
    <section className="card" style={{ minWidth: 0 }}>
      <div className="card-head">
        <h2 className="card-title">{icon}{title}{count !== undefined && <Badge plain tone={count ? tone ?? "brand" : "neutral"}>{count}</Badge>}</h2>
        {href && <Link href={href} className="link" style={{ fontSize: 12 }}>Open all</Link>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Row({ href, title, meta, right }: { href: string; title: ReactNode; meta?: ReactNode; right?: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3" style={{ padding: "9px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {meta && <div className="muted" style={{ fontSize: 12 }}>{meta}</div>}
      </div>
      {right && <div className="flex items-center gap-2" style={{ flex: "none" }}>{right}</div>}
    </Link>
  );
}

const None = ({ text }: { text: string }) => <p className="muted" style={{ margin: 0, padding: "18px 16px", fontSize: 13 }}>{text}</p>;

/** Everyone's home: what is waiting for them, by what their account can act on. */
export default async function MyWork() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!visibleModules(user.access).length) redirect("/no-access");
  const a = user.access;
  const t = today();
  const week = addDays(t, 7);
  const canPlan = can(a, "planning", "F");
  const canQc = can(a, "quality", "F");
  const canStore = can(a, "inventory", "F");
  const canOt = can(a, "overtime", "F") || canPlan;
  const seesOrders = can(a, "workOrders") || can(a, "planning");

  const [open, inspections, issues, overtime, mentions, mine] = await Promise.all([
    seesOrders ? listOrders({ status: { notIn: ["COMPLETED", "CANCELLED"] } }) : Promise.resolve([]),
    canQc || can(a, "quality") ? listOrders({ status: "UNDER_INSPECTION" }) : Promise.resolve([]),
    canStore ? prisma.issueRequest.findMany({ where: { status: "PENDING" }, include: { material: true, workshop: true }, orderBy: { date: "asc" }, take: 8 }) : Promise.resolve([]),
    canOt ? prisma.overtimeRequest.findMany({ where: { status: "PENDING", requestedById: { not: user.id } }, include: { operator: true, workshop: true }, orderBy: { date: "asc" }, take: 8 }) : Promise.resolve([]),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    user.workshopId ? listOrders({ status: { notIn: ["COMPLETED", "CANCELLED"] }, stageIndex: { not: null }, stages: { some: { workshopId: user.workshopId } } }) : Promise.resolve([]),
  ]);

  const late = open.filter((o) => o.late).sort((x, y) => y.delayDays - x.delayDays);
  const dueSoon = open.filter((o) => !o.late && o.dueDate && o.dueDate <= dayKey(week)).sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  const toRelease = open.filter((o) => o.status === "PLANNED" && (!o.startDate || o.startDate <= dayKey(t))).sort((x, y) => y.priority - x.priority);
  const paused = open.filter((o) => ["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"].includes(o.status));
  const atMyWorkshop = mine.filter((o) => o.workshopId === user.workshopId);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "numeric", hour12: false }).format(new Date()));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const tiles: { label: string; value: number; href: string; tone?: string; icon: ReactNode }[] = [];
  if (seesOrders) {
    tiles.push({ label: "Open orders", value: open.length, href: "/work-orders", icon: <ClipboardList size={14} aria-hidden /> });
    tiles.push({ label: "Late", value: late.length, href: "/work-orders?f=late", tone: late.length ? "kpi-bad" : "kpi-ok", icon: <AlertTriangle size={14} aria-hidden /> });
    tiles.push({ label: "Due in 7 days", value: dueSoon.length, href: "/work-orders?f=due7", tone: dueSoon.length ? "kpi-warn" : "", icon: <CalendarClock size={14} aria-hidden /> });
  }
  if (can(a, "quality")) tiles.push({ label: "Waiting inspection", value: inspections.length, href: "/quality", tone: inspections.length ? "kpi-info" : "", icon: <ClipboardCheck size={14} aria-hidden /> });
  if (canOt) tiles.push({ label: "Overtime to decide", value: overtime.length, href: "/planning/notifications", tone: overtime.length ? "kpi-warn" : "", icon: <Clock size={14} aria-hidden /> });
  if (canStore) tiles.push({ label: "Issue requests", value: issues.length, href: "/inventory/issues", tone: issues.length ? "kpi-warn" : "", icon: <PackageOpen size={14} aria-hidden /> });

  return (
    <div className="flex flex-col gap-4">
      <CpanelActions>
        {can(a, "workshop", "E") && <Link href="/floor" className="btn btn-secondary btn-sm"><Tablet size={15} aria-hidden /> Kiosk</Link>}
        {can(a, "workOrders", "E") && <Link href="/work-orders/new" className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> New work order</Link>}
      </CpanelActions>
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>{hello}, {user.name.split(" ")[0]}</h2>
        <p className="muted" style={{ margin: "2px 0 0" }}>{fmtDay(t)} · here is what is waiting for you.</p>
      </div>

      {tiles.length > 0 && (
        <div className="kpi-grid">
          {tiles.map((x) => (
            <Link key={x.label} href={x.href} className={`kpi ${x.tone ?? ""}`}>
              <div className="kpi-label">{x.icon}{x.label}</div>
              <div className="kpi-value">{x.value}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3 lg:grid-cols-2">
        {user.workshopId && can(a, "workshop") && (
          <Panel title="At my workshop" icon={<Factory size={15} aria-hidden />} count={atMyWorkshop.length} href="/planning/workshop">
            {atMyWorkshop.length ? atMyWorkshop.slice(0, 8).map((o) => <Row key={o.id} href={`/work-orders/${o.id}`} title={o.fullName} meta={`${o.stage}${o.stageState === "IN_PROGRESS" ? " · started" : " · waiting to start"}`} right={<PriorityBadge priority={o.priority} />} />) : <None text="Nothing is at your workshop's stages right now." />}
          </Panel>
        )}
        {canQc && (
          <Panel title="Waiting for your inspection" icon={<ClipboardCheck size={15} aria-hidden />} count={inspections.length} href="/quality">
            {inspections.length ? inspections.slice(0, 8).map((o) => <Row key={o.id} href="/quality" title={o.fullName} meta={`${o.stage} · qty ${o.qty}`} right={<PriorityBadge priority={o.priority} />} />) : <None text="No order is waiting for inspection." />}
          </Panel>
        )}
        {canPlan && (
          <Panel title="Ready to release" icon={<Rocket size={15} aria-hidden />} count={toRelease.length} href="/planning">
            {toRelease.length ? toRelease.slice(0, 8).map((o) => <Row key={o.id} href={`/work-orders/${o.id}`} title={o.fullName} meta={`Start ${fmtDay(o.startDate) || "not set"} · due ${fmtDay(o.dueDate) || "—"}`} right={<PriorityBadge priority={o.priority} />} />) : <None text="No planned order is due to start." />}
          </Panel>
        )}
        {canOt && (
          <Panel title="Overtime to decide" icon={<Clock size={15} aria-hidden />} count={overtime.length} href="/planning/notifications" tone="warn">
            {overtime.length ? overtime.map((r) => <Row key={r.id} href="/planning/notifications" title={`${r.operator.name} · ${fmtNum(r.hours, 1)} h`} meta={`${r.workshop.name} · ${fmtDay(r.date)} · ${r.reason}`} />) : <None text="No request is waiting." />}
          </Panel>
        )}
        {canStore && (
          <Panel title="Issue requests to process" icon={<PackageOpen size={15} aria-hidden />} count={issues.length} href="/inventory/issues" tone="warn">
            {issues.length ? issues.map((r) => <Row key={r.id} href="/inventory/issues" title={`${r.reqNo} · ${fmtNum(r.qtyKg, 1)} kg ${r.material.name}`} meta={`${r.workshop.name} · ${r.requestedBy}`} />) : <None text="No request is waiting." />}
          </Panel>
        )}
        {seesOrders && (
          <Panel title="Late orders" icon={<AlertTriangle size={15} aria-hidden />} count={late.length} href="/work-orders?f=late" tone="bad">
            {late.length ? late.slice(0, 8).map((o) => <Row key={o.id} href={`/work-orders/${o.id}`} title={o.fullName} meta={`${o.stage ?? "Not released"} · due ${fmtDay(o.dueDate)}`} right={<Badge tone="bad" plain>+{o.delayDays} d</Badge>} />) : <None text="Nothing is late." />}
          </Panel>
        )}
        {seesOrders && (
          <Panel title="Due in the next 7 days" icon={<CalendarClock size={15} aria-hidden />} count={dueSoon.length} href="/work-orders?f=due7">
            {dueSoon.length ? dueSoon.slice(0, 8).map((o) => <Row key={o.id} href={`/work-orders/${o.id}`} title={o.fullName} meta={`${o.stage ?? "Not released"} · due ${fmtDay(o.dueDate)}`} right={<StatusBadge status={o.status} />} />) : <None text="Nothing due this week." />}
          </Panel>
        )}
        {seesOrders && paused.length > 0 && (
          <Panel title="On hold / waiting" icon={<Hourglass size={15} aria-hidden />} count={paused.length} href="/work-orders?f=paused" tone="warn">
            {paused.slice(0, 8).map((o) => <Row key={o.id} href={`/work-orders/${o.id}`} title={o.fullName} right={<StatusBadge status={o.status} />} />)}
          </Panel>
        )}
        <Panel title="Mentions & notifications" icon={<AtSign size={15} aria-hidden />}>
          {mentions.length ? mentions.map((n) => <Row key={n.id} href={n.link} title={<span style={{ fontWeight: n.readAt ? 400 : 600 }}>{n.title}</span>} meta={`${fmtInstant(n.createdAt)}${n.body ? ` · ${n.body}` : ""}`} />) : <None text="Nothing new for you." />}
        </Panel>
      </div>
      {!tiles.length && <div className="card"><EmptyState icon={ClipboardList} title="Your account has no menus yet" hint="Ask the admin to give you access in Configuration → Users & Access." /></div>}
    </div>
  );
}
