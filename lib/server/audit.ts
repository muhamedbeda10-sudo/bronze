import "server-only";
import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";
import type { SessionUser } from "./auth";

/** Strip what never belongs in the log (password hashes) and make it JSON-safe. */
function safe(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v, (k, val) => (k === "passwordHash" ? undefined : val)));
}

/** One line of the change history, written in the same transaction as the change. */
export async function audit(
  tx: Tx,
  user: Pick<SessionUser, "id" | "name"> | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  summary: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: user?.id ?? null,
      userName: user?.name ?? "system",
      action,
      entity,
      entityId: entityId === null ? null : String(entityId),
      summary: summary.slice(0, 500),
      before: safe(before),
      after: safe(after),
    },
  });
}
