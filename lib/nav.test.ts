import { describe, expect, it } from "vitest";
import { locate, menusFor } from "./nav";
import { ROLE_ACCESS } from "./domain/access";

describe("nav", () => {
  it("shows a role only what it can open", () => {
    const qc = menusFor(ROLE_ACCESS.QC_INSPECTOR).map((m) => m.key);
    expect(qc).toContain("quality");
    expect(qc).not.toContain("config");
    const sup = menusFor(ROLE_ACCESS.WORKSHOP_SUPERVISOR);
    const prod = sup.find((m) => m.key === "production")!;
    expect(prod.sections.flatMap((s) => s.links).map((l) => l.href)).toContain("/floor");
    expect(prod.sections.flatMap((s) => s.links).map((l) => l.href)).not.toContain("/work-orders/new");
    expect(menusFor(ROLE_ACCESS.USER).map((m) => m.key)).toEqual(["reporting"]);
  });
  it("finds the entry a path belongs to", () => {
    const all = menusFor(ROLE_ACCESS.ADMIN && { masterData: "F", workOrders: "F", planning: "F", workshop: "F", quality: "F", inventory: "F", overtime: "F", reports: "F", settings: "F", dashboard: "V" });
    expect(locate(all, "/work-orders/12")?.link.label).toBe("Work Orders");
    expect(locate(all, "/work-orders/new")?.link.label).toBe("New Work Order");
    expect(locate(all, "/reports", "report=scrap")?.link.label).toBe("Scrap Analysis");
    expect(locate(all, "/master/molds")?.menu.key).toBe("config");
    expect(locate(all, "/")).toBeNull();
  });
});
