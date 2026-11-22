// Moving a work order along its route (System Documentation §6.1, §8.1).
// Pure: given the order's state and its stages, an action gives the next
// state or a reason it is refused. The server applies the result in one
// transaction, checked against the version the screen was drawn on.
//
//   START            begin the current stage                → In Production
//   NEXT             finish it, move to the next stage      → In Production (waiting)
//                    a QC stage next                        → Under Inspection
//                    past the last stage                    → Completed
//   PREV             back one stage (to correct a mistake)
//   REWORK           redo the current stage                 → Rework
//   HOLD / WAIT_*    pause the order                        → On Hold / Waiting …
//   RESUME           back to where it was
//   QC_PASS          the inspector accepts — as NEXT from a QC stage
//   QC_REJECT_LAST   back to the stage before the QC stage  → Rework
//   QC_REJECT_START  back to the route's first stage        → Rework (re-cast)
//   CANCEL           close it without finishing             → Cancelled

import type { WoStatus } from "./status";

export interface StageInfo {
  name: string;
  qcRequired: boolean;
}

export interface WoState {
  status: WoStatus;
  stageIndex: number | null;
  stageState: "WAITING" | "IN_PROGRESS" | null;
  heldFrom: WoStatus | null;
}

export const STAGE_ACTIONS = [
  "START",
  "NEXT",
  "PREV",
  "REWORK",
  "HOLD",
  "WAIT_MATERIAL",
  "WAIT_TECH_OFFICE",
  "RESUME",
  "QC_PASS",
  "QC_REJECT_LAST",
  "QC_REJECT_START",
  "CANCEL",
] as const;
export type StageAction = (typeof STAGE_ACTIONS)[number];

export const ACTION_LABEL: Record<StageAction, string> = {
  START: "Start Stage",
  NEXT: "Next Stage",
  PREV: "Prev Stage",
  REWORK: "Rework",
  HOLD: "Put on hold",
  WAIT_MATERIAL: "Waiting material",
  WAIT_TECH_OFFICE: "Waiting technical office",
  RESUME: "Resume",
  QC_PASS: "Pass Stage",
  QC_REJECT_LAST: "Reject to Last",
  QC_REJECT_START: "Reject to Start",
  CANCEL: "Cancel order",
};

export type Transition = { ok: true; state: WoState; completed: boolean } | { ok: false; error: string };

const PAUSED: readonly WoStatus[] = ["ON_HOLD", "WAITING_MATERIAL", "WAITING_TECH_OFFICE"];

const fail = (error: string): Transition => ({ ok: false, error });
const go = (state: WoState, completed = false): Transition => ({ ok: true, state, completed });

/** The status an order has when it sits, waiting, at stage `i`. */
function arriveAt(stages: StageInfo[], i: number, rework = false): WoState {
  if (stages[i]?.qcRequired && !rework) return { status: "UNDER_INSPECTION", stageIndex: i, stageState: "WAITING", heldFrom: null };
  return { status: rework ? "REWORK" : "IN_PRODUCTION", stageIndex: i, stageState: "WAITING", heldFrom: null };
}

function advance(s: WoState, stages: StageInfo[]): Transition {
  const i = s.stageIndex ?? -1;
  const next = i + 1;
  if (next >= stages.length) return go({ status: "COMPLETED", stageIndex: stages.length - 1, stageState: null, heldFrom: null }, true);
  return go(arriveAt(stages, next));
}

export function transition(s: WoState, action: StageAction, stages: StageInfo[]): Transition {
  if (!stages.length) return fail("This order has no route — set up its process's routing in Master Data.");
  if (s.status === "COMPLETED") return fail("The order is already completed.");
  if (s.status === "CANCELLED") return fail("The order is cancelled.");
  const paused = PAUSED.includes(s.status);
  const i = s.stageIndex;
  const stage = i !== null ? stages[i] : null;

  switch (action) {
    case "CANCEL":
      return go({ ...s, status: "CANCELLED", stageState: null, heldFrom: null });

    case "HOLD":
    case "WAIT_MATERIAL":
    case "WAIT_TECH_OFFICE": {
      const to: WoStatus = action === "HOLD" ? "ON_HOLD" : action === "WAIT_MATERIAL" ? "WAITING_MATERIAL" : "WAITING_TECH_OFFICE";
      if (s.status === to) return fail("The order is already in that state.");
      return go({ ...s, status: to, heldFrom: paused ? s.heldFrom : s.status });
    }

    case "RESUME": {
      if (!paused) return fail("The order is not paused.");
      const back: WoStatus = s.heldFrom && !PAUSED.includes(s.heldFrom) ? s.heldFrom : i === null ? "PLANNED" : "IN_PRODUCTION";
      return go({ ...s, status: back, heldFrom: null });
    }
  }

  if (paused) return fail("Resume the order first.");

  switch (action) {
    case "START": {
      if (s.status === "UNDER_INSPECTION") return fail("The order is waiting for inspection — Quality passes or rejects it.");
      if (i === null) return go({ status: "IN_PRODUCTION", stageIndex: 0, stageState: "IN_PROGRESS", heldFrom: null });
      if (s.stageState === "IN_PROGRESS") return fail(`${stage?.name ?? "The stage"} is already started.`);
      return go({ status: "IN_PRODUCTION", stageIndex: i, stageState: "IN_PROGRESS", heldFrom: null });
    }

    case "NEXT": {
      if (i === null) return fail("Start the first stage first.");
      if (s.status === "UNDER_INSPECTION") return fail("A quality stage is passed by Quality Control, not from Planning.");
      return advance(s, stages);
    }

    case "PREV": {
      if (i === null) return fail("The order has not started.");
      if (i === 0) return fail("The order is already at its first stage.");
      return go(arriveAt(stages, i - 1));
    }

    case "REWORK": {
      if (i === null) return fail("The order has not started.");
      if (s.status === "UNDER_INSPECTION") return fail("Quality rejects an order under inspection.");
      return go({ status: "REWORK", stageIndex: i, stageState: "WAITING", heldFrom: null });
    }

    case "QC_PASS":
    case "QC_REJECT_LAST":
    case "QC_REJECT_START": {
      if (s.status !== "UNDER_INSPECTION" || i === null) return fail("The order is not waiting for inspection.");
      if (action === "QC_PASS") return advance(s, stages);
      const to = action === "QC_REJECT_START" ? 0 : Math.max(0, i - 1);
      return go(arriveAt(stages, to, true));
    }
  }
  return fail("Unknown action.");
}

/** The actions worth offering on a card, in the order they show. */
export function availableActions(s: WoState, stages: StageInfo[]): StageAction[] {
  const candidates: StageAction[] = ["START", "NEXT", "PREV", "REWORK", "RESUME", "HOLD", "WAIT_MATERIAL", "WAIT_TECH_OFFICE", "CANCEL"];
  return candidates.filter((a) => transition(s, a, stages).ok);
}

export function stageNameAt(stages: StageInfo[], i: number | null): string | null {
  return i === null ? null : (stages[i]?.name ?? null);
}
