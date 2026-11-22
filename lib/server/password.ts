import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Passwords: scrypt (built in, no dependency), stored as salt:hash hex.

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "The password needs at least 8 characters.";
  if (pw.length > 200) return "The password is too long.";
  return null;
}
