import { describe, expect, it } from "vitest";
import { cleanText, parseRow, refMap, rowKey, SPECS } from "./master";

const refs = { workshop: refMap([{ id: 7, code: "WS-01" }]), process: refMap([{ id: 3, code: "PRC-01" }]) };

describe("master data rows", () => {
  it("cleans stray separators and spaces (§14)", () => {
    expect(cleanText("  Shakeout &  Fettling| ")).toBe("Shakeout & Fettling");
  });

  it("upper-cases codes and checks numbers", () => {
    const r = parseRow(SPECS.materials, { code: " brz-08 ", name: "C90500", density: "8.91", scrapPct: "3" }, refs, "code");
    expect(r.ok && r.data).toMatchObject({ code: "BRZ-08", name: "C90500", density: 8.91, scrapPct: 3, status: "Active" });
  });

  it("names the field that is wrong", () => {
    expect(parseRow(SPECS.materials, { code: "X", name: "Y", density: "abc" }, refs, "code")).toEqual({ ok: false, error: 'Density: "abc" is not a number.' });
    expect(parseRow(SPECS.materials, { code: "X", name: "", density: 8 }, refs, "code")).toEqual({ ok: false, error: "Name is required." });
    expect(parseRow(SPECS.materials, { code: "X", name: "Y", density: 99 }, refs, "code")).toMatchObject({ ok: false });
  });

  it("finds references by code from Excel and by id from the form", () => {
    const a = parseRow(SPECS.machines, { code: "mac-1", workshopId: "ws-01", name: "Furnace" }, refs, "code");
    expect(a.ok && a.data.workshopId).toBe(7);
    const b = parseRow(SPECS.machines, { code: "mac-1", workshopId: "7", name: "Furnace" }, refs, "id");
    expect(b.ok && b.data.workshopId).toBe(7);
    expect(parseRow(SPECS.machines, { code: "m", workshopId: "WS-99", name: "F" }, refs, "code")).toMatchObject({ ok: false });
  });

  it("reads yes/no cells and defaults QC to no", () => {
    const r = parseRow(SPECS.routing, { routeCode: "rt-01", stageNo: 2, name: "Quality", qcRequired: "Yes" }, refs, "code");
    expect(r.ok && r.data.qcRequired).toBe(true);
    const r2 = parseRow(SPECS.routing, { routeCode: "rt-01", stageNo: 1, name: "Cast" }, refs, "code");
    expect(r2.ok && r2.data.qcRequired).toBe(false);
    expect(parseRow(SPECS.routing, { routeCode: "rt", stageNo: 1.5, name: "x" }, refs, "code")).toMatchObject({ ok: false });
    expect(r.ok && rowKey(SPECS.routing, r.data)).toBe("rt-01|2");
  });

  it("refuses a mold range upside down", () => {
    expect(parseRow(SPECS.molds, { moldNo: "M1", diaMin: 50, diaMax: 10 }, refs, "code")).toMatchObject({ ok: false });
  });
});
