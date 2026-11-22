import { describe, expect, it } from "vitest";
import { appsFor, locate } from "./nav";
import { MODULES, ROLE_ACCESS, type Access } from "./domain/access";

const ALL: Access = Object.fromEntries(MODULES.map((m) => [m, "F"]));

describe("apps", () => {
  it("shows a role only the apps it can open", () => {
    expect(appsFor(ROLE_ACCESS.QC_INSPECTOR).map((a) => a.key)).toEqual(["mywork", "manufacturing", "quality", "inventory"]);
    expect(appsFor(ROLE_ACCESS.USER).map((a) => a.key)).toEqual(["mywork", "manufacturing"]);
    expect(appsFor(ROLE_ACCESS.PLANNER).map((a) => a.key)).toEqual(["mywork", "manufacturing", "quality", "inventory", "overtime"]);
    expect(appsFor(ROLE_ACCESS.WORKSHOP_SUPERVISOR).map((a) => a.key)).toContain("kiosk");
    expect(appsFor(ROLE_ACCESS.QC_INSPECTOR).map((a) => a.key)).not.toContain("kiosk");
  });
  it("opens an app on the first entry the account may see", () => {
    const qc = appsFor(ROLE_ACCESS.QC_INSPECTOR).find((a) => a.key === "manufacturing")!;
    const links = qc.sections.flatMap((s) => s.links.map((l) => l.href));
    expect(links).toContain("/workshop/history"); // QC views the floor, cannot record
    expect(links).not.toContain("/workshop");
    expect(qc.home).toBe(links[0]);
    const viewer = appsFor(ROLE_ACCESS.USER).find((a) => a.key === "manufacturing")!;
    expect(viewer.sections.map((s) => s.label)).toEqual(["Reporting"]); // a viewer sees the reports only
  });
  it("lays the Manufacturing bar out as Odoo's", () => {
    const m = appsFor(ALL).find((a) => a.key === "manufacturing")!;
    expect(m.home).toBe("/planning/workshop");
    expect(m.sections.map((s) => s.label ?? s.links.map((l) => l.label).join())).toEqual(["Overview", "Operations", "Planning", "Products", "Reporting", "Configuration"]);
  });
  it("finds the app and entry of a path", () => {
    const all = appsFor(ALL);
    expect(locate(all, "/work-orders/12")).toMatchObject({ app: { key: "manufacturing" }, link: { label: "Work Orders" } });
    expect(locate(all, "/work-orders/new")?.link.label).toBe("New Work Order");
    expect(locate(all, "/planning/weekly")?.app.key).toBe("manufacturing");
    expect(locate(all, "/planning/workshop")?.link.label).toBe("Overview");
    expect(locate(all, "/reports", "report=scrap")?.link.label).toBe("Scrap Analysis");
    expect(locate(all, "/reports", "")?.link.label).toBe("Work Order Status");
    expect(locate(all, "/master/molds")?.app.key).toBe("manufacturing");
    expect(locate(all, "/inventory/raw")?.app.key).toBe("inventory");
    expect(locate(all, "/")).toBeNull();
  });
});
