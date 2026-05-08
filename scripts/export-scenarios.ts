/**
 * Export scenarios to JSON for the Excel workbook.
 *
 * Runs `computeScenario` against `presets.holdLine` and `presets.expandToPlan`
 * and writes a flattened, Excel-friendly JSON to `data/scenarios.json`.
 *
 * Usage from the explorer/ directory:
 *   npx --yes tsx scripts/export-scenarios.ts
 *
 * The output is the canonical hold-vs-expand source of truth for the
 * `phase9_excel.py` workbook generator. compute.ts is the engine — Excel
 * never re-implements the lever math.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeScenario } from "../lib/compute";
import { baseCase, presets } from "../lib/base-case";
import type { Scenario } from "../lib/types";

// Strip per-month arrays from the scenario — Excel only needs annual totals
// and the high-level shapes. Keeping the JSON compact also makes it easier
// to inspect by hand if anything looks off.
function flatten(scenario: Scenario) {
  return {
    kpis: scenario.kpis,
    pnl: scenario.pnl,
    bs: scenario.bs,
    cf: scenario.cf,
    capex: {
      lhi: scenario.capex.lhi,
      fnf: scenario.capex.fnf,
      oe: scenario.capex.oe,
      total: scenario.capex.total,
      expansionSqft: scenario.capex.expansionSqft,
    },
    threeStmtRows: scenario.threeStmtRows.map((r) => ({
      label: r.label,
      statement: r.statement,
      fy26: r.fy26,
      current: r.current,
      driver: r.driver,
    })),
    bucketDetail: scenario.bucketDetail,
    waterfall: scenario.waterfall,
    reasonability: scenario.reasonability.map((r) => ({
      office: r.office,
      fy27AvgHC: r.fy27AvgHC,
      fy27SqftWeighted: r.fy27SqftWeighted,
      sqftPerHC: r.sqftPerHC,
      rentPerSqftPerYr: r.rentPerSqftPerYr,
      snacksPerHCPerYr: r.snacksPerHCPerYr,
      utilitiesPerSqftPerYr: r.utilitiesPerSqftPerYr,
    })),
  };
}

const hold = computeScenario(baseCase, presets.holdLine);
const expand = computeScenario(baseCase, presets.expandToPlan);

const out = {
  generatedAt: new Date().toISOString(),
  scenarios: {
    holdLine: flatten(hold),
    expandToPlan: flatten(expand),
  },
};

const outPath = resolve(__dirname, "..", "data", "scenarios.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(
  `Wrote ${outPath}\n` +
    `  holdLine.kpis.grossPnL      = $${hold.kpis.grossPnL.toLocaleString()}\n` +
    `  expandToPlan.kpis.grossPnL  = $${expand.kpis.grossPnL.toLocaleString()}\n` +
    `  holdLine.kpis.totalCapex    = $${hold.kpis.totalCapex.toLocaleString()}\n` +
    `  expandToPlan.kpis.totalCapex = $${expand.kpis.totalCapex.toLocaleString()}\n` +
    `  holdLine.kpis.netCashChange = $${hold.kpis.netCashChange.toLocaleString()}\n` +
    `  expandToPlan.kpis.netCashChange = $${expand.kpis.netCashChange.toLocaleString()}`,
);
