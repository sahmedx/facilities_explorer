import type { Levers } from "./types";
import { defaultLevers } from "./base-case";

/**
 * URL serialization for shareable scenario links.
 *
 *   ?d=125  density           (sqft / HC)
 *   &hc=-5  hcVariance percent (-15..15, integer)
 *   &b=350  buildoutCost       ($/sqft)
 *   &s=5000 snacksPerHCYearly  ($)
 *   &f=3399 fnfPerSeat         ($)
 *   &e=0    expand              (0 = hold the line, 1 = expand. Default 1.)
 *
 * Only emit a key if it differs from default — keeps shared URLs short.
 */

const KEYS = {
  density: "d",
  hcVariance: "hc",
  buildoutCost: "b",
  snacksPerHCYearly: "s",
  fnfPerSeat: "f",
  expand: "e",
} as const satisfies Record<keyof Levers, string>;

export function leversToQuery(levers: Levers): string {
  const params = new URLSearchParams();
  if (levers.density !== defaultLevers.density) {
    params.set(KEYS.density, String(Math.round(levers.density)));
  }
  if (levers.hcVariance !== defaultLevers.hcVariance) {
    params.set(KEYS.hcVariance, String(Math.round(levers.hcVariance * 100)));
  }
  if (levers.buildoutCost !== defaultLevers.buildoutCost) {
    params.set(KEYS.buildoutCost, String(Math.round(levers.buildoutCost)));
  }
  if (levers.snacksPerHCYearly !== defaultLevers.snacksPerHCYearly) {
    params.set(KEYS.snacksPerHCYearly, String(Math.round(levers.snacksPerHCYearly)));
  }
  if (levers.fnfPerSeat !== defaultLevers.fnfPerSeat) {
    params.set(KEYS.fnfPerSeat, String(Math.round(levers.fnfPerSeat)));
  }
  if (levers.expand !== defaultLevers.expand) {
    params.set(KEYS.expand, levers.expand ? "1" : "0");
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function leversFromQuery(search: string): Levers {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return readFromParams((k) => params.get(k));
}

/** Server-side variant: takes Next.js's resolved searchParams object. */
export function leversFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Levers {
  return readFromParams((k) => {
    const v = searchParams[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  });
}

function readFromParams(get: (key: string) => string | null | undefined): Levers {
  const out: Levers = { ...defaultLevers };

  const d = parseNum(get(KEYS.density));
  if (d !== null && d >= 100 && d <= 250) out.density = d;

  const hc = parseNum(get(KEYS.hcVariance));
  if (hc !== null && hc >= -15 && hc <= 15) out.hcVariance = hc / 100;

  const b = parseNum(get(KEYS.buildoutCost));
  if (b !== null && b >= 200 && b <= 600) out.buildoutCost = b;

  const s = parseNum(get(KEYS.snacksPerHCYearly));
  if (s !== null && s >= 3000 && s <= 15000) out.snacksPerHCYearly = s;

  const f = parseNum(get(KEYS.fnfPerSeat));
  if (f !== null && f >= 2000 && f <= 5000) out.fnfPerSeat = f;

  const e = get(KEYS.expand);
  if (e === "0") out.expand = false;
  else if (e === "1") out.expand = true;

  return out;
}

function parseNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
