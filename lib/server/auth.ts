import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { can, parseAccess, type Access, type Level, type Module } from "@/lib/domain/access";

export const SESSION_COOKIE = "lb_session";
const SESSION_DAYS = 14;

export { hashPassword, verifyPassword, passwordProblem } from "./password";

// ---- sessions: a random token in the cookie, sha256(token) as the key ----

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: tokenId(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: tokenId(token) } });
  store.delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: string;
  access: Access;
  workshopId: number | null;
  position: string | null;
}

/** The signed-in person, or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: tokenId(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  const u = s.user;
  return { id: u.id, email: u.email, name: u.name, role: u.role, access: parseAccess(u.access), workshopId: u.workshopId, position: u.position };
});

/** A page's guard: signed in and allowed to see the module, else sent away. */
export async function pageUser(module: Module, need: Level = "V"): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!can(user.access, module, need)) redirect("/no-access");
  return user;
}

export const NOT_SIGNED_IN = "You are not signed in — refresh the page.";
export const NO_PERMISSION = "You do not have permission for this — ask the admin.";

/** A server action's guard: the user, or (a string) the reason it is refused. */
export async function actionUser(module: Module, need: Level): Promise<SessionUser | string> {
  const user = await getUser();
  if (!user) return NOT_SIGNED_IN;
  if (!can(user.access, module, need)) return NO_PERMISSION;
  return user;
}
