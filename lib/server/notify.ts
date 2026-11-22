import "server-only";
import type { Tx } from "@/lib/db";
import { can, parseAccess, type Level, type Module } from "@/lib/domain/access";

export interface Note { kind: string; title: string; body?: string | null; link: string }

/** Tell these people (never the one acting). */
export async function notify(tx: Tx, userIds: number[], note: Note, actorId: number | null): Promise<void> {
  const ids = [...new Set(userIds)].filter((id) => id !== actorId);
  if (!ids.length) return;
  await tx.notification.createMany({ data: ids.map((userId) => ({ userId, kind: note.kind, title: note.title.slice(0, 200), body: note.body?.slice(0, 500) ?? null, link: note.link })) });
}

/** Tell everyone active who holds `level` on `module` — the approvers, the inspectors, the store. */
export async function notifyRole(tx: Tx, module: Module, level: Level, note: Note, actorId: number | null, extra?: (u: { workshopId: number | null }) => boolean): Promise<void> {
  const users = await tx.user.findMany({ where: { active: true }, select: { id: true, access: true, workshopId: true } });
  await notify(tx, users.filter((u) => can(parseAccess(u.access), module, level) && (!extra || extra(u))).map((u) => u.id), note, actorId);
}
