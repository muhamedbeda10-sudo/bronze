// The app bar's menus — one place for the menus, the phone's drawer, the
// breadcrumb and the command palette's pages. Each entry opens to the
// accounts holding at least `level` on its module.

import { can, type Access, type Level, type Module } from "@/lib/domain/access";

export type IconName =
  | "home" | "orders" | "plus" | "board" | "queue" | "calendar" | "gauge" | "bell" | "hammer" | "history" | "list" | "tablet"
  | "check" | "boxes" | "truck" | "ledger" | "clock" | "chart" | "report" | "db" | "users" | "settings" | "kanban" | "gantt";

export interface NavLink { href: string; label: string; module: Module; level?: Level; icon: IconName; hint?: string }
export interface NavSection { label?: string; links: NavLink[] }
export interface NavMenu { key: string; label: string; sections: NavSection[] }

const R = (key: string, label: string) => ({ href: `/reports?report=${key}`, label, module: "reports" as const, icon: "report" as const });
const M = (tab: string, label: string) => ({ href: `/master/${tab}`, label, module: "masterData" as const, icon: "db" as const });
const S = (tab: string, label: string) => ({ href: `/inventory/${tab}`, label, module: "inventory" as const, icon: "boxes" as const });

export const MENUS: NavMenu[] = [
  {
    key: "production",
    label: "Production",
    sections: [
      { label: "Work orders", links: [
        { href: "/work-orders", label: "Work Orders", module: "workOrders", icon: "orders", hint: "List, Kanban and Gantt" },
        { href: "/work-orders/new", label: "New Work Order", module: "workOrders", level: "E", icon: "plus" },
        { href: "/work-orders/history", label: "Work Order History", module: "workOrders", icon: "history" },
      ] },
      { label: "Planning", links: [
        { href: "/planning", label: "Execution Board", module: "planning", icon: "board" },
        { href: "/planning/workshop", label: "Queue by Stage", module: "planning", icon: "queue" },
        { href: "/planning/weekly", label: "Weekly Plan", module: "planning", icon: "calendar" },
        { href: "/planning/capacity", label: "Capacity", module: "planning", icon: "gauge" },
        { href: "/planning/notifications", label: "Planning Notifications", module: "planning", icon: "bell" },
      ] },
      { label: "Shop floor", links: [
        { href: "/workshop", label: "Record Activity", module: "workshop", level: "E", icon: "hammer" },
        { href: "/workshop/history", label: "Workshop History", module: "workshop", icon: "history" },
        { href: "/workshop/logs", label: "Workshop Logs", module: "workshop", icon: "list" },
        { href: "/floor", label: "Shop-Floor Kiosk", module: "workshop", level: "E", icon: "tablet", hint: "Scan a traveler's QR" },
      ] },
    ],
  },
  {
    key: "quality",
    label: "Quality",
    sections: [{ links: [
      { href: "/quality", label: "Pending Inspection", module: "quality", icon: "check" },
      { href: "/quality/history", label: "Inspection History", module: "quality", icon: "history" },
    ] }],
  },
  {
    key: "inventory",
    label: "Inventory",
    sections: [
      { label: "Stock", links: [S("raw", "Raw Materials"), S("fg", "FG Products"), S("wip", "WIP Product"), S("wip-raw", "WIP Raw Material")] },
      { label: "Movements", links: [
        { href: "/inventory/issues", label: "Issue Requests", module: "inventory", icon: "truck" },
        { href: "/inventory/ledger", label: "Stock Ledger", module: "inventory", icon: "ledger" },
      ] },
    ],
  },
  {
    key: "people",
    label: "People",
    sections: [{ label: "Overtime", links: [
      { href: "/overtime", label: "Overtime Requests", module: "overtime", icon: "clock" },
      { href: "/overtime/history", label: "Overtime History", module: "overtime", icon: "history" },
    ] }],
  },
  {
    key: "reporting",
    label: "Reporting",
    sections: [
      { links: [{ href: "/analytics", label: "Production Analytics", module: "dashboard", icon: "chart" }] },
      { label: "Reports", links: [R("wo-status", "Work Order Status"), R("efficiency", "Production Efficiency"), R("machines", "Machine Utilization"), R("material", "Material Consumption"), R("scrap", "Scrap Analysis"), R("delivery", "Delivery Performance")] },
    ],
  },
  {
    key: "config",
    label: "Configuration",
    sections: [
      { label: "Master data", links: [M("materials", "Materials"), M("products", "FG Products"), M("workshops", "Workshops"), M("processes", "Processes"), M("routing", "Routing"), M("machines", "Machines"), M("molds", "Molds"), M("operators", "Operators"), M("rejection-reasons", "Rejection Reasons"), M("statuses", "Status Types")] },
      { label: "Administration", links: [
        { href: "/settings", label: "Users & Access", module: "settings", icon: "users" },
        { href: "/settings/general", label: "General Settings", module: "settings", icon: "settings" },
        { href: "/settings/history", label: "Change History", module: "settings", icon: "history" },
      ] },
    ],
  },
];

/** The menus as one account sees them: entries it cannot open removed, empty sections and menus dropped. */
export function menusFor(access: Access): NavMenu[] {
  return MENUS.map((m) => ({
    ...m,
    sections: m.sections.map((s) => ({ ...s, links: s.links.filter((l) => can(access, l.module, l.level ?? "V")) })).filter((s) => s.links.length),
  })).filter((m) => m.sections.length);
}

/** The menu and entry a path belongs to (the longest matching link), for the breadcrumb and the lit menu. */
export function locate(menus: NavMenu[], pathname: string, search = ""): { menu: NavMenu; link: NavLink } | null {
  const full = pathname + (search ? `?${search}` : "");
  let best: { menu: NavMenu; link: NavLink; score: number } | null = null;
  for (const menu of menus) for (const s of menu.sections) for (const link of s.links) {
    const [lp, lq] = link.href.split("?");
    let score = -1;
    if (lq && full.startsWith(link.href)) score = link.href.length + 1000;
    else if (lq && pathname === lp && !search.includes("report=") && link.href.endsWith("wo-status")) score = 1;
    else if (!lq && (pathname === lp || pathname.startsWith(lp + "/"))) score = lp!.length;
    if (score > (best?.score ?? -1)) best = { menu, link, score };
  }
  return best ? { menu: best.menu, link: best.link } : null;
}
