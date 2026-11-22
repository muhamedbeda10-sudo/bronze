import { describe, expect, it } from "vitest";
import { clockHours, dayKey, daysBetween, delayDays, parseDay, todayKey, weekStart } from "./dates";

describe("dates", () => {
  it("parses only real calendar days", () => {
    expect(dayKey(parseDay("2026-03-15"))).toBe("2026-03-15");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("15/03/2026")).toBeNull();
  });
  it("counts days and delays", () => {
    const a = parseDay("2026-03-01")!;
    const b = parseDay("2026-03-15")!;
    expect(daysBetween(a, b)).toBe(14);
    expect(delayDays(a, null, b)).toBe(14);
    expect(delayDays(b, null, a)).toBe(0);
    expect(delayDays(null, null, b)).toBe(0);
  });
  it("runs a night shift past midnight", () => {
    expect(clockHours("08:00", "16:30")).toBe(8.5);
    expect(clockHours("20:00", "04:00")).toBe(8);
    expect(clockHours("25:00", "04:00")).toBeNull();
  });
  it("takes today in Cairo", () => {
    // 23:30 UTC on 21 Nov is already 22 Nov in Cairo (UTC+2)
    expect(todayKey(new Date("2026-11-21T23:30:00Z"))).toBe("2026-11-22");
  });
  it("starts the week on Monday", () => {
    expect(dayKey(weekStart(parseDay("2026-11-22")!))).toBe("2026-11-16");
  });
});
