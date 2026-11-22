// The dashboard's figures (System Documentation §11), worked out from the
// rows alone so every number on screen can be checked by hand.
//
//   open orders        not completed, not cancelled
//   delayed            open and past the due date
//   output vs plan %   pieces completed in the period ÷ pieces due in it
//   rejection rate %   (scrap logged + pieces QC rejected) ÷ (produced + scrap logged)
//   utilization %      hours machines worked on orders ÷ (active machines × days × hours a day)
//                      — setup and maintenance (no work order) do not count
//   avg delivery time  days from WO date to completion, completed in the period

import { addDays, daysBetween, dayKey, eachDay } from "./dates";
import { CLOSED_STATUSES, STATUS_LABEL, WO_STATUSES, type WoStatus } from "./status";

export interface KpiOrder {
  id: number;
  status: string;
  qty: number;
  woDate: Date;
  dueDate: Date | null;
  completedAt: Date | null;
  rawReqKg: number | null;
}
export interface KpiActivity {
  date: Date;
  workshopId: number;
  machineId: number | null;
  workOrderId: number | null;
  durationHrs: number;
  qtyProduced: number;
  qtyScrap: number;
  reason: string | null;
}
export interface KpiInspection {
  at: Date;
  qtyRejected: number;
  reason: string | null;
}
export interface KpiMachine {
  id: number;
  workshopId: number;
  active: boolean;
}
export interface KpiInput {
  orders: KpiOrder[];
  activities: KpiActivity[];
  inspections: KpiInspection[];
  overtimeHours: number;
  machines: KpiMachine[];
  workshops: { id: number; name: string }[];
  from: Date;
  to: Date;
  today: Date;
  machineHoursPerDay: number;
}

export interface Kpis {
  openOrders: number;
  activeOrders: number;
  completedToday: number;
  completedInPeriod: number;
  delayedOrders: number;
  materialRequiredKg: number;
  avgDeliveryDays: number | null;
  outputVsPlanPct: number | null;
  rejectionRatePct: number | null;
  utilizationPct: number | null;
  overtimeHours: number;
  producedQty: number;
  scrapQty: number;
  trend: { day: string; planned: number; produced: number }[];
  statusDistribution: { status: WoStatus; label: string; count: number }[];
  rejectionByReason: { reason: string; qty: number }[];
  utilizationByWorkshop: { workshop: string; pct: number; hours: number }[];
}

const inRange = (d: Date | null, from: Date, to: Date) => !!d && d.getTime() >= from.getTime() && d.getTime() < addDays(to, 1).getTime();
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const r1 = (v: number) => Math.round(v * 10) / 10;

/** The day a completion instant falls on (UTC day of the stored instant shifted to Cairo is close enough at day grain). */
const dayOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function computeKpis(input: KpiInput): Kpis {
  const { orders, activities, inspections, from, to, today } = input;
  const open = orders.filter((o) => !CLOSED_STATUSES.includes(o.status as WoStatus));
  const live = orders.filter((o) => o.status !== "CANCELLED");
  const activeStatuses = new Set(["IN_PRODUCTION", "UNDER_INSPECTION", "REWORK"]);

  const completed = orders.filter((o) => o.status === "COMPLETED" && o.completedAt);
  const completedInPeriod = completed.filter((o) => inRange(dayOf(o.completedAt!), from, to));
  const completedToday = completed.filter((o) => dayKey(dayOf(o.completedAt!)) === dayKey(today)).length;

  const dueInPeriod = live.filter((o) => inRange(o.dueDate, from, to));
  const plannedQty = dueInPeriod.reduce((s, o) => s + o.qty, 0);
  const doneQty = completedInPeriod.reduce((s, o) => s + o.qty, 0);

  const acts = activities.filter((a) => inRange(a.date, from, to));
  const produced = acts.reduce((s, a) => s + a.qtyProduced, 0);
  const scrap = acts.reduce((s, a) => s + a.qtyScrap, 0);
  const insp = inspections.filter((i) => inRange(dayOf(i.at), from, to));
  const qcRejected = insp.reduce((s, i) => s + i.qtyRejected, 0);

  const days = Math.max(1, daysBetween(from, to) + 1);
  const activeMachines = input.machines.filter((m) => m.active);
  const workedHours = (filter: (a: KpiActivity) => boolean) => acts.filter((a) => a.machineId !== null && a.workOrderId !== null && filter(a)).reduce((s, a) => s + a.durationHrs, 0);
  const capacity = (n: number) => n * days * input.machineHoursPerDay;

  const reasons = new Map<string, number>();
  for (const a of acts) if (a.qtyScrap > 0) reasons.set(a.reason ?? "Not given", (reasons.get(a.reason ?? "Not given") ?? 0) + a.qtyScrap);
  for (const i of insp) if (i.qtyRejected > 0) reasons.set(i.reason ?? "Not given", (reasons.get(i.reason ?? "Not given") ?? 0) + i.qtyRejected);

  const deliveryDays = completedInPeriod.map((o) => daysBetween(o.woDate, dayOf(o.completedAt!)));

  const trendDays = eachDay(from, to).slice(-62);
  const trend = trendDays.map((d) => {
    const k = dayKey(d);
    return {
      day: k,
      planned: live.filter((o) => o.dueDate && dayKey(o.dueDate) === k).reduce((s, o) => s + o.qty, 0),
      produced: completedInPeriod.filter((o) => dayKey(dayOf(o.completedAt!)) === k).reduce((s, o) => s + o.qty, 0),
    };
  });

  return {
    openOrders: open.length,
    activeOrders: open.filter((o) => activeStatuses.has(o.status)).length,
    completedToday,
    completedInPeriod: completedInPeriod.length,
    delayedOrders: open.filter((o) => o.dueDate && o.dueDate.getTime() < today.getTime()).length,
    materialRequiredKg: r1(open.reduce((s, o) => s + (o.rawReqKg ?? 0), 0)),
    avgDeliveryDays: deliveryDays.length ? r1(deliveryDays.reduce((s, v) => s + v, 0) / deliveryDays.length) : null,
    outputVsPlanPct: pct(doneQty, plannedQty),
    rejectionRatePct: pct(scrap + qcRejected, produced + scrap),
    utilizationPct: pct(workedHours(() => true), capacity(activeMachines.length)),
    overtimeHours: r1(input.overtimeHours),
    producedQty: produced,
    scrapQty: scrap + qcRejected,
    trend,
    statusDistribution: WO_STATUSES.map((s) => ({ status: s, label: STATUS_LABEL[s], count: orders.filter((o) => o.status === s).length })).filter((x) => x.count > 0),
    rejectionByReason: [...reasons.entries()].map(([reason, qty]) => ({ reason, qty })).sort((a, b) => b.qty - a.qty),
    utilizationByWorkshop: input.workshops
      .map((w) => {
        const n = activeMachines.filter((m) => m.workshopId === w.id).length;
        const hours = workedHours((a) => a.workshopId === w.id);
        return { workshop: w.name, hours: r1(hours), pct: pct(hours, capacity(n)) ?? 0, n };
      })
      .filter((w) => w.n > 0)
      .map(({ workshop, hours, pct: p }) => ({ workshop, hours, pct: p })),
  };
}
