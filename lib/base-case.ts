import baseCaseJson from "@/data/base-case.json";
import type { BaseCase, Levers } from "./types";

export const baseCase = baseCaseJson as unknown as BaseCase;

// Hold-the-line is the new "do nothing" anchor: same FY27 plan inputs as the
// management forecast but with capacity expansion turned off. Deltas on the
// KPI cards therefore read as "this is what the expansion decision costs you."
export const defaultLevers: Levers = {
  density: baseCase.fy27Defaults.densitySqftPerHC,
  hcVariance: baseCase.fy27Defaults.hcVariancePct,
  buildoutCost: baseCase.fy27Defaults.buildoutCostPerSqft,
  snacksPerHCYearly: baseCase.fy27Defaults.snacksPerHCYearly,
  fnfPerSeat: baseCase.fy27Defaults.fnfPerSeat,
  expand: false,
};

export const presets: Record<"holdLine" | "expandToPlan" | "investAhead", Levers> = {
  // Order matters — this is the display order in the preset row.
  // Hold-the-line and expand-to-plan share all numeric inputs (= FY27 plan as
  // written, lifted from base-case.json fy27Defaults). They differ only on
  // whether expansion happens.
  holdLine: { ...defaultLevers },
  expandToPlan: { ...defaultLevers, expand: true },
  investAhead: {
    ...defaultLevers,
    density: 200,
    buildoutCost: 500,
    fnfPerSeat: 4500,
    expand: true,
  },
};
