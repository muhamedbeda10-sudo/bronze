import "server-only";
import { prisma } from "@/lib/db";
import { getSettings } from "./settings";
import { addDays, dayKey, daysBetween, delayDays } from "@/lib/domain/dates";
import { delivery, efficiency, machineUse, pctOf, plannedHours } from "@/lib/domain/reports";
import { STATUS_LABEL, PRIORITY_LABEL, type WoStatus } from "@/lib/domain/status";

export const REPORTS = [
  { key: "wo-status", label: "Work Order Status", question: "Where is every order now?" },
  { key: "efficiency", label: "Production Efficiency", question: "Planned vs actual times and yields" },
  { key: "machines", label: "Machine Utilization", question: "Uptime, downtime, capacity use per machine" },
  { key: "material", label: "Material Consumption", question: "Raw material used, scrap, yield %" },
  { key: "scrap", label: "Scrap Analysis", question: "Scrap by material, process and rejection reason" },
  { key: "delivery", label: "Delivery Performance", question: "On-time delivery and lead times" },
] as const;
export type ReportKey = (typeof REPORTS)[number]["key"];

export type Cell = string | number | null;
export interface ReportCol { key: string; label: string; num?: boolean; dp?: number; pct?: boolean }
export interface Report { cols: ReportCol[]; rows: Record<string, Cell>[]; summary: { label: string; value: string }[] }

const fmt = (v: number | null, unit = "") => (v === null ? "—" : `${Math.round(v * 10) / 10}${unit}`);

export async function buildReport(key: ReportKey, from: Date, to: Date, today: Date): Promise<Report> {
  const end = addDays(to, 1);
  const inPeriod = { gte: from, lt: end };
  switch (key) {
    case "wo-status": {
      const orders = await prisma.workOrder.findMany({
        where: { OR: [{ status: { notIn: ["COMPLETED", "CANCELLED"] } }, { woDate: inPeriod }, { completedAt: inPeriod }] },
        include: { process: true, stages: { orderBy: { seq: "asc" }, include: { workshop: true } } },
        orderBy: [{ dueDate: "asc" }, { woNo: "asc" }],
      });
      const rows = orders.map((o) => {
        const st = o.stageIndex !== null ? o.stages[o.stageIndex] : null;
        const done = o.completedAt ? new Date(Date.UTC(o.completedAt.getUTCFullYear(), o.completedAt.getUTCMonth(), o.completedAt.getUTCDate())) : null;
        return {
          wo: `${o.woNo}-${o.lineNo}`, name: o.fullName, process: o.process.name,
          stage: o.status === "COMPLETED" ? "Complete" : (st?.name ?? "Not released"), workshop: st?.workshop?.name ?? "",
          status: STATUS_LABEL[o.status as WoStatus] ?? o.status, priority: PRIORITY_LABEL[o.priority] ?? "", qty: o.qty,
          due: dayKey(o.dueDate), delay: o.status === "CANCELLED" ? 0 : delayDays(o.dueDate, done, today),
        };
      });
      const open = orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED");
      return {
        cols: [
          { key: "wo", label: "WO" }, { key: "name", label: "Full name" }, { key: "process", label: "Process" }, { key: "stage", label: "Current stage" },
          { key: "workshop", label: "Workshop" }, { key: "status", label: "Status" }, { key: "priority", label: "Priority" }, { key: "qty", label: "Qty", num: true },
          { key: "due", label: "Due date" }, { key: "delay", label: "Delay days", num: true },
        ],
        rows,
        summary: [
          { label: "Open lines", value: String(open.length) },
          { label: "Delayed", value: String(open.filter((o) => o.dueDate && o.dueDate < today).length) },
          { label: "Under inspection", value: String(open.filter((o) => o.status === "UNDER_INSPECTION").length) },
          { label: "On hold / waiting", value: String(open.filter((o) => ["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"].includes(o.status)).length) },
        ],
      };
    }

    case "efficiency": {
      const acts = await prisma.activity.findMany({ where: { date: inPeriod, workOrderId: { not: null } }, select: { workOrderId: true, durationHrs: true, qtyProduced: true, qtyScrap: true } });
      const ids = [...new Set(acts.map((a) => a.workOrderId!))];
      const orders = await prisma.workOrder.findMany({ where: { id: { in: ids } }, include: { process: true, stages: true } });
      const rows = orders.map((o) => {
        const mine = acts.filter((a) => a.workOrderId === o.id);
        const e = efficiency(
          plannedHours(o.qty, o.stages, o.stageIndex, o.status === "COMPLETED"),
          mine.reduce((s, a) => s + a.durationHrs, 0),
          mine.reduce((s, a) => s + a.qtyProduced, 0),
          mine.reduce((s, a) => s + a.qtyScrap, 0),
        );
        return { wo: `${o.woNo}-${o.lineNo}`, name: o.fullName, process: o.process.name, status: STATUS_LABEL[o.status as WoStatus] ?? o.status, ...e };
      });
      const planned = rows.reduce((s, r) => s + r.plannedHrs, 0);
      const actual = rows.reduce((s, r) => s + r.actualHrs, 0);
      const good = rows.reduce((s, r) => s + r.produced, 0);
      const bad = rows.reduce((s, r) => s + r.scrap, 0);
      return {
        cols: [
          { key: "wo", label: "WO" }, { key: "name", label: "Full name" }, { key: "process", label: "Process" }, { key: "status", label: "Status" },
          { key: "plannedHrs", label: "Planned hrs", num: true, dp: 2 }, { key: "actualHrs", label: "Actual hrs", num: true, dp: 2 }, { key: "efficiencyPct", label: "Efficiency", num: true, pct: true },
          { key: "produced", label: "Produced", num: true }, { key: "scrap", label: "Scrap", num: true }, { key: "yieldPct", label: "Yield", num: true, pct: true },
        ],
        rows,
        summary: [
          { label: "Planned hours (stages passed)", value: fmt(planned) },
          { label: "Actual hours logged", value: fmt(actual) },
          { label: "Efficiency", value: fmt(pctOf(planned, actual), "%") },
          { label: "Yield", value: fmt(pctOf(good, good + bad), "%") },
        ],
      };
    }

    case "machines": {
      const settings = await getSettings();
      const days = Math.max(1, daysBetween(from, to) + 1);
      const [machines, acts] = await Promise.all([
        prisma.machine.findMany({ include: { workshop: true }, orderBy: { code: "asc" } }),
        prisma.activity.findMany({ where: { date: inPeriod, machineId: { not: null } }, select: { machineId: true, workOrderId: true, durationHrs: true } }),
      ]);
      const rows = machines.map((m) => {
        const mine = acts.filter((a) => a.machineId === m.id);
        const u = machineUse(m.status === "Active", days, settings.machineHoursPerDay, mine.filter((a) => a.workOrderId).reduce((s, a) => s + a.durationHrs, 0), mine.filter((a) => !a.workOrderId).reduce((s, a) => s + a.durationHrs, 0));
        return { code: m.code, name: m.name, workshop: m.workshop.name, status: m.status, ...u };
      });
      const avail = rows.reduce((s, r) => s + r.availableHrs, 0);
      const used = rows.reduce((s, r) => s + r.orderHrs, 0);
      return {
        cols: [
          { key: "code", label: "Machine ID" }, { key: "name", label: "Machine" }, { key: "workshop", label: "Workshop" }, { key: "status", label: "Status" },
          { key: "availableHrs", label: "Available hrs", num: true }, { key: "orderHrs", label: "Uptime (orders) hrs", num: true, dp: 2 }, { key: "setupHrs", label: "Setup / maint. hrs", num: true, dp: 2 },
          { key: "idleHrs", label: "Idle hrs", num: true, dp: 2 }, { key: "utilizationPct", label: "Utilization", num: true, pct: true },
        ],
        rows,
        summary: [
          { label: "Days in period", value: String(days) },
          { label: `Hours a machine-day`, value: String(settings.machineHoursPerDay) },
          { label: "Overall utilization", value: fmt(pctOf(used, avail), "%") },
        ],
      };
    }

    case "material": {
      const [materials, moves, required, completed, acts, insp] = await Promise.all([
        prisma.material.findMany({ orderBy: { code: "asc" } }),
        prisma.stockMove.findMany({ where: { at: inPeriod, reason: "ISSUE" }, include: { stockRow: { select: { materialId: true } } } }),
        prisma.workOrder.groupBy({ by: ["materialId"], where: { woDate: inPeriod, status: { not: "CANCELLED" } }, _sum: { rawReqKg: true } }),
        prisma.workOrder.groupBy({ by: ["materialId"], where: { completedAt: inPeriod, status: "COMPLETED" }, _sum: { totalWeightKg: true, qty: true } }),
        prisma.activity.findMany({ where: { date: inPeriod, qtyScrap: { gt: 0 } }, select: { qtyScrap: true, workOrder: { select: { materialId: true, unitWeightKg: true } } } }),
        prisma.inspection.findMany({ where: { at: inPeriod, qtyRejected: { gt: 0 } }, select: { qtyRejected: true, workOrder: { select: { materialId: true, unitWeightKg: true } } } }),
      ]);
      const rows = materials.map((m) => {
        const issued = -moves.filter((x) => x.stockRow.materialId === m.id).reduce((s, x) => s + x.delta, 0);
        const req = required.find((r) => r.materialId === m.id)?._sum.rawReqKg ?? 0;
        const fin = completed.find((r) => r.materialId === m.id)?._sum.totalWeightKg ?? 0;
        const scrapKg = [...acts.map((a) => ({ q: a.qtyScrap, w: a.workOrder })), ...insp.map((i) => ({ q: i.qtyRejected, w: i.workOrder }))]
          .filter((x) => x.w?.materialId === m.id)
          .reduce((s, x) => s + x.q * (x.w?.unitWeightKg ?? 0), 0);
        return { code: m.code, name: m.name, requiredKg: Math.round(req * 10) / 10, issuedKg: Math.round(issued * 10) / 10, finishedKg: Math.round(fin * 10) / 10, scrapKg: Math.round(scrapKg * 10) / 10, yieldPct: pctOf(fin, issued) };
      }).filter((r) => r.requiredKg || r.issuedKg || r.finishedKg || r.scrapKg);
      const iss = rows.reduce((s, r) => s + r.issuedKg, 0);
      const fin = rows.reduce((s, r) => s + r.finishedKg, 0);
      return {
        cols: [
          { key: "code", label: "Material code" }, { key: "name", label: "Material" }, { key: "requiredKg", label: "Required kg (new WOs)", num: true, dp: 1 },
          { key: "issuedKg", label: "Issued kg", num: true, dp: 1 }, { key: "finishedKg", label: "Finished kg (completed)", num: true, dp: 1 },
          { key: "scrapKg", label: "Scrap kg (est.)", num: true, dp: 1 }, { key: "yieldPct", label: "Metal yield", num: true, pct: true },
        ],
        rows,
        summary: [
          { label: "Metal issued", value: `${fmt(iss)} kg` },
          { label: "Finished weight", value: `${fmt(fin)} kg` },
          { label: "Metal yield", value: fmt(pctOf(fin, iss), "%") },
        ],
      };
    }

    case "scrap": {
      const [acts, insp] = await Promise.all([
        prisma.activity.findMany({ where: { date: inPeriod, qtyScrap: { gt: 0 } }, select: { qtyScrap: true, rejectionReason: true, workshop: true, workOrder: { include: { material: true, process: true } } } }),
        prisma.inspection.findMany({ where: { at: inPeriod, qtyRejected: { gt: 0 } }, select: { qtyRejected: true, rejectionReason: true, workOrder: { include: { material: true, process: true } } } }),
      ]);
      const map = new Map<string, { reason: string; material: string; process: string; source: string; qty: number; kg: number }>();
      const add = (reason: string, material: string, process: string, source: string, qty: number, unitKg: number) => {
        const k = [reason, material, process, source].join("|");
        const cur = map.get(k) ?? { reason, material, process, source, qty: 0, kg: 0 };
        cur.qty += qty;
        cur.kg = Math.round((cur.kg + qty * unitKg) * 10) / 10;
        map.set(k, cur);
      };
      for (const a of acts) add(a.rejectionReason?.name ?? "Not given", a.workOrder?.material.name ?? "—", a.workOrder?.process.name ?? "—", `Floor: ${a.workshop.name}`, a.qtyScrap, a.workOrder?.unitWeightKg ?? 0);
      for (const i of insp) add(i.rejectionReason?.name ?? "Not given", i.workOrder.material.name, i.workOrder.process.name, "QC rejection", i.qtyRejected, i.workOrder.unitWeightKg ?? 0);
      const rows = [...map.values()].sort((a, b) => b.qty - a.qty);
      const total = rows.reduce((s, r) => s + r.qty, 0);
      const byReason = new Map<string, number>();
      rows.forEach((r) => byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + r.qty));
      const top = [...byReason].sort((a, b) => b[1] - a[1])[0];
      return {
        cols: [{ key: "reason", label: "Rejection reason" }, { key: "material", label: "Material" }, { key: "process", label: "Process" }, { key: "source", label: "Found at" }, { key: "qty", label: "Pieces", num: true }, { key: "kg", label: "Weight kg (est.)", num: true, dp: 1 }],
        rows,
        summary: [
          { label: "Pieces scrapped / rejected", value: String(total) },
          { label: "Top reason", value: top ? `${top[0]} (${top[1]})` : "—" },
        ],
      };
    }

    case "delivery": {
      const orders = await prisma.workOrder.findMany({ where: { status: "COMPLETED", completedAt: inPeriod }, include: { process: true }, orderBy: { completedAt: "asc" } });
      const rows = orders.map((o) => {
        const d = delivery(o.woDate, o.completedAt!, o.dueDate);
        return { wo: `${o.woNo}-${o.lineNo}`, name: o.fullName, process: o.process.name, woDate: dayKey(o.woDate), due: dayKey(o.dueDate), completed: dayKey(o.completedAt), lead: d.leadDays, onTime: d.onTime === null ? "No due date" : d.onTime ? "Yes" : "No", delay: d.delayDays };
      });
      const judged = rows.filter((r) => r.onTime !== "No due date");
      return {
        cols: [
          { key: "wo", label: "WO" }, { key: "name", label: "Full name" }, { key: "process", label: "Process" }, { key: "woDate", label: "WO date" },
          { key: "due", label: "Due date" }, { key: "completed", label: "Completed" }, { key: "lead", label: "Lead time (days)", num: true },
          { key: "onTime", label: "On time" }, { key: "delay", label: "Delay days", num: true },
        ],
        rows,
        summary: [
          { label: "Completed lines", value: String(rows.length) },
          { label: "On-time delivery", value: fmt(pctOf(judged.filter((r) => r.onTime === "Yes").length, judged.length), "%") },
          { label: "Average lead time", value: rows.length ? `${fmt(rows.reduce((s, r) => s + r.lead, 0) / rows.length)} days` : "—" },
        ],
      };
    }
  }
}
