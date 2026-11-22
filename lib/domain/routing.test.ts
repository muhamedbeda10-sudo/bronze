import { describe, expect, it } from "vitest";
import { availableActions, transition, type StageInfo, type WoState } from "./routing";

const STAGES: StageInfo[] = [
  { name: "Mold Prepare", qcRequired: false },
  { name: "Melting & Pouring", qcRequired: false },
  { name: "Quality", qcRequired: true },
  { name: "Machining", qcRequired: false },
];
const planned: WoState = { status: "PLANNED", stageIndex: null, stageState: null, heldFrom: null };

function run(s: WoState, ...actions: Parameters<typeof transition>[1][]) {
  let cur = s;
  for (const a of actions) {
    const t = transition(cur, a, STAGES);
    if (!t.ok) throw new Error(`${a}: ${t.error}`);
    cur = t.state;
  }
  return cur;
}

describe("transition", () => {
  it("starts the first stage of a planned order", () => {
    expect(run(planned, "START")).toEqual({ status: "IN_PRODUCTION", stageIndex: 0, stageState: "IN_PROGRESS", heldFrom: null });
  });

  it("moves to the next stage, waiting to be started", () => {
    expect(run(planned, "START", "NEXT")).toMatchObject({ stageIndex: 1, stageState: "WAITING", status: "IN_PRODUCTION" });
  });

  it("lands a QC stage under inspection, which planning cannot pass", () => {
    const s = run(planned, "START", "NEXT", "START", "NEXT");
    expect(s).toMatchObject({ status: "UNDER_INSPECTION", stageIndex: 2 });
    expect(transition(s, "NEXT", STAGES).ok).toBe(false);
    expect(transition(s, "START", STAGES).ok).toBe(false);
  });

  it("QC pass moves on; reject to last and to start send it back as rework", () => {
    const atQc = run(planned, "START", "NEXT", "START", "NEXT");
    expect(run(atQc, "QC_PASS")).toMatchObject({ status: "IN_PRODUCTION", stageIndex: 3 });
    expect(run(atQc, "QC_REJECT_LAST")).toMatchObject({ status: "REWORK", stageIndex: 1, stageState: "WAITING" });
    expect(run(atQc, "QC_REJECT_START")).toMatchObject({ status: "REWORK", stageIndex: 0 });
    // a rework restarts into production
    expect(run(atQc, "QC_REJECT_LAST", "START")).toMatchObject({ status: "IN_PRODUCTION", stageIndex: 1, stageState: "IN_PROGRESS" });
  });

  it("completes after the last stage", () => {
    const atLast = run(planned, "START", "NEXT", "NEXT", "QC_PASS");
    const t = transition(atLast, "NEXT", STAGES);
    expect(t.ok && t.completed).toBe(true);
    expect(t.ok && t.state.status).toBe("COMPLETED");
  });

  it("a route ending on a QC stage completes on QC pass", () => {
    const stages: StageInfo[] = [{ name: "Cast", qcRequired: false }, { name: "Final QC", qcRequired: true }];
    const s1 = transition(planned, "START", stages);
    const s2 = s1.ok && transition(s1.state, "NEXT", stages);
    const s3 = s2 && s2.ok && transition(s2.state, "QC_PASS", stages);
    expect(s3 && s3.ok && s3.completed).toBe(true);
  });

  it("goes back one stage, never before the first", () => {
    expect(run(planned, "START", "NEXT", "PREV")).toMatchObject({ stageIndex: 0, stageState: "WAITING" });
    expect(transition(run(planned, "START"), "PREV", STAGES).ok).toBe(false);
  });

  it("holds and resumes to the status it had", () => {
    const s = run(planned, "START", "REWORK", "HOLD");
    expect(s).toMatchObject({ status: "ON_HOLD", heldFrom: "REWORK" });
    expect(transition(s, "NEXT", STAGES).ok).toBe(false);
    expect(run(s, "WAIT_MATERIAL")).toMatchObject({ status: "WAITING_MATERIAL", heldFrom: "REWORK" });
    expect(run(s, "RESUME")).toMatchObject({ status: "REWORK", heldFrom: null });
    expect(run(planned, "WAIT_MATERIAL", "RESUME")).toMatchObject({ status: "PLANNED" });
  });

  it("refuses anything on a closed order", () => {
    const done: WoState = { status: "COMPLETED", stageIndex: 3, stageState: null, heldFrom: null };
    expect(transition(done, "PREV", STAGES).ok).toBe(false);
    expect(transition(run(planned, "CANCEL"), "START", STAGES).ok).toBe(false);
  });

  it("refuses an order with no route", () => {
    expect(transition(planned, "START", []).ok).toBe(false);
  });

  it("offers only the actions that would work", () => {
    expect(availableActions(planned, STAGES)).toEqual(["START", "HOLD", "WAIT_MATERIAL", "WAIT_TECH_OFFICE", "CANCEL"]);
    const atQc = run(planned, "START", "NEXT", "START", "NEXT");
    expect(availableActions(atQc, STAGES)).not.toContain("NEXT");
  });
});
