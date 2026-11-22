// Numbers as the screens show them: grouped thousands, a fixed number of decimals.
const cache = new Map<number, Intl.NumberFormat>();
function nf(decimals: number) {
  let f = cache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
    cache.set(decimals, f);
  }
  return f;
}

export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return nf(decimals).format(v);
}

export function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${fmtNum(v, 1)}%`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}
