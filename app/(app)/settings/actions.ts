"use server";

import { prisma } from "@/lib/db";
import { actionUser, hashPassword, passwordProblem } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { dbError, fail, type ActionResult } from "@/lib/server/result";
import { selfLockout, validateUser } from "@/lib/domain/users";
import { validateSettings } from "@/lib/domain/settings";

export async function saveUser(id: number | null, raw: Record<string, unknown>, password: string): Promise<ActionResult> {
  const me = await actionUser("settings", "F");
  if (typeof me === "string") return fail(me);
  const v = validateUser(raw);
  if (!v.ok) return fail(v.error);
  const lock = selfLockout(id === me.id, v.value);
  if (lock) return fail(lock);
  if (id === null || password) {
    const p = passwordProblem(password);
    if (p) return fail(p);
  }
  try {
    await prisma.$transaction(async (tx) => {
      const data = { ...v.value, access: v.value.access as object };
      if (id === null) {
        const u = await tx.user.create({ data: { ...data, passwordHash: hashPassword(password) } });
        await audit(tx, me, "create", "User", u.id, `Added user ${u.name} (${u.role})`, null, u);
      } else {
        const before = await tx.user.findUniqueOrThrow({ where: { id } });
        const u = await tx.user.update({ where: { id }, data: { ...data, ...(password ? { passwordHash: hashPassword(password) } : {}) } });
        // a deactivated account, or a new password, ends its open sessions
        if (!u.active || password) await tx.session.deleteMany({ where: { userId: id } });
        await audit(tx, me, "update", "User", id, `Edited user ${u.name}${password ? " (password reset)" : ""}`, before, u);
      }
    });
  } catch (e) {
    return dbError(e, "save the user");
  }
  return { ok: true, message: id === null ? "User added." : "Saved." };
}

export async function saveGeneral(raw: Record<string, unknown>): Promise<ActionResult> {
  const me = await actionUser("settings", "F");
  if (typeof me === "string") return fail(me);
  const v = validateSettings(raw);
  if (!v.ok) return fail(v.error);
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.setting.findMany();
      for (const [key, value] of Object.entries(v.values)) {
        await tx.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
      }
      await audit(tx, me, "update", "Setting", null, `Changed settings: ${Object.keys(v.values).join(", ")}`, Object.fromEntries(before.filter((b) => b.key !== "companyLogo").map((b) => [b.key, b.value])), Object.fromEntries(Object.entries(v.values).filter(([k]) => k !== "companyLogo")));
    });
  } catch (e) {
    return dbError(e, "save the settings");
  }
  return { ok: true, message: "Settings saved." };
}
