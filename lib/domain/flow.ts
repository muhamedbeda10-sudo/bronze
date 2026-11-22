// The pieces flow: an order moves by quantities, not as one block.
// Each stage records what it finished (good) and what it lost (scrap) in the
// StageOutput ledger; nothing else is typed. From those rows alone:
//
//   arrived(0)  = the order's qty (once released)
//   arrived(s)  = good(s − 1) — what the stage before handed over
//   waiting(s)  = arrived(s) − good(s) − scrap(s)
//
// so one order can have pieces waiting at several stages at once. Always
//   qty = Σ waiting + Σ scrap + good(last)
// and the order is complete when nothing waits anywhere.
// The order's single "current stage" (for the lists, Kanban, Gantt) is the
// earliest stage with pieces waiting; its status follows (lib/domain/routing.ts
// still guards the paused and closed states).

import type { WoStatus } from "./status";

export interface FlowStageDef {
  seq: number;
  name: string;
  workshopId: number | null;
  qcRequired: boolean;
}

export interface OutputRow {
  seq: number;
  good: number;
  scrap: number;
}

export interface StageFlow extends FlowStageDef {
  arrived: number;
  good: number;
  scrap: number;
  waiting: number;
}

/** Every stage's numbers, in route order. */
export function flowOf(qty: number, stages: FlowStageDef[], outputs: OutputRow[]): StageFlow[] {
  const sum = new Map<number, { good: number; scrap: number }>();
  for (const o of outputs) {
    const t = sum.get(o.seq) ?? { good: 0, scrap: 0 };
    t.good += o.good;
    t.scrap += o.scrap;
    sum.set(o.seq, t);
  }
  const sorted = [...stages].sort((a, b) => a.seq - b.seq);
  const out: StageFlow[] = [];
  let arrived = qty;
  for (const s of sorted) {
    const t = sum.get(s.seq) ?? { good: 0, scrap: 0 };
    out.push({ ...s, arrived, good: t.good, scrap: t.scrap, waiting: arrived - t.good - t.scrap });
    arrived = t.good;
  }
  return out;
}

/**
 * Why a record of `good` and `scrap` pieces at stage `seq` cannot be taken,
 * or null when it can. Negative numbers take pieces back (a correction).
 */
export function checkOutput(flow: StageFlow[], seq: number, good: number, scrap: number): string | null {
  const i = flow.findIndex((f) => f.seq === seq);
  const f = flow[i];
  if (!f) return "That stage is not on the order's route.";
  if (!Number.isInteger(good) || !Number.isInteger(scrap)) return "Quantities are whole pieces.";
  if (good === 0 && scrap === 0) return "Enter the pieces finished or scrapped.";
  const g = f.good + good;
  const sc = f.scrap + scrap;
  if (g < 0) return `${f.name} has finished only ${f.good} piece${f.good === 1 ? "" : "s"} — it cannot take back ${-good}.`;
  if (sc < 0) return `${f.name} has scrapped only ${f.scrap} piece${f.scrap === 1 ? "" : "s"} — it cannot take back ${-scrap}.`;
  if (g + sc > f.arrived) {
    const room = f.waiting;
    return room > 0
      ? `Only ${room} piece${room === 1 ? " is" : "s are"} waiting at ${f.name}.`
      : `No pieces are waiting at ${f.name}${i > 0 ? ` — ${flow[i - 1]!.name} has to finish them first` : ""}.`;
  }
  const next = flow[i + 1];
  if (next && g < next.good + next.scrap) {
    const used = next.good + next.scrap;
    return `${used} piece${used === 1 ? " has" : "s have"} already moved on to ${next.name} — take them back there first.`;
  }
  return null;
}

/** A tracker cell takes the stage's new total; the ledger takes the difference. */
export function totalToDelta(flow: StageFlow[], seq: number, newTotal: number): number {
  const f = flow.find((x) => x.seq === seq);
  return f ? newTotal - f.good : 0;
}

export interface FlowSummary {
  /** the earliest stage with pieces waiting (index into the route), null when none */
  stageIndex: number | null;
  /** some piece has been finished or scrapped somewhere */
  started: boolean;
  /** nothing waits anywhere — every piece finished the route or was scrapped */
  completed: boolean;
  /** the current stage has already finished some of its pieces */
  inProgress: boolean;
  finished: number;
  scrap: number;
  waiting: number;
  /** finished pieces ÷ order qty, 0–100 */
  progressPct: number;
}

export function summarize(flow: StageFlow[], qty: number): FlowSummary {
  const idx = flow.findIndex((f) => f.waiting > 0);
  const started = flow.some((f) => f.good !== 0 || f.scrap !== 0);
  const waiting = flow.reduce((a, f) => a + Math.max(0, f.waiting), 0);
  const scrap = flow.reduce((a, f) => a + f.scrap, 0);
  const finished = flow.length ? flow[flow.length - 1]!.good : 0;
  const cur = idx >= 0 ? flow[idx]! : null;
  return {
    stageIndex: idx >= 0 ? idx : null,
    started,
    completed: started && waiting === 0,
    inProgress: !!cur && (cur.good > 0 || cur.scrap > 0),
    finished,
    scrap,
    waiting,
    progressPct: qty > 0 ? Math.round((finished / qty) * 100) : 0,
  };
}

const PAUSED: readonly string[] = ["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"];

/**
 * The order's status once the ledger has moved: complete when nothing waits,
 * under inspection when the earliest waiting pieces sit at a quality stage,
 * otherwise in production — a rework keeps its label while it stays at the
 * stage it was sent back to. Paused, closed and not-released orders keep theirs.
 */
export function statusAfter(prev: { status: WoStatus; stageIndex: number | null }, s: FlowSummary, flow: StageFlow[]): WoStatus {
  if (prev.status === "CANCELLED" || prev.status === "COMPLETED") return prev.status;
  if (PAUSED.includes(prev.status)) return prev.status;
  if (s.completed) return "COMPLETED";
  if (prev.status === "PLANNED" && !s.started) return "PLANNED";
  const cur = s.stageIndex !== null ? flow[s.stageIndex] : null;
  if (cur?.qcRequired) return "UNDER_INSPECTION";
  if (prev.status === "REWORK" && prev.stageIndex === s.stageIndex) return "REWORK";
  return "IN_PRODUCTION";
}

/** The pieces waiting at a stage as one lot on the floor. */
export interface Lot {
  seq: number;
  stageIndex: number;
  name: string;
  workshopId: number | null;
  qcRequired: boolean;
  waiting: number;
  arrived: number;
  good: number;
  scrap: number;
}

/** Where an order's pieces stand: one lot per stage that has pieces waiting. */
export function lotsOf(flow: StageFlow[]): Lot[] {
  return flow.flatMap((f, i) => (f.waiting > 0 ? [{ seq: f.seq, stageIndex: i, name: f.name, workshopId: f.workshopId, qcRequired: f.qcRequired, waiting: f.waiting, arrived: f.arrived, good: f.good, scrap: f.scrap }] : []));
}

/** Whole days between the day a lot's pieces last arrived and today (never below 0). */
export function waitedDays(arrivedOn: string | null, todayKey: string): number | null {
  if (!arrivedOn) return null;
  const d = Math.round((Date.parse(todayKey) - Date.parse(arrivedOn)) / 86_400_000);
  return d > 0 ? d : 0;
}

/** fresh · 3 days and more · a week and more */
export function waitTone(days: number | null): "ok" | "warn" | "bad" | "neutral" {
  if (days === null) return "neutral";
  return days >= 7 ? "bad" : days >= 3 ? "warn" : "ok";
}
