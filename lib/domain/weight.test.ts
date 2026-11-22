import { describe, expect, it } from "vitest";
import { calcWeights, dimensionText, fullName, volumeMm3 } from "./weight";

describe("calcWeights", () => {
  it("matches the documentation's worked example at 8.8 g/cm³", () => {
    // OD 100, ID 20, L 100, qty 10 → 754,000 mm³ → 6.63 kg → 66.3 kg → 76.3 kg
    const w = calcWeights({ format: "OD_ID_L", od: 100, innerDia: 20, length: 100, qty: 10, density: 8.8, allowancePct: 15 });
    expect(w.volumeMm3).toBe(753982);
    expect(w.unitKg).toBeCloseTo(6.635, 3);
    expect(w.totalKg).toBeCloseTo(66.35, 2);
    expect(w.rawReqKg).toBeCloseTo(76.3, 1);
  });

  it("uses each material's own density (the fix from §14)", () => {
    const a = calcWeights({ format: "OD_ID_L", od: 100, innerDia: 20, length: 100, qty: 1, density: 8.91 });
    expect(a.densityUsed).toBe(8.91);
    expect(a.unitKg).toBeCloseTo((753982.24 * 8.91) / 1e6, 3);
  });

  it("falls back to 8.8 for a missing density", () => {
    expect(calcWeights({ format: "OD_ID_L", od: 10, length: 10, qty: 1, density: 0 }).densityUsed).toBe(8.8);
    expect(calcWeights({ format: "OD_ID_L", od: 10, length: 10, qty: 1 }).densityUsed).toBe(8.8);
  });

  it("weighs a solid bar with no ID", () => {
    expect(volumeMm3("OD_ID_L", { od: 20, length: 100 })).toBeCloseTo(Math.PI * 100 * 100, 3);
  });

  it("weighs a plate W × L × H", () => {
    const w = calcWeights({ format: "W_L_H", width: 100, length: 200, height: 10, qty: 2, density: 8 });
    expect(w.volumeMm3).toBe(200000);
    expect(w.unitKg).toBe(1.6);
    expect(w.totalKg).toBe(3.2);
  });

  it("refuses an ID as large as the OD", () => {
    expect(volumeMm3("OD_ID_L", { od: 50, innerDia: 50, length: 10 })).toBeNull();
  });

  it("takes the mold-based weight when the shape has no formula", () => {
    const w = calcWeights({ format: "IMPELLER", qty: 4, moldPieceKg: 12.5, allowancePct: 10 });
    expect(w.totalKg).toBeNull();
    expect(w.moldKg).toBe(50);
    expect(w.expectedKg).toBe(50);
    expect(w.rawReqKg).toBe(55);
  });

  it("gives zero weight for zero quantity, never NaN", () => {
    const w = calcWeights({ format: "OD_ID_L", od: 100, innerDia: 20, length: 100, qty: 0 });
    expect(w.totalKg).toBe(0);
  });
});

describe("names", () => {
  it("builds the order line's full name", () => {
    const dims = dimensionText("OD_ID_L", { od: 300, innerDia: 200, length: 10 });
    expect(dims).toBe("300x200x10 mm");
    expect(fullName({ woNo: "14444", lineNo: 1, lineCount: 2, product: "Bars", material: "C90500", dims, qty: 10 })).toBe("14444-1 - 1/2 - Bars - C90500 - 300x200x10 mm - Qty:10");
  });
  it("shows a solid part's ID as 0", () => {
    expect(dimensionText("OD_ID_L", { od: 30, length: 100 })).toBe("30x0x100 mm");
  });
});
