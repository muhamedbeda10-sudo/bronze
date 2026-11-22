import { describe, expect, it } from "vitest";
import { validateOvertime } from "./overtime";

const ok = { date: "2026-11-22", operatorId: "3", workshopId: "1", fromTime: "16:00", toTime: "19:30", reason: "Urgent pour" };

describe("validateOvertime", () => {
  it("works the hours out from the times", () => {
    const r = validateOvertime(ok);
    expect(r.ok && r.value.hours).toBe(3.5);
  });
  it("runs past midnight", () => {
    const r = validateOvertime({ ...ok, fromTime: "22:00", toTime: "02:00" });
    expect(r.ok && r.value.hours).toBe(4);
  });
  it("refuses more than 12 hours, no reason, no operator", () => {
    expect(validateOvertime({ ...ok, fromTime: "06:00", toTime: "20:00" }).ok).toBe(false);
    expect(validateOvertime({ ...ok, reason: " " }).ok).toBe(false);
    expect(validateOvertime({ ...ok, operatorId: "" }).ok).toBe(false);
    expect(validateOvertime({ ...ok, fromTime: "16:00", toTime: "16:00" }).ok).toBe(false);
  });
});
