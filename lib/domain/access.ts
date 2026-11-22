// Who sees and changes what (System Documentation §18).
// Each account holds a level per module; its role is the preset that fills
// them, and the admin can then change any module on the account itself.
//   F = full (create, edit, approve, delete) · E = enter and edit · V = view only
// A module an account holds no level on is not in its menu at all.

export const MODULES = [
  "dashboard",
  "masterData",
  "workOrders",
  "planning",
  "workshop",
  "quality",
  "inventory",
  "overtime",
  "reports",
  "settings",
] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABEL: Record<Module, string> = {
  dashboard: "Dashboard",
  masterData: "Master Data",
  workOrders: "Work Orders",
  planning: "Production Planning",
  workshop: "Workshop Execution",
  quality: "Quality Control",
  inventory: "Inventory",
  overtime: "Overtime",
  reports: "Reporting",
  settings: "Settings",
};

export type Level = "F" | "E" | "V";
export const LEVELS: readonly Level[] = ["F", "E", "V"];
export const LEVEL_LABEL: Record<Level, string> = { F: "Full", E: "Enter & edit", V: "View" };
const RANK: Record<Level, number> = { V: 1, E: 2, F: 3 };

export type Access = Partial<Record<Module, Level>>;

export const ROLES = [
  "GENERAL_MANAGER",
  "ADMIN",
  "PLANNER",
  "WORKSHOP_SUPERVISOR",
  "QC_INSPECTOR",
  "STORE_KEEPER",
  "TECHNICAL_OFFICE",
  "HR_OFFICER",
  "SALES",
  "ACCOUNTANT",
  "USER",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  GENERAL_MANAGER: "General Manager",
  ADMIN: "Admin",
  PLANNER: "Planner",
  WORKSHOP_SUPERVISOR: "Workshop Supervisor",
  QC_INSPECTOR: "QC Inspector",
  STORE_KEEPER: "Store Keeper",
  TECHNICAL_OFFICE: "Technical Office",
  HR_OFFICER: "HR Officer",
  SALES: "Sales",
  ACCOUNTANT: "Accountant",
  USER: "User",
};

/** The role presets — the MES columns of the roles table in §18. */
export const ROLE_ACCESS: Record<Role, Access> = {
  GENERAL_MANAGER: { dashboard: "V", masterData: "V", workOrders: "V", planning: "V", workshop: "V", quality: "V", inventory: "V", overtime: "F", reports: "F", settings: "V" },
  ADMIN: { dashboard: "V", masterData: "F", workOrders: "V", planning: "V", workshop: "V", quality: "V", inventory: "V", overtime: "V", reports: "F", settings: "F" },
  PLANNER: { dashboard: "V", masterData: "V", workOrders: "F", planning: "F", workshop: "V", quality: "V", inventory: "V", overtime: "F", reports: "V" },
  WORKSHOP_SUPERVISOR: { dashboard: "V", workOrders: "V", planning: "V", workshop: "E", inventory: "E", overtime: "E" },
  QC_INSPECTOR: { dashboard: "V", workOrders: "V", workshop: "V", quality: "F", inventory: "V", reports: "V" },
  STORE_KEEPER: { dashboard: "V", workOrders: "V", inventory: "F", reports: "V" },
  TECHNICAL_OFFICE: { dashboard: "V", masterData: "E", workOrders: "E", planning: "V", quality: "V" },
  HR_OFFICER: { dashboard: "V", workshop: "V", overtime: "F", reports: "V" },
  SALES: { dashboard: "V", workOrders: "V", planning: "V", inventory: "V", reports: "V" },
  ACCOUNTANT: { dashboard: "V", inventory: "V", overtime: "V", reports: "V" },
  USER: { dashboard: "V" },
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function isModule(v: unknown): v is Module {
  return typeof v === "string" && (MODULES as readonly string[]).includes(v);
}

/** An account's stored access, cleaned: unknown modules and levels dropped. */
export function parseAccess(raw: unknown): Access {
  const out: Access = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isModule(k) && (v === "F" || v === "E" || v === "V")) out[k] = v;
  }
  return out;
}

/** Does this access reach `need` on the module? */
export function can(access: Access, module: Module, need: Level = "V"): boolean {
  const have = access[module];
  return !!have && RANK[have] >= RANK[need];
}

/** The modules an account sees, in menu order. */
export function visibleModules(access: Access): Module[] {
  return MODULES.filter((m) => can(access, m, "V"));
}

/** Where to land after signing in: the first module the account sees. */
export const MODULE_PATH: Record<Module, string> = {
  dashboard: "/analytics",
  masterData: "/master",
  workOrders: "/work-orders",
  planning: "/planning",
  workshop: "/workshop",
  quality: "/quality",
  inventory: "/inventory",
  overtime: "/overtime",
  reports: "/reports",
  settings: "/settings",
};

/** Where to land after signing in: everyone's own "My work" home, once they see anything. */
export function homePath(access: Access): string {
  return visibleModules(access).length ? "/" : "/no-access";
}

/** The module a path belongs to (the longest matching prefix). */
export function moduleOfPath(pathname: string): Module | null {
  if (pathname === "/") return null;
  let best: Module | null = null;
  let len = 0;
  for (const m of MODULES) {
    const p = MODULE_PATH[m];
    if ((pathname === p || pathname.startsWith(p + "/")) && p.length > len) {
      best = m;
      len = p.length;
    }
  }
  return best;
}
