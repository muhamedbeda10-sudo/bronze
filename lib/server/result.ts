// What every server action answers: done (with an optional message or id), or why not.
export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** A database error a person can act on; anything else gets a plain line and goes to the log. */
export function dbError(e: unknown, what = "save"): { ok: false; error: string } {
  const code = (e as { code?: string })?.code;
  if (code === "P2002") return fail("That code or number is already used — each must be unique.");
  if (code === "P2003" || code === "P2014") return fail("It is still used elsewhere (orders, stock, logs) — it cannot be removed.");
  if (code === "P2025") return fail("It no longer exists — refresh the page.");
  console.error(`[${what}]`, e);
  return fail(`Could not ${what} — try again, or tell the admin if it keeps failing.`);
}

/** A stale-screen refusal: someone else changed the row since it was drawn. */
export const STALE = "Someone else changed this order a moment ago — the page has been refreshed, check it and try again.";
