import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, readSettings, validateSettings } from "./settings";

describe("settings", () => {
  it("falls back to defaults for missing or broken values", () => {
    const s = readSettings([{ key: "rawAllowancePct", value: "abc" }, { key: "machineHoursPerDay", value: "20" }, { key: "nope", value: "x" }]);
    expect(s.rawAllowancePct).toBe(DEFAULT_SETTINGS.rawAllowancePct);
    expect(s.machineHoursPerDay).toBe(20);
  });
  it("checks a form", () => {
    expect(validateSettings({ machineHoursPerDay: 30 }).ok).toBe(false);
    expect(validateSettings({ companyEmail: "bad" }).ok).toBe(false);
    expect(validateSettings({ companyLogo: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateSettings({ companyName: "Lotfy Bronze", rawAllowancePct: "12" })).toEqual({ ok: true, values: { companyName: "Lotfy Bronze", rawAllowancePct: 12 } });
  });
});
