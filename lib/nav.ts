// The apps, as Odoo arranges them: the home screen is a grid of apps; inside
// an app the bar shows that app's menus only. One list for the home grid,
// the bar, the phone's drawer, the breadcrumb and the command palette.
// An entry opens to the accounts holding at least `level` on its module; an
// app shows when any of its entries does.

import { can, type Access, type Level, type Module } from "@/lib/domain/access";

export type IconName =
  | "home" | "orders" | "plus" | "board" | "queue" | "calendar" | "gauge" | "bell" | "hammer" | "history" | "list" | "tablet"
  | "check" | "boxes" | "truck" | "ledger" | "clock" | "chart" | "report" | "db" | "users" | "settings" | "kanban" | "gantt";

export type AppKey = "mywork" | "manufacturing" | "shopfloor" | "kiosk" | "quality" | "inventory" | "overtime" | "reporting" | "masterdata" | "settings";

export interface NavLink { href: string; label: string; module: Module | null; level?: Level; icon: IconName; hint?: string }
/** A section with a label is a dropdown in the bar; one without puts its links on the bar itself. */
export interface NavSection { label?: string; links: NavLink[] }
export interface AppDef { key: AppKey; label: string; desc: string; home: string; sections: NavSection[]; /** a page of its own outside the shell (the kiosk) */ standalone?: boolean }

const L = (href: string, label: string, module: Module | null, icon: IconName, level?: Level, hint?: string): NavLink => ({ href, label, module, icon, level, hint });
const R = (key: string, label: string) => L(`/reports?report=${key}`, label, "reports", "report");
const M = (tab: string, label: string) => L(`/master/${tab}`, label, "masterData", "db");
const S = (tab: string, label: string) => L(`/inventory/${tab}`, label, "inventory", "boxes");

export const APPS: AppDef[] = [
  { key: "mywork", label: "My Work", desc: "What is waiting for you", home: "/my-work", sections: [{ links: [L("/my-work", "My Work", null, "home")] }] },
  {
    key: "manufacturing",
    label: "Manufacturing",
    desc: "Work orders and production planning",
    home: "/work-orders",
    sections: [
      { label: "Work Orders", links: [
        L("/work-orders", "Work Orders", "workOrders", "orders", undefined, "List, Kanban, Gantt"),
        L("/work-orders/new", "New Work Order", "workOrders", "plus", "E"),
        L("/work-orders/history", "Work Order History", "workOrders", "history"),
      ] },
      { label: "Planning", links: [
        L("/planning", "Execution Board", "planning", "board"),
        L("/planning/workshop", "Queue by Stage", "planning", "queue"),
        L("/planning/weekly", "Weekly Plan", "planning", "calendar"),
        L("/planning/capacity", "Capacity", "planning", "gauge"),
        L("/planning/notifications", "Planning Notifications", "planning", "bell"),
      ] },
    ],
  },
  {
    key: "shopfloor",
    label: "Shop Floor",
    desc: "Record what each machine and operator did",
    home: "/workshop",
    sections: [{ links: [
      L("/workshop", "Record Activity", "workshop", "hammer", "E"),
      L("/workshop/history", "Workshop History", "workshop", "history"),
      L("/workshop/logs", "Workshop Logs", "workshop", "list"),
    ] }],
  },
  { key: "kiosk", label: "Kiosk", desc: "Tablet screen: scan a traveler, report output", home: "/floor", standalone: true, sections: [{ links: [L("/floor", "Shop-Floor Kiosk", "workshop", "tablet", "E")] }] },
  {
    key: "quality",
    label: "Quality",
    desc: "Inspect, pass or reject",
    home: "/quality",
    sections: [{ links: [L("/quality", "Pending Inspection", "quality", "check"), L("/quality/history", "Inspection History", "quality", "history")] }],
  },
  {
    key: "inventory",
    label: "Inventory",
    desc: "Stock, issue requests and the ledger",
    home: "/inventory/raw",
    sections: [
      { label: "Stock", links: [S("raw", "Raw Materials"), S("fg", "FG Products"), S("wip", "WIP Product"), S("wip-raw", "WIP Raw Material")] },
      { links: [L("/inventory/issues", "Issue Requests", "inventory", "truck"), L("/inventory/ledger", "Stock Ledger", "inventory", "ledger")] },
    ],
  },
  {
    key: "overtime",
    label: "Overtime",
    desc: "Request and approve operator overtime",
    home: "/overtime",
    sections: [{ links: [L("/overtime", "Overtime Requests", "overtime", "clock"), L("/overtime/history", "Overtime History", "overtime", "history")] }],
  },
  {
    key: "reporting",
    label: "Reporting",
    desc: "Analytics and reports, Excel and PDF",
    home: "/analytics",
    sections: [
      { links: [L("/analytics", "Production Analytics", "dashboard", "chart")] },
      { label: "Reports", links: [R("wo-status", "Work Order Status"), R("efficiency", "Production Efficiency"), R("machines", "Machine Utilization"), R("material", "Material Consumption"), R("scrap", "Scrap Analysis"), R("delivery", "Delivery Performance")] },
    ],
  },
  {
    key: "masterdata",
    label: "Master Data",
    desc: "Materials, products, routes, machines…",
    home: "/master/materials",
    sections: [
      { label: "Materials & Products", links: [M("materials", "Materials"), M("products", "FG Products"), M("molds", "Molds")] },
      { label: "Production Setup", links: [M("workshops", "Workshops"), M("processes", "Processes"), M("routing", "Routing"), M("machines", "Machines")] },
      { label: "Workforce & Quality", links: [M("operators", "Operators"), M("rejection-reasons", "Rejection Reasons"), M("statuses", "Status Types")] },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    desc: "Users, access and company",
    home: "/settings",
    sections: [{ links: [L("/settings", "Users & Access", "settings", "users"), L("/settings/general", "General Settings", "settings", "settings"), L("/settings/history", "Change History", "settings", "history")] }],
  },
];

/** The apps as one account sees them: entries it cannot open removed, empty apps dropped; an app opens on its first entry left. */
export function appsFor(access: Access): AppDef[] {
  return APPS.map((a) => {
    const sections = a.sections.map((s) => ({ ...s, links: s.links.filter((l) => l.module === null || can(access, l.module, l.level ?? "V")) })).filter((s) => s.links.length);
    const links = sections.flatMap((s) => s.links);
    const home = links.some((l) => l.href === a.home) ? a.home : (links[0]?.href ?? a.home);
    return { ...a, sections, home };
  }).filter((a) => a.sections.length);
}

/** The app and entry a path belongs to (the longest matching link), for the bar and the breadcrumb. */
export function locate(apps: AppDef[], pathname: string, search = ""): { app: AppDef; link: NavLink } | null {
  let best: { app: AppDef; link: NavLink; score: number } | null = null;
  for (const app of apps) for (const s of app.sections) for (const link of s.links) {
    const [lp, lq] = link.href.split("?");
    let score = -1;
    if (lq) {
      if (pathname === lp && search.includes(lq)) score = 1000 + link.href.length;
      else if (pathname === lp && !search.includes("report=") && link.href.endsWith("wo-status")) score = 1;
    } else if (pathname === lp || pathname.startsWith(lp + "/")) score = lp!.length;
    if (score > (best?.score ?? -1)) best = { app, link, score };
  }
  return best ? { app: best.app, link: best.link } : null;
}
