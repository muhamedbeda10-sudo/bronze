import { describe, expect, it } from "vitest";
import { validateActivity } from "./activity";

const ok = { date: "2026-11-22", workshopId: "1", machineId: "2", shift: "DAY", taskStatus: "COMPLETE", startTime: "08:00", endTime: "12:30", qtyProduced: "10", qtyScrap: "0", workOrderId: "5" };

describe("validateActivity", () => {
  it("works out the duration", () => {
    const r = validateActivity(ok);
    expect(r.ok && r.value.durationHrs).toBe(4.5);
  });
  it("needs a reason for scrap", () => {
    expect(validateActivity({ ...ok, qtyScrap: "2" }).ok).toBe(false);
    const r = validateActivity({ ...ok, qtyScrap: "2", rejectionReasonId: "1" });
    expect(r.ok && r.value.rejectionReasonId).toBe(1);
  });
  it("records maintenance with no order and no output", () => {
    const r = validateActivity({ ...ok, workOrderId: "", qtyProduced: "0" });
    expect(r.ok && r.value.workOrderId).toBeNull();
    expect(validateActivity({ ...ok, workOrderId: "" }).ok).toBe(false);
  });
  it("refuses negative quantities and a night shift longer than 16 h", () => {
    expect(validateActivity({ ...ok, qtyScrap: "-1" }).ok).toBe(false);
    expect(validateActivity({ ...ok, startTime: "06:00", endTime: "23:00" }).ok).toBe(false);
    const night = validateActivity({ ...ok, shift: "NIGHT", startTime: "20:00", endTime: "04:00" });
    expect(night.ok && night.value.durationHrs).toBe(8);
  });
});
