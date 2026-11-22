// The company profile and the plant's settings (Settings → General).
// Stored one row per key; read through readSettings, so a missing or
// broken value always falls back to its default.

import { DEFAULT_ALLOWANCE_PCT, DEFAULT_DENSITY } from "./weight";

export interface AppSettings {
  companyName: string;
  companyEmail: string;
  /** a data: URL, ≤ 1 MB, or "" for the built-in logo */
  companyLogo: string;
  /** % added to the casting weight for gates, risers and machining */
  rawAllowancePct: number;
  /** used when a material has no density of its own */
  defaultDensity: number;
  /** hours a machine can run in a day (both shifts) — the utilization base */
  machineHoursPerDay: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: "Lotfy Bronze",
  companyEmail: "info@lotfybronze.com",
  companyLogo: "",
  rawAllowancePct: DEFAULT_ALLOWANCE_PCT,
  defaultDensity: DEFAULT_DENSITY,
  machineHoursPerDay: 16,
};

const NUMERIC: Record<string, [number, number]> = {
  rawAllowancePct: [0, 100],
  defaultDensity: [0.5, 25],
  machineHoursPerDay: [1, 24],
};

export function readSettings(rows: { key: string; value: string }[]): AppSettings {
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    if (key in NUMERIC) {
      const n = Number(value);
      const [lo, hi] = NUMERIC[key];
      if (Number.isFinite(n) && n >= lo && n <= hi) (out as unknown as Record<string, number>)[key] = n;
    } else {
      (out as unknown as Record<string, string>)[key] = value;
    }
  }
  return out;
}

/** Checks a settings form; returns the clean values or the first problem. */
export function validateSettings(input: Record<string, unknown>): { ok: true; values: Partial<AppSettings> } | { ok: false; error: string } {
  const values: Partial<AppSettings> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    if (key in NUMERIC) {
      const n = Number(raw);
      const [lo, hi] = NUMERIC[key];
      if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false, error: `${key} must be between ${lo} and ${hi}.` };
      (values as Record<string, number>)[key] = n;
    } else {
      const s = String(raw ?? "").trim();
      if (key === "companyName" && !s) return { ok: false, error: "The company name is required." };
      if (key === "companyEmail" && s && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return { ok: false, error: "The company email is not valid." };
      if (key === "companyLogo" && s && (!s.startsWith("data:image/") || s.length > 1_400_000)) return { ok: false, error: "The logo must be an image of 1 MB or less." };
      (values as Record<string, string>)[key] = s;
    }
  }
  return { ok: true, values };
}
