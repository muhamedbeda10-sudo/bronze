import { describe, expect, it } from "vitest";
import { canConfirmStage, parseScan } from "./floor";
import { ROLE_ACCESS } from "./access";

describe("canConfirmStage", () => {
  it("lets a supervisor confirm their own workshop's stages only", () => {
    expect(canConfirmStage(ROLE_ACCESS.WORKSHOP_SUPERVISOR, 1, 1, false)).toBe(true);
    expect(canConfirmStage(ROLE_ACCESS.WORKSHOP_SUPERVISOR, 1, 2, false)).toBe(false);
    expect(canConfirmStage(ROLE_ACCESS.WORKSHOP_SUPERVISOR, null, 1, false)).toBe(false);
  });
  it("lets planning confirm any stage, never a QC stage", () => {
    expect(canConfirmStage(ROLE_ACCESS.PLANNER, null, 5, false)).toBe(true);
    expect(canConfirmStage(ROLE_ACCESS.PLANNER, null, 5, true)).toBe(false);
    expect(canConfirmStage(ROLE_ACCESS.QC_INSPECTOR, null, 5, false)).toBe(false);
  });
});

describe("parseScan", () => {
  it("reads the traveler's QR address", () => {
    expect(parseScan("https://bronze.example.com/floor/wo/42")).toEqual({ id: 42 });
    expect(parseScan("http://localhost:3000/floor/wo/7?x=1")).toEqual({ id: 7 });
  });
  it("reads a typed order line", () => {
    expect(parseScan("14444-1")).toEqual({ woNo: "14444", lineNo: 1 });
    expect(parseScan("wo 2547 3")).toEqual({ woNo: "2547", lineNo: 3 });
    expect(parseScan("2526")).toEqual({ woNo: "2526", lineNo: 1 });
    expect(parseScan("E2E-12-2")).toEqual({ woNo: "E2E-12", lineNo: 2 });
    expect(parseScan("  ")).toBeNull();
    expect(parseScan("<script>")).toBeNull();
  });
});
