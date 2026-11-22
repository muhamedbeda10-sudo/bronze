"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getUser, hashPassword, passwordProblem, verifyPassword } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { homePath, parseAccess, ROLE_ACCESS } from "@/lib/domain/access";

export type FormState = { error?: string } | undefined;

// a small brake on password guessing: per address, in this process
const tries = new Map<string, { n: number; until: number }>();
async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const key = await clientKey();
  const t = tries.get(key);
  if (t && t.n >= 8 && t.until > Date.now()) return { error: "Too many attempts — wait a few minutes and try again." };
  const user = await prisma.user.findUnique({ where: { email } });
  // the same answer whether the email exists or not
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    tries.set(key, { n: (t && t.until > Date.now() ? t.n : 0) + 1, until: Date.now() + 5 * 60_000 });
    return { error: "The email or password is not right." };
  }
  tries.delete(key);
  await createSession(user.id);
  await prisma.$transaction((tx) => audit(tx, { id: user.id, name: user.name }, "login", "User", user.id, `${user.name} signed in`));
  redirect(homePath(parseAccess(user.access)));
}

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name || name.length > 100) return { error: "Enter your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  const pw = passwordProblem(password);
  if (pw) return { error: pw };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "An account with this email already exists — sign in instead." };
  // a new account sees the Dashboard only, until an admin gives it its menus (§2)
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { name, email, passwordHash: hashPassword(password), role: "USER", access: ROLE_ACCESS.USER } });
    await audit(tx, { id: u.id, name: u.name }, "create", "User", u.id, `${name} signed up`);
    return u;
  });
  await createSession(user.id);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const user = await getUser();
  await destroySession();
  if (user) await prisma.$transaction((tx) => audit(tx, user, "logout", "User", user.id, `${user.name} signed out`));
  redirect("/login");
}
