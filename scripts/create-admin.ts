// Create (or reset) an admin account on any database — the production one included.
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin
// The account gets every module in full. Re-running resets the password and re-activates it.

// the .env beside the app (Windows has no shell to load it); variables already set win
try { process.loadEnvFile(".env"); } catch {}

import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/server/password";
import { MODULES } from "@/lib/domain/access";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Set ADMIN_EMAIL to a valid email.");
  const p = passwordProblem(password);
  if (p) throw new Error(`ADMIN_PASSWORD: ${p}`);
  const access = Object.fromEntries(MODULES.map((m) => [m, "F"]));
  const u = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Administrator", role: "ADMIN", access, passwordHash: hashPassword(password) },
    update: { role: "ADMIN", access, active: true, passwordHash: hashPassword(password) },
  });
  await prisma.session.deleteMany({ where: { userId: u.id } });
  await prisma.auditLog.create({ data: { userName: "system", action: "update", entity: "User", entityId: String(u.id), summary: `Admin account ${email} created or reset from the command line` } });
  console.log(`Admin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
