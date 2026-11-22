import { describe, expect, it } from "vitest";
import { can, homePath, moduleOfPath, parseAccess, ROLE_ACCESS, ROLES, visibleModules } from "./access";

describe("access", () => {
  it("ranks F over E over V", () => {
    const a = parseAccess({ workOrders: "E" });
    expect(can(a, "workOrders", "V")).toBe(true);
    expect(can(a, "workOrders", "E")).toBe(true);
    expect(can(a, "workOrders", "F")).toBe(false);
    expect(can(a, "planning", "V")).toBe(false);
  });

  it("drops unknown modules and levels", () => {
    expect(parseAccess({ workOrders: "X", hacking: "F", quality: "F" })).toEqual({ quality: "F" });
    expect(parseAccess(null)).toEqual({});
    expect(parseAccess(["F"])).toEqual({});
  });

  it("gives every role a preset; a plain user sees only the dashboard", () => {
    for (const r of ROLES) expect(ROLE_ACCESS[r]).toBeDefined();
    expect(visibleModules(ROLE_ACCESS.USER)).toEqual(["dashboard"]);
    expect(can(ROLE_ACCESS.ADMIN, "settings", "F")).toBe(true);
    expect(can(ROLE_ACCESS.PLANNER, "settings", "V")).toBe(false);
    expect(can(ROLE_ACCESS.QC_INSPECTOR, "quality", "F")).toBe(true);
  });

  it("maps paths to modules and finds the landing page", () => {
    expect(moduleOfPath("/")).toBe("dashboard");
    expect(moduleOfPath("/work-orders/history")).toBe("workOrders");
    expect(moduleOfPath("/master/materials")).toBe("masterData");
    expect(moduleOfPath("/login")).toBeNull();
    expect(homePath({ quality: "F" })).toBe("/quality");
    expect(homePath({})).toBe("/no-access");
  });
});
