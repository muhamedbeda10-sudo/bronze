import "server-only";
import { addDays, dayKey, parseDay, today } from "@/lib/domain/dates";

/** A from–to period out of the address, defaulting to the last `days` days; never upside down, never over a year. */
export function periodOf(sp: { from?: string; to?: string }, days = 30) {
  const t = today();
  let to = parseDay(sp.to) ?? t;
  let from = parseDay(sp.from) ?? addDays(to, -(days - 1));
  if (from > to) [from, to] = [to, from];
  if ((to.getTime() - from.getTime()) / 86_400_000 > 366) from = addDays(to, -366);
  return { from, to, today: t, defaults: { from: dayKey(addDays(t, -(days - 1))), to: dayKey(t) } };
}

export const idParam = (v: string | undefined): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
