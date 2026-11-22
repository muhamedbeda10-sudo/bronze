// Calendar dates. A work date is a day, not an instant: it is stored as
// midnight UTC of that day (Postgres DATE) and typed as "YYYY-MM-DD".
// "Today" is the plant's day, in Cairo.

export const PLANT_TZ = "Africa/Cairo";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-22" → Date at 00:00 UTC, or null for anything else. */
export function parseDay(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = ISO.exec(v.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

/** Date → "YYYY-MM-DD" (its UTC day — how a stored day reads back). */
export function dayKey(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

/** The plant's today as "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PLANT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function today(now: Date = new Date()): Date {
  return parseDay(todayKey(now))!;
}

const DAY_MS = 86_400_000;

/** Whole days from a to b (b − a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / DAY_MS);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Every day from `from` to `to`, both included. */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let d = from; d.getTime() <= to.getTime() && out.length < 1000; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Monday of the week holding `d`. */
export function weekStart(d: Date): Date {
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(d, -dow);
}

/** "22 Nov 2026" */
export function fmtDay(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? parseDay(d) ?? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** "22 Nov 2026, 14:05" in the plant's time — for instants (created, approved). */
export function fmtInstant(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: PLANT_TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

/** "HH:MM" → minutes after midnight, or null. */
export function parseClock(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Hours between two clock times; an end before the start runs past midnight (a night shift). */
export function clockHours(from: string, to: string): number | null {
  const a = parseClock(from);
  const b = parseClock(to);
  if (a === null || b === null) return null;
  const mins = b >= a ? b - a : b + 1440 - a;
  return Math.round((mins / 60) * 100) / 100;
}

/** Days an order is late: past its due date, up to its completion (or today). */
export function delayDays(due: Date | null, done: Date | null, todayDate: Date): number {
  if (!due) return 0;
  return Math.max(0, daysBetween(due, done ?? todayDate));
}
