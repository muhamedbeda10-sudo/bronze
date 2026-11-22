import { describe, expect, it } from "vitest";
import { parseDay } from "./dates";
import { delivery, efficiency, machineUse, plannedHours } from "./reports";

const stages = [
  { seq: 0, stdTimeMin: 6, qcRequired: false },
  { seq: 1, stdTimeMin: 12, qcRequired: false },
  { seq: 2, stdTimeMin: 30, qcRequired: true },
];

describe("reports", () => {
  it("plans hours for the stages passed, never QC", () => {
    expect(plannedHours(10, stages, 1, false)).toBe(1); // only stage 0: 10 × 6 / 60
    expect(plannedHours(10, stages, 2, true)).toBe(3); // 1 + 2, QC excluded
    expect(plannedHours(10, stages, null, false)).toBe(0);
  });
  it("efficiency and yield", () => {
    expect(efficiency(3, 4, 95, 5)).toMatchObject({ efficiencyPct: 75, yieldPct: 95 });
    expect(efficiency(3, 0, 0, 0)).toMatchObject({ efficiencyPct: null, yieldPct: null });
  });
  it("machine use counts an inactive machine as unavailable", () => {
    expect(machineUse(true, 5, 16, 40, 8)).toEqual({ availableHrs: 80, orderHrs: 40, setupHrs: 8, idleHrs: 32, utilizationPct: 50 });
    expect(machineUse(false, 5, 16, 0, 0).utilizationPct).toBeNull();
  });
  it("delivery: on time on the due day, late after it", () => {
    const wo = parseDay("2026-11-01")!;
    expect(delivery(wo, new Date("2026-11-10T15:00:00Z"), parseDay("2026-11-10"))).toEqual({ leadDays: 9, onTime: true, delayDays: 0 });
    expect(delivery(wo, new Date("2026-11-12T09:00:00Z"), parseDay("2026-11-10"))).toEqual({ leadDays: 11, onTime: false, delayDays: 2 });
    expect(delivery(wo, new Date("2026-11-12T09:00:00Z"), null).onTime).toBeNull();
  });
});
