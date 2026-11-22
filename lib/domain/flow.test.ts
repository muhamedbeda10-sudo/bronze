import { describe, expect, it } from "vitest";
import { checkOutput, flowOf, lotsOf, statusAfter, summarize, totalToDelta, waitTone, waitedDays, type FlowStageDef } from "./flow";

const ROUTE: FlowStageDef[] = [
  { seq: 0, name: "Molding", workshopId: 1, qcRequired: false },
  { seq: 1, name: "Pouring", workshopId: 2, qcRequired: false },
  { seq: 2, name: "Quality", workshopId: 3, qcRequired: true },
  { seq: 3, name: "Machining", workshopId: 4, qcRequired: false },
];

describe("flowOf", () => {
  it("hands each stage what the one before finished", () => {
    const f = flowOf(50, ROUTE, [{ seq: 0, good: 50, scrap: 0 }, { seq: 1, good: 30, scrap: 2 }, { seq: 2, good: 10, scrap: 0 }]);
    expect(f.map((s) => [s.arrived, s.good, s.scrap, s.waiting])).toEqual([[50, 50, 0, 0], [50, 30, 2, 18], [30, 10, 0, 20], [10, 0, 0, 10]]);
    // qty = Σ waiting + Σ scrap + good(last)
    expect(f.reduce((a, s) => a + s.waiting + s.scrap, 0) + f[3]!.good).toBe(50);
  });
  it("sums several rows of a stage, corrections included", () => {
    const f = flowOf(20, ROUTE, [{ seq: 0, good: 12, scrap: 0 }, { seq: 0, good: 8, scrap: 0 }, { seq: 0, good: -3, scrap: 1 }]);
    expect(f[0]).toMatchObject({ good: 17, scrap: 1, waiting: 2 });
    expect(f[1]).toMatchObject({ arrived: 17, waiting: 17 });
  });
});

describe("checkOutput", () => {
  const f = flowOf(50, ROUTE, [{ seq: 0, good: 50, scrap: 0 }, { seq: 1, good: 30, scrap: 0 }, { seq: 2, good: 10, scrap: 0 }]);
  it("takes what is waiting", () => {
    expect(checkOutput(f, 1, 20, 0)).toBeNull();
    expect(checkOutput(f, 1, 18, 2)).toBeNull();
  });
  it("refuses more than is waiting", () => {
    expect(checkOutput(f, 1, 21, 0)).toBe("Only 20 pieces are waiting at Pouring.");
    expect(checkOutput(flowOf(50, ROUTE, [{ seq: 0, good: 10, scrap: 0 }, { seq: 1, good: 10, scrap: 0 }]), 1, 1, 0)).toBe("No pieces are waiting at Pouring — Molding has to finish them first.");
  });
  it("refuses taking back what the next stage already used", () => {
    expect(checkOutput(f, 1, -21, 0)).toBe("10 pieces have already moved on to Quality — take them back there first.");
    expect(checkOutput(f, 1, -20, 0)).toBeNull(); // 30 → 10, exactly what Quality took
  });
  it("refuses empty, fractional and below-zero totals", () => {
    expect(checkOutput(f, 1, 0, 0)).toBe("Enter the pieces finished or scrapped.");
    expect(checkOutput(f, 1, 1.5, 0)).toBe("Quantities are whole pieces.");
    expect(checkOutput(f, 3, -1, 0)).toBe("Machining has finished only 0 pieces — it cannot take back 1.");
    expect(checkOutput(f, 9, 1, 0)).toBe("That stage is not on the order's route.");
  });
  it("turns a tracker total into the difference", () => {
    expect(totalToDelta(f, 1, 45)).toBe(15);
    expect(totalToDelta(f, 1, 25)).toBe(-5);
  });
});

describe("summarize and statusAfter", () => {
  it("puts the order at its earliest waiting stage", () => {
    const f = flowOf(50, ROUTE, [{ seq: 0, good: 50, scrap: 0 }, { seq: 1, good: 30, scrap: 0 }]);
    const s = summarize(f, 50);
    expect(s).toMatchObject({ stageIndex: 1, started: true, completed: false, inProgress: true, waiting: 50, finished: 0, progressPct: 0 });
    expect(statusAfter({ status: "IN_PRODUCTION", stageIndex: 0 }, s, f)).toBe("IN_PRODUCTION");
  });
  it("is under inspection when the earliest pieces wait at a quality stage", () => {
    const f = flowOf(10, ROUTE, [{ seq: 0, good: 10, scrap: 0 }, { seq: 1, good: 10, scrap: 0 }]);
    expect(statusAfter({ status: "IN_PRODUCTION", stageIndex: 1 }, summarize(f, 10), f)).toBe("UNDER_INSPECTION");
  });
  it("completes when nothing waits, scrap included", () => {
    const f = flowOf(10, ROUTE, [{ seq: 0, good: 10, scrap: 0 }, { seq: 1, good: 9, scrap: 1 }, { seq: 2, good: 9, scrap: 0 }, { seq: 3, good: 9, scrap: 0 }]);
    const s = summarize(f, 10);
    expect(s).toMatchObject({ completed: true, stageIndex: null, finished: 9, scrap: 1, progressPct: 90 });
    expect(statusAfter({ status: "IN_PRODUCTION", stageIndex: 3 }, s, f)).toBe("COMPLETED");
  });
  it("keeps paused, not-released and rework labels", () => {
    const f = flowOf(10, ROUTE, [{ seq: 0, good: 4, scrap: 0 }]);
    const s = summarize(f, 10);
    expect(statusAfter({ status: "ON_HOLD", stageIndex: 0 }, s, f)).toBe("ON_HOLD");
    expect(statusAfter({ status: "REWORK", stageIndex: 0 }, s, f)).toBe("REWORK");
    expect(statusAfter({ status: "REWORK", stageIndex: 2 }, s, f)).toBe("IN_PRODUCTION");
    const none = flowOf(10, ROUTE, []);
    expect(statusAfter({ status: "PLANNED", stageIndex: null }, summarize(none, 10), none)).toBe("PLANNED");
  });
});

describe("lots and waits", () => {
  it("gives one lot per stage holding pieces", () => {
    const f = flowOf(50, ROUTE, [{ seq: 0, good: 50, scrap: 0 }, { seq: 1, good: 30, scrap: 0 }, { seq: 2, good: 10, scrap: 0 }]);
    expect(lotsOf(f).map((l) => [l.name, l.waiting])).toEqual([["Pouring", 20], ["Quality", 20], ["Machining", 10]]);
  });
  it("counts whole days waited and tones them", () => {
    expect(waitedDays("2026-11-15", "2026-11-22")).toBe(7);
    expect(waitedDays("2026-11-23", "2026-11-22")).toBe(0);
    expect(waitedDays(null, "2026-11-22")).toBeNull();
    expect([waitTone(0), waitTone(3), waitTone(7), waitTone(null)]).toEqual(["ok", "warn", "bad", "neutral"]);
  });
});
