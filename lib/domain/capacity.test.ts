import { describe, expect, it } from "vitest";
import { workshopLoad } from "./capacity";

describe("workshopLoad", () => {
  const stages = [
    { seq: 0, workshopId: 1, stdTimeMin: 6, qcRequired: false },
    { seq: 1, workshopId: 2, stdTimeMin: 30, qcRequired: false },
    { seq: 2, workshopId: 3, stdTimeMin: 10, qcRequired: true },
  ];
  it("counts only the stages still ahead, and never QC", () => {
    const r = workshopLoad([{ qty: 10, stageIndex: 1, stages }, { qty: 20, stageIndex: null, stages }], [{ workshopId: 1 }, { workshopId: 2 }, { workshopId: 2 }], [{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "QC" }], 16);
    // A: only the unreleased order still needs it: 20 × 6 / 60 = 2 h
    expect(r[0]).toMatchObject({ loadHours: 2, orders: 1, capacityPerDay: 16, days: 0.1 });
    // B: (10 + 20) × 30 / 60 = 15 h on 2 machines × 16 h
    expect(r[1]).toMatchObject({ loadHours: 15, orders: 2, capacityPerDay: 32, days: 0.5, weekPct: 9.4 });
    expect(r[2]).toMatchObject({ loadHours: 0, days: null });
  });
});
