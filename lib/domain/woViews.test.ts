import { describe, expect, it } from "vitest";
import { applyFilters, columnOf, groupRows, kanbanColumns, kanbanMove, type ViewRow } from "./woViews";

const stages = [{ name: "Mold Prepare", qc: false }, { name: "Melting & Pouring", qc: false }, { name: "Quality", qc: true }];
const base: ViewRow = { id: 1, code: "1-1", fullName: "1-1 Bars", material: "C90500", materialCode: "BRZ-08", process: "Centrifugal", product: "Bars", status: "IN_PRODUCTION", priority: 1, stage: "Melting & Pouring", stageIndex: 1, workshop: "Melting", dueDate: "2026-11-25", late: false, stages };

describe("filters", () => {
  const rows: ViewRow[] = [
    base,
    { ...base, id: 2, status: "COMPLETED", stageIndex: 2 },
    { ...base, id: 3, late: true, priority: 3, dueDate: "2026-11-01" },
    { ...base, id: 4, status: "PLANNED", stageIndex: null, stage: null, material: "RG7" },
  ];
  it("status filters widen each other, the rest narrow", () => {
    expect(applyFilters(rows, ["completed", "planned"], "", "2026-11-29").map((r) => r.id)).toEqual([2, 4]);
    expect(applyFilters(rows, ["open", "late"], "", "2026-11-29").map((r) => r.id)).toEqual([3]);
    expect(applyFilters(rows, ["due7"], "", "2026-11-29").map((r) => r.id)).toEqual([1, 4]);
  });
  it("searches every shown field", () => {
    expect(applyFilters(rows, [], "rg7", "").map((r) => r.id)).toEqual([4]);
  });
  it("groups", () => {
    expect(groupRows(rows, "status").map((g) => [g.key, g.rows.length])).toEqual([["Completed", 1], ["In Production", 2], ["Planned", 1]]);
  });
});

describe("kanban", () => {
  it("orders the stage columns as routes run", () => {
    expect(kanbanColumns([["Pattern", "Molding", "Melting & Pouring", "Machining", "Inspection"], ["Mold Prepare", "Melting & Pouring", "Cutting", "Quality"]]))
      .toEqual(["Not released", "Mold Prepare", "Pattern", "Molding", "Melting & Pouring", "Cutting", "Machining", "Inspection", "Quality", "Completed"]);
  });
  it("one step along the order's own route", () => {
    expect(kanbanMove(base, "Quality")).toEqual({ ok: true, action: "NEXT" });
    expect(kanbanMove(base, "Mold Prepare")).toEqual({ ok: true, action: "PREV" });
    expect(kanbanMove(base, "Completed").ok).toBe(false);
    const planned = { ...base, status: "PLANNED", stageIndex: null, stage: null };
    expect(columnOf(planned)).toBe("Not released");
    expect(kanbanMove(planned, "Mold Prepare")).toEqual({ ok: true, action: "START" });
    expect(kanbanMove(planned, "Quality").ok).toBe(false);
  });
  it("leaves QC to Quality and refuses paused or closed orders", () => {
    expect(kanbanMove({ ...base, status: "UNDER_INSPECTION", stageIndex: 2 }, "Completed").ok).toBe(false);
    expect(kanbanMove({ ...base, status: "ON_HOLD" }, "Quality").ok).toBe(false);
    expect(kanbanMove({ ...base, stageIndex: 2, status: "IN_PRODUCTION" }, "Completed")).toEqual({ ok: true, action: "NEXT" });
  });
});
