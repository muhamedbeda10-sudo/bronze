import "server-only";
import { prisma } from "@/lib/db";
import { dayKey, delayDays, today, todayKey } from "@/lib/domain/dates";
import { flowOf, lotsOf, summarize, waitedDays, type StageFlow } from "@/lib/domain/flow";

// What the Plan Tracker and the workshop floor read: the open orders with
// their pieces ledger, worked out by lib/domain/flow.ts.

const OPEN = ["PLANNED", "IN_PRODUCTION", "UNDER_INSPECTION", "REWORK", "ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"];
const PAUSED = ["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"];

async function openOrders() {
  return prisma.workOrder.findMany({
    where: { status: { in: OPEN } },
    include: {
      product: true,
      material: true,
      process: true,
      stages: { orderBy: { seq: "asc" }, include: { workshop: true } },
      outputs: { select: { seq: true, good: true, scrap: true, date: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { woNo: "asc" }, { lineNo: "asc" }],
  });
}
type Open = Awaited<ReturnType<typeof openOrders>>[number];

function base(w: Open, t: Date) {
  const delay = delayDays(w.dueDate, null, t);
  return {
    id: w.id,
    code: `${w.woNo}-${w.lineNo}`,
    fullName: w.fullName,
    product: w.product.name,
    material: w.material.name,
    process: w.process.name,
    qty: w.qty,
    priority: w.priority,
    status: w.status,
    dueDate: dayKey(w.dueDate),
    late: delay > 0,
    released: !(w.status === "PLANNED" && w.stageIndex === null),
    paused: PAUSED.includes(w.status),
  };
}

const defs = (w: Open) => w.stages.map((s) => ({ seq: s.seq, name: s.name, workshopId: s.workshopId, qcRequired: s.qcRequired }));

/** The day the pieces now waiting at each stage last arrived: the last day the stage before handed some over. */
function arrivals(w: Open, flow: StageFlow[]): Map<number, string | null> {
  const lastGood = new Map<number, string>();
  for (const o of w.outputs) if (o.good > 0) { const k = dayKey(o.date); if ((lastGood.get(o.seq) ?? "") < k) lastGood.set(o.seq, k); }
  const m = new Map<number, string | null>();
  flow.forEach((f, i) => m.set(f.seq, i === 0 ? (w.startedAt ? dayKey(w.startedAt) : null) : (lastGood.get(flow[i - 1]!.seq) ?? null)));
  return m;
}

export interface TrackerCell { seq: number; arrived: number; good: number; scrap: number; waiting: number }
export interface TrackerRow extends ReturnType<typeof base> { cells: TrackerCell[]; finished: number; scrap: number; progressPct: number }
export interface TrackerGroup {
  key: string;
  route: string;
  stages: { seq: number; name: string; workshop: string | null; workshopId: number | null; qc: boolean }[];
  rows: TrackerRow[];
}

/** The Plan Tracker: one table per route (its stages as columns), one row per open order. */
export async function getTracker(): Promise<TrackerGroup[]> {
  const t = today();
  const groups = new Map<string, TrackerGroup>();
  for (const w of await openOrders()) {
    if (!w.stages.length) continue;
    const key = w.stages.map((s) => `${s.name}|${s.workshopId ?? ""}|${s.qcRequired ? 1 : 0}`).join(">");
    let g = groups.get(key);
    if (!g) {
      g = { key, route: `${w.process.name} · ${w.process.routeCode}`, stages: w.stages.map((s) => ({ seq: s.seq, name: s.name, workshop: s.workshop?.name ?? null, workshopId: s.workshopId, qc: s.qcRequired })), rows: [] };
      groups.set(key, g);
    } else if (!g.route.includes(w.process.name)) {
      g.route = `${g.route.split(" · ")[0]}, ${w.process.name} · ${g.route.split(" · ").slice(1).join(" · ")}`;
    }
    const flow = flowOf(w.qty, defs(w), w.outputs);
    const s = summarize(flow, w.qty);
    g.rows.push({ ...base(w, t), cells: flow.map((f) => ({ seq: f.seq, arrived: f.arrived, good: f.good, scrap: f.scrap, waiting: f.waiting })), finished: s.finished, scrap: s.scrap, progressPct: s.progressPct });
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);
}

export interface FloorLot extends ReturnType<typeof base> {
  seq: number;
  stage: string;
  stageIndex: number;
  stageCount: number;
  qc: boolean;
  workshopId: number | null;
  waiting: number;
  arrived: number;
  good: number;
  scrap: number;
  since: string | null;
  waited: number | null;
  from: string | null;
  next: string | null;
}

/** The pieces waiting on the floor, one lot per order and stage (released orders only). */
export async function getFloorLots(): Promise<FloorLot[]> {
  const t = today();
  const tk = todayKey();
  const out: FloorLot[] = [];
  for (const w of await openOrders()) {
    const b = base(w, t);
    if (!b.released || !w.stages.length) continue;
    const flow = flowOf(w.qty, defs(w), w.outputs);
    const arr = arrivals(w, flow);
    for (const l of lotsOf(flow)) {
      const since = arr.get(l.seq) ?? null;
      out.push({ ...b, seq: l.seq, stage: l.name, stageIndex: l.stageIndex, stageCount: flow.length, qc: l.qcRequired, workshopId: l.workshopId, waiting: l.waiting, arrived: l.arrived, good: l.good, scrap: l.scrap, since, waited: waitedDays(since, tk), from: l.stageIndex > 0 ? flow[l.stageIndex - 1]!.name : null, next: flow[l.stageIndex + 1]?.name ?? null });
    }
  }
  return out;
}
