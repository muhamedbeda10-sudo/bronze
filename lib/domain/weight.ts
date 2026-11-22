// Casting weights (System Documentation §5.2), with the fix from §14:
// each material's own density instead of a fixed 8.8 g/cm³.
//
//   volume (mm³)  hollow  π × ((OD/2)² − (ID/2)²) × L
//                 solid   π × (OD/2)² × L
//                 plate   W × L × H
//   unit (kg)     volume × density (g/cm³) × 1e-6
//   total         unit × qty
//   raw req.      total × (1 + allowance)   — 15% for gates, risers, machining
//   mold-based    mold's approx. piece weight × qty

export const DIMENSION_FORMATS = ["OD_ID_L", "W_L_H", "IMPELLER", "CUSTOM"] as const;
export type DimensionFormat = (typeof DIMENSION_FORMATS)[number];
export const DIMENSION_FORMAT_LABEL: Record<DimensionFormat, string> = {
  OD_ID_L: "OD × ID × Length",
  W_L_H: "W × L × H",
  IMPELLER: "Impeller (diameter, drawing)",
  CUSTOM: "Custom",
};

export const DEFAULT_DENSITY = 8.8;
export const DEFAULT_ALLOWANCE_PCT = 15;

export interface Dimensions {
  od?: number | null;
  innerDia?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface WeightInput extends Dimensions {
  format: DimensionFormat | string;
  qty: number;
  /** g/cm³; a missing or non-positive density falls back to 8.8 */
  density?: number | null;
  allowancePct?: number;
  /** the selected mold's approx. weight of one piece (kg) */
  moldPieceKg?: number | null;
}

export interface Weights {
  volumeMm3: number | null;
  unitKg: number | null;
  totalKg: number | null;
  rawReqKg: number | null;
  moldKg: number | null;
  densityUsed: number;
  /** the weight the order is planned on: calculated, else mold-based */
  expectedKg: number | null;
}

const pos = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Volume in mm³, or null when the dimensions do not define one. */
export function volumeMm3(format: string, d: Dimensions): number | null {
  if (format === "W_L_H") {
    return pos(d.width) && pos(d.length) && pos(d.height) ? d.width * d.length * d.height : null;
  }
  if (format === "OD_ID_L" || format === "IMPELLER" || format === "CUSTOM") {
    if (!pos(d.od) || !pos(d.length)) return null;
    const r = d.od / 2;
    const ri = pos(d.innerDia) ? d.innerDia / 2 : 0;
    if (ri >= r) return null;
    return Math.PI * (r * r - ri * ri) * d.length;
  }
  return null;
}

const round = (v: number, places: number) => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

export function calcWeights(input: WeightInput): Weights {
  const densityUsed = pos(input.density) ? input.density : DEFAULT_DENSITY;
  const allowance = Number.isFinite(input.allowancePct) && (input.allowancePct as number) >= 0 ? (input.allowancePct as number) : DEFAULT_ALLOWANCE_PCT;
  const qty = Number.isFinite(input.qty) && input.qty > 0 ? Math.floor(input.qty) : 0;
  const vol = volumeMm3(String(input.format), input);
  const unit = vol !== null ? vol * densityUsed * 1e-6 : null;
  const total = unit !== null ? unit * qty : null;
  const moldKg = pos(input.moldPieceKg) ? input.moldPieceKg * qty : null;
  const expected = total ?? moldKg;
  const raw = expected !== null ? expected * (1 + allowance / 100) : null;
  return {
    volumeMm3: vol !== null ? round(vol, 0) : null,
    unitKg: unit !== null ? round(unit, 3) : null,
    totalKg: total !== null ? round(total, 2) : null,
    rawReqKg: raw !== null ? round(raw, 2) : null,
    moldKg: moldKg !== null ? round(moldKg, 2) : null,
    densityUsed,
    expectedKg: expected !== null ? round(expected, 2) : null,
  };
}

/** "300x200x10 mm" — the dimensions as the order's name shows them. */
export function dimensionText(format: string, d: Dimensions): string {
  const n = (v: number | null | undefined) => (pos(v) ? String(round(v, 2)) : null);
  const parts = format === "W_L_H" ? [n(d.width), n(d.length), n(d.height)] : [n(d.od), n(d.innerDia) ?? (format === "OD_ID_L" ? "0" : null), n(d.length)];
  const shown = parts.filter((p): p is string => p !== null);
  return shown.length ? `${shown.join("x")} mm` : "";
}

/** 14444-1 - 1/2 - Bars - C90500 - 300x200x10 mm - Qty:10 */
export function fullName(p: { woNo: string; lineNo: number; lineCount: number; product: string; material: string; dims: string; qty: number }): string {
  return [`${p.woNo}-${p.lineNo}`, `${p.lineNo}/${p.lineCount}`, p.product, p.material, p.dims, `Qty:${p.qty}`].filter(Boolean).join(" - ");
}
