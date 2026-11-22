import { describe, expect, it } from "vitest";
import { parseDay } from "./dates";
import { computeKpis, type KpiInput } from "./kpi";

const d = (s: string) => parseDay(s)!;

const base: KpiInput = {
  orders: [
    { id: 1, status: "COMPLETED", qty: 10, woDate: d("2026-11-01"), dueDate: d("2026-11-10"), completedAt: new Date("2026-11-08T10:00:00Z"), rawReqKg: 50 },
    { id: 2, status: "IN_PRODUCTION", qty: 20, woDate: d("2026-11-02"), dueDate: d("2026-11-09"), completedAt: null, rawReqKg: 100 },
    { id: 3, status: "PLANNED", qty: 5, woDate: d("2026-11-05"), dueDate: d("2026-11-30"), completedAt: null, rawReqKg: 20 },
    { id: 4, status: "CANCELLED", qty: 99, woDate: d("2026-11-05"), dueDate: d("2026-11-10"), completedAt: null, rawReqKg: 999 },
  ],
  activities: [
    { date: d("2026-11-08"), workshopId: 1, machineId: 1, workOrderId: 1, durationHrs: 8, qtyProduced: 90, qtyScrap: 10, reason: "Porosity" },
    { date: d("2026-11-08"), workshopId: 1, machineId: 1, workOrderId: null, durationHrs: 2, qtyProduced: 0, qtyScrap: 0, reason: null },
  ],
  inspections: [{ at: new Date("2026-11-08T12:00:00Z"), qtyRejected: 5, reason: "Porosity" }],
  overtimeHours: 6,
  machines: [{ id: 1, workshopId: 1, active: true }, { id: 2, workshopId: 1, active: false }],
  workshops: [{ id: 1, name: "Melting" }],
  from: d("2026-11-08"),
  to: d("2026-11-10"),
  today: d("2026-11-10"),
  machineHoursPerDay: 16,
};

describe("computeKpis", () => {
  const k = computeKpis(base);
  it("counts open, delayed and completed orders", () => {
    expect(k.openOrders).toBe(2);
    expect(k.delayedOrders).toBe(1); // order 2 was due on the 9th
    expect(k.completedInPeriod).toBe(1);
    expect(k.materialRequiredKg).toBe(120);
  });
  it("output vs plan ignores cancelled orders", () => {
    // due in period: order 1 (10) and order 2 (20); done: order 1 (10)
    expect(k.outputVsPlanPct).toBe(33.3);
  });
  it("rejection rate adds QC rejects to logged scrap", () => {
    expect(k.rejectionRatePct).toBe(15); // (10 + 5) / (90 + 10)
    expect(k.rejectionByReason).toEqual([{ reason: "Porosity", qty: 15 }]);
  });
  it("utilization counts order hours on active machines only", () => {
    // 8 h on orders ÷ (1 active machine × 3 days × 16 h)
    expect(k.utilizationPct).toBe(16.7);
    expect(k.utilizationByWorkshop).toEqual([{ workshop: "Melting", hours: 8, pct: 16.7 }]);
  });
  it("gives the delivery time and the trend", () => {
    expect(k.avgDeliveryDays).toBe(7);
    expect(k.trend.map((t) => t.day)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(k.trend[0].produced).toBe(10);
    expect(k.trend[1].planned).toBe(20);
  });
  it("shows no percentage when there is nothing to divide by", () => {
    const empty = computeKpis({ ...base, orders: [], activities: [], inspections: [], machines: [] });
    expect(empty.outputVsPlanPct).toBeNull();
    expect(empty.rejectionRatePct).toBeNull();
    expect(empty.utilizationPct).toBeNull();
  });
});
