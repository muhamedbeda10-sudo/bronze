import { isRole, MODULES, parseAccess, ROLE_ACCESS, type Access, type Role } from "./access";

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  access: Access;
  workshopId: number | null;
  position: string | null;
  department: string | null;
  active: boolean;
}

/** An account as the admin types it; `access` left out takes the role's preset. */
export function validateUser(raw: Record<string, unknown>): { ok: true; value: UserInput } | { ok: false; error: string } {
  const name = String(raw.name ?? "").trim();
  if (!name || name.length > 100) return { ok: false, error: "Enter the name." };
  const email = String(raw.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (!isRole(raw.role)) return { ok: false, error: "Choose the role." };
  const access = raw.access === undefined || raw.access === null ? ROLE_ACCESS[raw.role] : parseAccess(raw.access);
  const ws = Number(raw.workshopId);
  return {
    ok: true,
    value: {
      name,
      email,
      role: raw.role,
      access,
      workshopId: Number.isInteger(ws) && ws > 0 ? ws : null,
      position: String(raw.position ?? "").trim().slice(0, 100) || null,
      department: String(raw.department ?? "").trim().slice(0, 100) || null,
      active: raw.active !== false,
    },
  };
}

/** The admin cannot lock themselves out: their own account keeps Settings in full and stays active. */
export function selfLockout(isSelf: boolean, v: UserInput): string | null {
  if (!isSelf) return null;
  if (!v.active) return "You cannot deactivate your own account.";
  if (v.access.settings !== "F") return "You cannot take full Settings access away from your own account.";
  return null;
}

export const accessSummary = (a: Access) => MODULES.filter((m) => a[m]).length;
