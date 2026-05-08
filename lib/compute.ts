import { baseCase, defaultLevers } from "./base-case";
import type {
  BaseCase,
  BucketDetailRow,
  BucketName,
  DriverFamily,
  Levers,
  ReasonabilityRow,
  Scenario,
  ThreeStmtRow,
  WaterfallStep,
} from "./types";

// ────────────────────────────────────────────────────────────────────────
// Bucket → driver-family mapping. Mirrors FORECAST_DRIVERS.md §1.
// Order is the canonical display order (FORECAST_DRIVERS.md §2): largest
// driver families first, within each family ordered by typical FY27 magnitude.
// ────────────────────────────────────────────────────────────────────────
// Annual inflation assumption (matches parent project's assumptions.csv).
// Used only when `expand: false` — see the override block below the per-office
// accumulation loop for why.
const INFLATION_RATE = 0.03;

const BUCKET_DRIVERS: Array<{ bucket: BucketName; driver: DriverFamily; label: string }> = [
  { bucket: "Rent",              driver: "rent",           label: "Sqft × 3% escalator" },
  { bucket: "Utilities",         driver: "sqftXInflation", label: "Sqft × inflation" },
  { bucket: "Maintenance",       driver: "sqftXInflation", label: "Sqft × inflation" },
  { bucket: "Insurance",         driver: "sqftXInflation", label: "Sqft × inflation" },
  { bucket: "FacilitiesPayroll", driver: "sqftXInflation", label: "Sqft × inflation" },
  { bucket: "Snacks",            driver: "snacks",         label: "HC × snacks rate" },
  { bucket: "TandE",             driver: "hcXInflation",   label: "HC × inflation" },
  { bucket: "OfficeSupplies",    driver: "hcXInflation",   label: "HC × inflation" },
  { bucket: "TeamEvents",        driver: "hcXInflation",   label: "HC × inflation" },
  { bucket: "Postage",           driver: "hcXInflation",   label: "HC × inflation" },
  { bucket: "FurnitureOpex",     driver: "hcXInflation",   label: "HC × inflation" },
  { bucket: "EquipSoftware",     driver: "hcXInflation",   label: "HC × inflation" },
  { bucket: "BankCharges",       driver: "inflationOnly",  label: "Inflation only" },
  { bucket: "ProfServices",      driver: "inflationOnly",  label: "Inflation only" },
  { bucket: "Taxes",             driver: "inflationOnly",  label: "Inflation only" },
  { bucket: "Depreciation",      driver: "depreciation",   label: "Asset roll-forward" },
];

/**
 * Math engine — pure function: same inputs → same outputs, no I/O.
 *
 * Approach: take parent project's FY27 default monthly cell values
 * (per office × per category) and apply lever-driven multipliers.
 * At default levers all multipliers = 1.0, so KPIs reconcile to the
 * writeup's $33.23M / $5.22M / $13.44M / -$12.41M / +34,800 sqft anchors
 * by construction.
 *
 * Lever effects:
 *   density           → sqft-driven costs (rent + sqft-other) for post-expansion months,
 *                       plus LHI capex
 *   hcVariance        → HC-driven costs (snacks + hc-other), capex via HC delta,
 *                       and per-office FacilitiesPayroll
 *   buildoutCost      → LHI capex only (linear)
 *   snacksPerHCYearly → snacks line only (linear)
 *   fnfPerSeat        → FF capex only (linear; new-asset dep flows through)
 *   expand            → false ⇒ no new sqft, zero LHI + F&F capex, OE continues
 *                       (HC growth still drives laptop/equipment spend). Sf/HC
 *                       drops below the 150 target across expanding offices —
 *                       the breach is the *point* of the scenario.
 */
export function computeScenario(
  base: BaseCase = baseCase,
  levers: Levers = defaultLevers,
): Scenario {
  const { fy27Defaults, useful_lives_years } = base;
  const { expansionMonth, effectiveAllocationRatio } = fy27Defaults;
  const months = base.fy27Months;
  const expansionMonthIdx = months.indexOf(expansionMonth);
  const monthCount = months.length;

  // ────────────────────────────────────────────────────────────────────
  // Default-vs-current scaling factors per category.
  // ────────────────────────────────────────────────────────────────────
  const hcFactor = 1 + levers.hcVariance;
  const snacksRateFactor = levers.snacksPerHCYearly / fy27Defaults.snacksPerHCYearly;
  const buildoutFactor = levers.buildoutCost / fy27Defaults.buildoutCostPerSqft;
  const fnfFactor = levers.fnfPerSeat / fy27Defaults.fnfPerSeat;

  // ────────────────────────────────────────────────────────────────────
  // Per-office: density-driven sqft scaling for post-expansion months.
  //   Pre-expansion months: factor = 1.0 (sqft unchanged).
  //   Post-expansion months: factor = newPostSqft / defaultPostSqft.
  //
  // newPostSqft logic (mirrors parent project sqft_plan):
  //   peakLeveredHC = max(hc[m]) × (1 + hcVariance)
  //   required = peakLeveredHC × density
  //   if required > sqftCurrent: expand to `required` (capacityBreach)
  //   else: no expansion → newPostSqft = sqftCurrent
  // ────────────────────────────────────────────────────────────────────
  type OfficeRollup = {
    name: string;
    leveredPeakHC: number;
    leveredHcMonthly: number[];
    leveredHcAnchor: number;
    sqftPre: number;
    defaultPostSqft: number;     // parent's plan at density 150
    newPostSqft: number;
    newExpansionSqft: number;
    sqftFactor: number[];        // 12 entries, per month
  };

  const officeRollups: OfficeRollup[] = base.offices.map((o) => {
    const leveredHcMonthly = o.fy27MonthlyHC.map((h) => h * hcFactor);
    const leveredHcAnchor = o.hcAnchorJan2026 * hcFactor;
    const peakHC = Math.max(...leveredHcMonthly);

    const requiredSqft = peakHC * levers.density;
    // expand=false ⇒ stay in existing footprint regardless of density × HC.
    const wouldExpand = requiredSqft > o.sqftCurrent;
    const newPostSqft = !levers.expand
      ? o.sqftCurrent
      : wouldExpand
        ? Math.round(requiredSqft)
        : o.sqftCurrent;
    const newExpansionSqft = newPostSqft - o.sqftCurrent;
    const defaultPostSqft = o.sqftPostExpansion;

    const sqftFactor = months.map((_m, idx) =>
      idx < expansionMonthIdx ? 1.0 : newPostSqft / defaultPostSqft,
    );

    return {
      name: o.name,
      leveredPeakHC: peakHC,
      leveredHcMonthly,
      leveredHcAnchor,
      sqftPre: o.sqftCurrent,
      defaultPostSqft,
      newPostSqft,
      newExpansionSqft,
      sqftFactor,
    };
  });

  // ────────────────────────────────────────────────────────────────────
  // Per-office monthly P&L (excluding depreciation, allocations, unallocated).
  //
  // For each office and month:
  //   rent[m]              = default × sqftFactor[m]   (3% escalator in default)
  //   sqftOther[m]         = default × sqftFactor[m]   (Util/Maint/Insur)
  //   snacks[m]            = default × hcFactor × snacksRateFactor
  //   hcDriven[m]          = default × hcFactor
  //   facilitiesPayroll[m] = default × sqftFactor[m]   (sqft-driven, NOT HC)
  //   otherFixed[m]        = default                   (held flat under levers;
  //                                                     inflation already in
  //                                                     the FY27 default)
  //
  //   "fixed" is reported as the sum of facilitiesPayroll + otherFixed for
  //   downstream consumers (waterfall + 3-stmt walk) — but the *scaling*
  //   inside the engine respects each bucket's actual driver.
  // ────────────────────────────────────────────────────────────────────
  const officeMonthlyGross = months.map(() => 0);
  let totalRent = 0;
  let totalSqftOther = 0;
  let totalSnacks = 0;
  let totalHcDriven = 0;
  let totalFacilitiesPayroll = 0;
  let totalOtherFixed = 0;

  base.offices.forEach((office, oi) => {
    const r = officeRollups[oi];
    months.forEach((_m, idx) => {
      const rent = office.fy27DefaultMonthly.rent[idx] * r.sqftFactor[idx];
      const sqftOther =
        office.fy27DefaultMonthly.sqftDrivenOther[idx] * r.sqftFactor[idx];
      const snacks =
        office.fy27DefaultMonthly.snacks[idx] * hcFactor * snacksRateFactor;
      const hcDriven = office.fy27DefaultMonthly.hcDrivenExSnacks[idx] * hcFactor;
      const fp = office.fy27DefaultMonthly.facilitiesPayroll[idx] * r.sqftFactor[idx];
      const otherFixed = office.fy27DefaultMonthly.otherFixed[idx];
      officeMonthlyGross[idx] += rent + sqftOther + snacks + hcDriven + fp + otherFixed;
      totalRent += rent;
      totalSqftOther += sqftOther;
      totalSnacks += snacks;
      totalHcDriven += hcDriven;
      totalFacilitiesPayroll += fp;
      totalOtherFixed += otherFixed;
    });
  });

  // Unallocated: corporate / INTL spend that doesn't tag a specific office.
  // Held flat at parent's default (no lever scaling), but split by bucket type
  // and added to the corresponding totals so the waterfall categorization
  // matches FY26's by-bucket aggregation. Without this split, Unallocated T&E
  // / OfficeSupplies / Snacks would lump into "Fixed + unallocated" while
  // their FY26 counterparts sat in HC-driven OPEX / Snacks — making those
  // bars appear to shrink when the underlying GLs are actually growing.
  const u = base.unallocated.fy27DefaultMonthly;
  const sumArr = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const unallocRent = sumArr(u.rent);
  const unallocSqftOther = sumArr(u.sqftDrivenOther);
  const unallocSnacks = sumArr(u.snacks);
  const unallocHcDriven = sumArr(u.hcDrivenExSnacks);
  // Unallocated FacilitiesPayroll has no per-office sqft to scale against
  // (corporate facilities team), so it stays flat. OtherFixed is also flat.
  const unallocFacilitiesPayroll = sumArr(u.facilitiesPayroll);
  const unallocOtherFixed = sumArr(u.otherFixed);

  totalRent += unallocRent;
  totalSqftOther += unallocSqftOther;
  totalSnacks += unallocSnacks;
  totalHcDriven += unallocHcDriven;
  totalFacilitiesPayroll += unallocFacilitiesPayroll;
  totalOtherFixed += unallocOtherFixed;

  // Inflation-only override for expand=false. The per-office FY27 default
  // monthly cells were generated assuming the parent's mid-year expansion;
  // scaling them by sqftFactor only partially undoes that, leaving sqft-driven
  // buckets *below* FY26 under Baseline. The intuitive "no expansion" anchor
  // is FY26 × inflation (existing footprint, FY27 unit rates), so we override
  // the three sqft-driven family totals here. Snacks, HC-driven, and otherFixed
  // are unaffected (their lever math doesn't depend on expand).
  if (!levers.expand) {
    totalRent              = base.fy26ByCategory.rent              * (1 + INFLATION_RATE);
    totalSqftOther         = base.fy26ByCategory.sqftDrivenOther   * (1 + INFLATION_RATE);
    totalFacilitiesPayroll = base.fy26ByBucket.FacilitiesPayroll   * (1 + INFLATION_RATE);
  }

  // Combined "fixed" exposed to downstream waterfall + 3-stmt walk consumers.
  const totalFixedPerOffice = totalFacilitiesPayroll + totalOtherFixed;

  // Annual total kept for chart series + 3-stmt detail breakdown.
  const totalUnallocated = sumArr(u.total);

  // ────────────────────────────────────────────────────────────────────
  // Capex.
  //   LHI = totalNewExpansionSqft × buildoutCost
  //   FF + OE = sum over months of (HC delta × per-seat rate)
  //     where HC delta uses the levered HC trajectory (anchored at Jan 2026).
  // ────────────────────────────────────────────────────────────────────
  const totalExpansionSqft = officeRollups.reduce(
    (s, r) => s + Math.max(0, r.newExpansionSqft),
    0,
  );
  const lhiCapex = totalExpansionSqft * levers.buildoutCost;

  // F&F capex zeroes out under hold-the-line: new HC are absorbed into existing
  // seats (cram / hot-desk), so no furniture is bought. OE continues — laptops
  // and equipment are per-person spend, untied to the floor plan.
  let ffCapex = 0;
  let oeCapex = 0;
  const ffMonthlyAdditions: number[] = [];
  const oeMonthlyAdditions: number[] = [];

  months.forEach((_m, idx) => {
    let ffMonth = 0;
    let oeMonth = 0;
    base.offices.forEach((_office, oi) => {
      const r = officeRollups[oi];
      const prev = idx === 0 ? r.leveredHcAnchor : r.leveredHcMonthly[idx - 1];
      const cur = r.leveredHcMonthly[idx];
      const delta = Math.max(0, cur - prev);
      if (levers.expand) ffMonth += delta * levers.fnfPerSeat;
      oeMonth += delta * fy27Defaults.oePerHC;
    });
    ffMonthlyAdditions.push(ffMonth);
    oeMonthlyAdditions.push(oeMonth);
    ffCapex += ffMonth;
    oeCapex += oeMonth;
  });

  const totalCapex = lhiCapex + ffCapex + oeCapex;

  const capexMonthly = months.map((_m, idx) => {
    let v = ffMonthlyAdditions[idx] + oeMonthlyAdditions[idx];
    if (idx === expansionMonthIdx) v += lhiCapex;
    return v;
  });

  // ────────────────────────────────────────────────────────────────────
  // Depreciation.
  //   Existing run-rate = constant (parent's Phase 5 by-asset existing dep).
  //   New-asset dep = SL on new capex from month after place-in-service.
  //
  //   At default levers, this should sum to ~$4.02M (matches parent integrated
  //   walk). LHI new dep = $12.18M / (7×12) × 6 months = $870k (place=Jul,
  //   first dep month = Aug → 6 months of dep through Jan).
  // ────────────────────────────────────────────────────────────────────
  const existing = base.depreciation.existingAnnualByType;

  const lhiNewMonthlyRate = lhiCapex / (useful_lives_years.LHI * 12);
  const lhiMonthsOfDep = monthCount - expansionMonthIdx - 1;
  const lhiNewDep = lhiNewMonthlyRate * lhiMonthsOfDep;

  let ffNewDep = 0;
  let oeNewDep = 0;
  ffMonthlyAdditions.forEach((add, idx) => {
    const monthsRemaining = monthCount - idx - 1;
    if (monthsRemaining > 0) {
      ffNewDep += (add / (useful_lives_years.FF * 12)) * monthsRemaining;
    }
  });
  oeMonthlyAdditions.forEach((add, idx) => {
    const monthsRemaining = monthCount - idx - 1;
    if (monthsRemaining > 0) {
      oeNewDep += (add / (useful_lives_years.OE * 12)) * monthsRemaining;
    }
  });

  const depreciation =
    existing.LHI + existing.FF + existing.OE + lhiNewDep + ffNewDep + oeNewDep;

  // ────────────────────────────────────────────────────────────────────
  // Aggregate gross / allocations / net.
  // ────────────────────────────────────────────────────────────────────
  // Unallocated is already folded into totalRent / totalSqftOther / etc.
  // above, so don't add it again here.
  const grossExclDep =
    totalRent +
    totalSqftOther +
    totalSnacks +
    totalHcDriven +
    totalFixedPerOffice;

  const gross = grossExclDep + depreciation;
  const allocations = -effectiveAllocationRatio * gross;
  const netPretax = gross + allocations;

  // ────────────────────────────────────────────────────────────────────
  // FY27 monthly gross series for chart (sums all per-office monthly P&L
  // plus monthly unallocated and monthly dep).
  // ────────────────────────────────────────────────────────────────────
  const fy27MonthlyGross = months.map((_m, idx) => {
    let monthSum = officeMonthlyGross[idx];
    monthSum += u.total[idx];
    // Existing dep monthly + new-asset cumulative (approximation; annual matches)
    const existingDepMonthly =
      (existing.LHI + existing.FF + existing.OE) / 12;
    let newDepThisMonth = 0;
    for (let j = 0; j < idx; j++) {
      newDepThisMonth +=
        ffMonthlyAdditions[j] / (useful_lives_years.FF * 12) +
        oeMonthlyAdditions[j] / (useful_lives_years.OE * 12);
      if (j >= expansionMonthIdx) {
        newDepThisMonth += lhiNewMonthlyRate;
      }
    }
    monthSum += existingDepMonthly + newDepThisMonth;
    return monthSum;
  });

  // ────────────────────────────────────────────────────────────────────
  // Cash flow — gross-OPEX framing.
  //
  //   Allocations are intercompany: dollars never actually leave the company,
  //   they're transferred between cost centers. So from a corporate cash-flow
  //   perspective, the cash impact of facilities is the GROSS spend, not the
  //   net-of-allocations P&L. We compute:
  //
  //     Operating cash = -grossExclDep + ΔAP
  //                      (grossExclDep = cash OPEX; D&A is non-cash so
  //                       excluded entirely rather than added back)
  //     Investing cash = -capex
  //     Net cash       = operating + investing
  //
  //   ΔAP scales linearly with gross (default ratio ~$2.23M ÷ $35.5M ≈ 6%).
  // ────────────────────────────────────────────────────────────────────
  const deltaAPRatio =
    base.fy27DefaultReference.deltaAP /
    base.fy27DefaultReference.totalGrossCorrected;
  const deltaAP = deltaAPRatio * gross;
  const operating = -grossExclDep + deltaAP;
  const investing = -totalCapex;
  const financing = 0;
  const netCashChange = operating + investing + financing;

  // ────────────────────────────────────────────────────────────────────
  // BS movements — allocations excluded.
  //
  // Retained earnings impact mirrors gross facilities P&L (the actual cost
  // the corporation bears). Allocations are intercompany reclassifications
  // — they shift cost between departments but don't change the company's
  // total RE. Treating Δ RE as -gross keeps the BS view consistent with
  // the cash-flow framing.
  // ────────────────────────────────────────────────────────────────────
  const deltaFAGross = totalCapex;
  const deltaAccumDep = -depreciation;
  const deltaFANet = deltaFAGross + deltaAccumDep;
  const deltaRetainedEarnings = -gross;

  // ────────────────────────────────────────────────────────────────────
  // 3-stmt rows (current values; base values overlaid by caller).
  // ────────────────────────────────────────────────────────────────────
  // Sign-flip rules: signFlipForDelta = true when the row's natural sign means
  // "more positive = better outcome." For most P&L cost rows: more positive =
  // more cost = worse, so default (no flip) is right. For cash-positive rows
  // and accumulated-dep growth (which is stored as negative), positive Δ ⇒
  // good ⇒ should render as sage, hence flip.
  //
  // Drivers are succinct per-line attributions lifted from WRITEUP_CALLOUTS.md
  // §Like-for-like Apr–Jan view, adapted to full-year context.
  const fy26 = base.fy26ByCategory;
  const threeStmtRows: ThreeStmtRow[] = [
    { label: "Rent",                       statement: "pnl", fy26: fy26.rent,                 current: totalRent,                              driver: "Capacity expansion + 3% escalator" },
    { label: "Sqft-driven other",          statement: "pnl", fy26: fy26.sqftDrivenOther + base.fy26ByBucket.FacilitiesPayroll, current: totalSqftOther + totalFacilitiesPayroll, driver: "Sqft × inflation (utilities/maint/insur/fac payroll)" },
    { label: "Snacks",                     statement: "pnl", fy26: fy26.snacks,               current: totalSnacks,                            driver: "HC × snacks rate" },
    { label: "HC-driven OPEX",             statement: "pnl", fy26: fy26.hcDrivenExSnacks,     current: totalHcDriven,                          driver: "Per-HC OPEX rates × HC" },
    { label: "Miscellaneous",              statement: "pnl", fy26: base.fy26ByBucket.BankCharges + base.fy26ByBucket.ProfServices + base.fy26ByBucket.Taxes, current: totalOtherFixed, driver: "Inflation only (bank/prof svcs/taxes)" },
    { label: "Depreciation",               statement: "pnl", fy26: fy26.depreciation,         current: depreciation,                           driver: "Existing run-rate + new-asset SL" },
    { label: "Gross facilities P&L",       statement: "pnl", fy26: fy26.gross,                current: gross,                                  driver: "Sum of all P&L lines above",       emphasized: true },
    { label: "Δ Fixed assets (net)",       statement: "bs",  fy26: null,                      current: deltaFANet,                             driver: "Capex placed − depreciation" },
    { label: "Δ Accumulated depreciation", statement: "bs",  fy26: null,                      current: deltaAccumDep,                          driver: "Mirror of P&L depreciation",       signFlipForDelta: true },
    { label: "Δ Retained earnings",        statement: "bs",  fy26: null,                      current: deltaRetainedEarnings,                  driver: "Mirror of gross facilities P&L",   signFlipForDelta: true },
    { label: "Operating cash (gross OPEX)", statement: "cf", fy26: null,                      current: operating,                              driver: "−Gross OPEX (excl. D&A) + ΔAP",    signFlipForDelta: true },
    { label: "Investing cash (capex)",      statement: "cf", fy26: null,                      current: investing,                              driver: "Total capex outflow",              signFlipForDelta: true },
    { label: "Net cash change",             statement: "cf", fy26: null,                      current: netCashChange,                          driver: "Allocations excluded (intercompany, not real cash)", signFlipForDelta: true },
  ];

  // ────────────────────────────────────────────────────────────────────
  // Per-office reasonability metrics under current levers.
  //   avgHC          = mean of levered monthly HC
  //   sqftWeighted   = (5/12 × pre + 7/12 × post) at the default July expansion
  //   sqftPerHC      = sqftWeighted / avgHC
  //   $/sf rent      = leveredAnnualRent / sqftWeighted
  //   $/HC snacks    = leveredAnnualSnacks / avgHC
  //   $/sf utilities = leveredAnnualUtilities / sqftWeighted
  // Static notes (office character) are looked up from the parent project's
  // Phase 8 reasonability output stored in base.reasonabilityChecks.
  // ────────────────────────────────────────────────────────────────────
  const notesByOffice = new Map(
    base.reasonabilityChecks.map((r) => [r.office, r.notes]),
  );
  const monthsPre = expansionMonthIdx;
  const monthsPost = monthCount - expansionMonthIdx;

  const reasonability: ReasonabilityRow[] = base.offices.map((office, oi) => {
    const r = officeRollups[oi];
    const avgHC =
      r.leveredHcMonthly.reduce((s, h) => s + h, 0) / monthCount;
    const sqftWeighted =
      (monthsPre / monthCount) * r.sqftPre +
      (monthsPost / monthCount) * r.newPostSqft;
    const safeAvgHC = avgHC || 1;
    const safeSqft = sqftWeighted || 1;

    // Mirror of the family-totals + per-bucket overrides above: under
    // expand=false, anchor each office's rent to FY26 unit rate × inflation
    // on the existing footprint. Without this, $/sf in the reasonability
    // table reads below FY26 because the per-month sqftFactor only partially
    // strips the parent's planned mid-year expansion out of the FY27 default.
    const leveredAnnualRent = !levers.expand
      ? office.rentPerSqftMonthly * 12 * office.sqftCurrent * (1 + INFLATION_RATE)
      : months.reduce(
          (s, _m, idx) =>
            s + office.fy27DefaultMonthly.rent[idx] * r.sqftFactor[idx],
          0,
        );
    const leveredAnnualSnacks = office.fy27DefaultMonthly.snacks.reduce(
      (s, v) => s + v * hcFactor * snacksRateFactor,
      0,
    );
    const leveredAnnualUtilities = months.reduce(
      (s, _m, idx) =>
        s + office.fy27DefaultMonthly.utilities[idx] * r.sqftFactor[idx],
      0,
    );

    return {
      office: office.name,
      fy27AvgHC: Math.round(avgHC),
      fy27SqftWeighted: Math.round(sqftWeighted),
      sqftPerHC: sqftWeighted / safeAvgHC,
      rentPerSqftPerYr: leveredAnnualRent / safeSqft,
      snacksPerHCPerYr: leveredAnnualSnacks / safeAvgHC,
      utilitiesPerSqftPerYr: leveredAnnualUtilities / safeSqft,
      notes: notesByOffice.get(office.name) ?? "",
    };
  });

  // ────────────────────────────────────────────────────────────────────
  // Driver waterfall: FY26 → FY27 net pretax bridge by category.
  //   Bridge focuses on GROSS facilities P&L (what the CFO cares about) —
  //   allocations are a downstream recovery mechanism that scales with gross,
  //   so dropping them keeps the bridge on the lines that actually move the
  //   business. Sum of category deltas = ΔgrossPnL by construction.
  //   Tone: positive contribution raises gross facility cost (bad / oxblood);
  //         negative contribution lowers it (good / sage).
  // ────────────────────────────────────────────────────────────────────
  const wfRows: Array<{
    label: string;
    fy26v: number;
    cur: number;
    driver: string;
    buckets: BucketName[];
  }> = [
    { label: "Rent",                cur: totalRent,                              fy26v: fy26.rent,                 driver: "Capacity expansion + 3% escalator",                       buckets: ["Rent"] },
    { label: "Sqft-driven other",   cur: totalSqftOther + totalFacilitiesPayroll, fy26v: fy26.sqftDrivenOther + base.fy26ByBucket.FacilitiesPayroll, driver: "Sqft × inflation (utilities/maint/insur/fac payroll)", buckets: ["Utilities", "Maintenance", "Insurance", "FacilitiesPayroll"] },
    { label: "Snacks",              cur: totalSnacks,                            fy26v: fy26.snacks,               driver: "HC × snacks rate",                                        buckets: ["Snacks"] },
    { label: "HC-driven OPEX",      cur: totalHcDriven,                          fy26v: fy26.hcDrivenExSnacks,     driver: "Per-HC OPEX rates × HC",                                  buckets: ["TandE", "OfficeSupplies", "TeamEvents", "Postage", "FurnitureOpex", "EquipSoftware"] },
    { label: "Miscellaneous",       cur: totalOtherFixed,                        fy26v: base.fy26ByBucket.BankCharges + base.fy26ByBucket.ProfServices + base.fy26ByBucket.Taxes, driver: "Inflation only (bank/prof svcs/taxes)",                  buckets: ["BankCharges", "ProfServices", "Taxes"] },
    { label: "Depreciation",        cur: depreciation,                           fy26v: fy26.depreciation,         driver: "Existing run-rate + new-asset SL",                        buckets: ["Depreciation"] },
  ];

  const waterfall: WaterfallStep[] = [
    { label: "FY26 gross", kind: "anchor", value: fy26.gross, tone: "neutral" },
    ...wfRows.map((d): WaterfallStep => {
      const delta = d.cur - d.fy26v;
      return {
        label: d.label,
        kind: "delta",
        value: delta,
        tone: delta > 0 ? "bad" : "good",
        driver: d.driver,
        buckets: d.buckets,
      };
    }),
    { label: "FY27 gross", kind: "anchor", value: gross, tone: "neutral" },
  ];

  // ────────────────────────────────────────────────────────────────────
  // Bucket-detail (16 GL lines) — lever-reactive.
  //
  // Each bucket scales by its driver-family factor relative to the FY27
  // default. Family-level scaling is *exact* (not approximate) because:
  //   - All Rent / Sqft × inflation buckets share the same per-office
  //     sqftFactor, so each bucket's scaled value = its FY27 default ×
  //     (familyTotalLevered / familyTotalDefault).
  //   - All HC × inflation buckets share the same hcFactor.
  //   - Snacks is a single bucket.
  //   - "Inflation only" buckets don't move with any lever.
  //   - Depreciation is computed by the engine's asset roll-forward.
  //
  // The 16 buckets sum to gross facilities P&L by construction.
  // ────────────────────────────────────────────────────────────────────
  const familyDefault: Record<DriverFamily, number> = {
    rent:           base.fy27DefaultByBucket.Rent,
    sqftXInflation: base.fy27DefaultByBucket.Utilities + base.fy27DefaultByBucket.Maintenance + base.fy27DefaultByBucket.Insurance + base.fy27DefaultByBucket.FacilitiesPayroll,
    snacks:         base.fy27DefaultByBucket.Snacks,
    hcXInflation:   base.fy27DefaultByBucket.TandE + base.fy27DefaultByBucket.OfficeSupplies + base.fy27DefaultByBucket.TeamEvents + base.fy27DefaultByBucket.Postage + base.fy27DefaultByBucket.FurnitureOpex + base.fy27DefaultByBucket.EquipSoftware,
    inflationOnly:  base.fy27DefaultByBucket.BankCharges + base.fy27DefaultByBucket.ProfServices + base.fy27DefaultByBucket.Taxes,
    depreciation:   base.fy27DefaultByBucket.Depreciation,
  };
  const familyLevered: Record<DriverFamily, number> = {
    rent:           totalRent,
    sqftXInflation: totalSqftOther + totalFacilitiesPayroll,
    snacks:         totalSnacks,
    hcXInflation:   totalHcDriven,
    inflationOnly:  totalOtherFixed, // held flat under levers
    depreciation:   depreciation,
  };
  const bucketDetail: BucketDetailRow[] = BUCKET_DRIVERS.map(({ bucket, driver, label }) => {
    const fy26v = base.fy26ByBucket[bucket];
    const def = base.fy27DefaultByBucket[bucket];
    let fy27v: number;
    // Mirror of the family-totals override above: under expand=false, scale
    // each sqft-driven bucket to its own FY26 × inflation. The family-factor
    // approximation distributes the family aggregate by FY27-default share,
    // which would leave Maintenance/Insurance below FY26 because FacPayroll
    // and Utilities have higher FY27 default growth and absorb a bigger slice.
    if (!levers.expand && (driver === "rent" || driver === "sqftXInflation")) {
      fy27v = fy26v * (1 + INFLATION_RATE);
    } else {
      const factor = familyDefault[driver] === 0 ? 1 : familyLevered[driver] / familyDefault[driver];
      fy27v = def * factor;
    }
    const deltaDollar = fy27v - fy26v;
    const deltaPct = fy26v === 0 ? null : deltaDollar / fy26v;
    return { bucket, driver, driverLabel: label, fy26: fy26v, fy27: fy27v, deltaDollar, deltaPct };
  });

  // Firm-wide FY27 average HC (levered). Sum each office's 12 monthly HC × hcFactor,
  // then divide by 12. France/Germany unallocated rows have no HC plan.
  const fy27AvgHC =
    officeRollups.reduce(
      (sum, r) => sum + r.leveredHcMonthly.reduce((s, h) => s + h, 0),
      0,
    ) / monthCount;
  const opexPerFTE = fy27AvgHC > 0 ? gross / fy27AvgHC : 0;

  return {
    kpis: {
      grossPnL: gross,
      netPretaxPnL: netPretax,
      totalCapex,
      netCashChange,
      fy27AvgHC,
      opexPerFTE,
    },
    monthlyPnL: { fy26Gross: base.fy26Monthly.gross, fy27Gross: fy27MonthlyGross },
    capex: {
      lhi: lhiCapex,
      fnf: ffCapex,
      oe: oeCapex,
      total: totalCapex,
      expansionSqft: totalExpansionSqft,
      monthly: capexMonthly,
    },
    pnl: {
      rent: totalRent,
      sqftDrivenOther: totalSqftOther,
      snacks: totalSnacks,
      hcDrivenExSnacks: totalHcDriven,
      fixed: totalFixedPerOffice,
      unallocated: totalUnallocated,
      depreciation,
      grossExclDep,
      gross,
      allocations,
      netPretax,
    },
    bs: {
      deltaFAGross,
      deltaAccumDep,
      deltaFANet,
      deltaAP,
      deltaRetainedEarnings,
    },
    cf: {
      cashOpex: grossExclDep,
      deltaAP,
      operating,
      investing,
      financing,
      netCashChange,
    },
    threeStmtRows,
    bucketDetail,
    reasonability,
    waterfall,
  };
}
