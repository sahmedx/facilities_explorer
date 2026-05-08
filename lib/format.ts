/**
 * Mono number formatters for the FY27 Facilities Explorer.
 *
 * Conventions (PLAN.md §3.1):
 *   - Currency suffixed with M (millions), K (thousands), or no suffix.
 *   - Negatives use the true minus sign U+2212 (−), never the ASCII hyphen.
 *   - Deltas always carry an explicit sign, including ±$0 for zero.
 */

const MINUS = "−"; // true minus

export function fmtMoneyShort(value: number, options: { fractionDigits?: number } = {}): string {
  const fd = options.fractionDigits ?? 1;
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(fd)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtMoneyFull(value: number): string {
  const sign = value < 0 ? MINUS : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

/** Signed full-dollar delta (no M/K suffix). For values where precision in the
 *  hundreds or low thousands matters (e.g., $/FTE deltas). */
export function fmtMoneyFullDelta(value: number): string {
  if (Math.abs(value) < 0.5) return "±$0";
  const sign = value < 0 ? MINUS : "+";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

/** Signed delta with explicit + / − / ±. */
export function fmtDelta(value: number, options: { fractionDigits?: number } = {}): string {
  if (Math.abs(value) < 0.5) return "±$0";
  const fd = options.fractionDigits ?? 1;
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : "+";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(fd)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Sign class for delta cells: "pos" (oxblood = unfavorable), "neg" (sage = favorable), or null for ±$0. */
export function deltaClass(
  value: number,
  options: { signFlipForDelta?: boolean } = {},
): "pos" | "neg" | null {
  if (Math.abs(value) < 0.5) return null;
  const flipped = options.signFlipForDelta ? -value : value;
  return flipped > 0 ? "pos" : "neg";
}

export function fmtSqft(value: number): string {
  const sign = value < 0 ? MINUS : "+";
  if (Math.abs(value) < 0.5) return "+0 sqft";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("en-US")} sqft`;
}

export function fmtPercent(value: number, fractionDigits = 0): string {
  const sign = value < 0 ? MINUS : value > 0 ? "+" : "";
  return `${sign}${Math.abs(value * 100).toFixed(fractionDigits)}%`;
}

export function fmtInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
