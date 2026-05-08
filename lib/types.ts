/**
 * Schema for `data/base-case.json` — see PLAN.md §5.1.
 * Keep in lockstep with `scripts/generate_base_case.py`.
 */

export type Office = {
  name: string;
  sqftCurrent: number;
  sqftPostExpansion: number;       // parent's default-density expansion target
  sqftAdditionFY27: number;        // = sqftPostExpansion - sqftCurrent at default
  q4Fy27Hc: number;
  capacityBreach: boolean;
  expansionMonth: string | null;
  fy27MonthlyHC: number[];         // 12 entries, Feb 2026 → Jan 2027
  hcAnchorJan2026: number;         // for Feb 2026 HC delta (FF/OE capex)
  rentPerSqftMonthly: number;      // FY26 reference
  snacksPerHCMonthly: number;      // FY26 reference
  /** FY27 default monthly cells (parent's Phase 4 output, by category).
   *  Math engine multiplies these by lever factors. At default levers all
   *  factors = 1.0, so KPIs reconcile to parent project by construction. */
  fy27DefaultMonthly: {
    rent: number[];
    sqftDrivenOther: number[];
    /** Utilities, captured separately so the reasonability table can compute
     *  $/sf utilities under different density scenarios. Already included in
     *  sqftDrivenOther — do NOT double-count when summing gross. */
    utilities: number[];
    snacks: number[];
    hcDrivenExSnacks: number[];
    /** FacilitiesPayroll only — sqft-driven (scales with sqftFactor). */
    facilitiesPayroll: number[];
    /** BankCharges + ProfServices + Taxes — held flat under levers (inflation
     *  already baked into the FY27 default value). */
    otherFixed: number[];
    /** Sum of facilitiesPayroll + otherFixed. Kept for back-compat with code
     *  that used the old single `fixed` field; new code should use the split. */
    fixed: number[];
  };
};

export type BaseCase = {
  fy27Months: string[];
  fy26Months: string[];
  offices: Office[];
  unallocated: {
    monthlyFixed: number;
    annualFixed: number;
    /** FY27 default monthly Unallocated/INTL spend, split by bucket type so
     *  it can be routed to the matching waterfall bar (HC-driven goes into
     *  HC-driven OPEX, Fixed goes into Fixed, etc.) instead of being lumped
     *  into a single "Unallocated" pile. `total` is the chart-series sum. */
    fy27DefaultMonthly: {
      rent: number[];
      sqftDrivenOther: number[];
      snacks: number[];
      hcDrivenExSnacks: number[];
      facilitiesPayroll: number[];
      otherFixed: number[];
      fixed: number[];
      total: number[];
    };
  };
  depreciation: {
    existingAnnualByType: { LHI: number; FF: number; OE: number };
    existingAnnualTotal: number;
    existingMonthlyTotal: number;
    fy27DefaultMonthly: number[];   // total dep at default (existing + new)
  };
  fy26Monthly: { gross: number[]; allocations: number[]; net: number[] };
  fy26Seasonality: number[];
  fy26Total: { gross: number; allocations: number; net: number; netAfterTax: number };
  /** FY26 actuals aggregated to the same categories as the math engine, for
   *  side-by-side display in the 3-stmt walk. */
  fy26ByCategory: {
    rent: number;
    sqftDrivenOther: number;
    snacks: number;
    hcDrivenExSnacks: number;
    fixedPlusUnallocated: number;
    depreciation: number;
    allocations: number;
    grossExclDep: number;
    gross: number;
    netPretax: number;
    netAfterTax: number;
  };
  /** FY26 actual totals per GL bucket (16 lines), summed across all offices.
   *  Powers the FY26 column of the lever-reactive bucket-detail table. */
  fy26ByBucket: Record<BucketName, number>;
  /** FY27 default annual totals per GL bucket. The math engine uses these as
   *  per-bucket scaling anchors. */
  fy27DefaultByBucket: Record<BucketName, number>;
  /** FY27 default per-office unit economics (Phase 8 reasonability output). */
  reasonabilityChecks: Array<{
    office: string;
    fy27AvgHC: number;
    fy27SqftWeighted: number;
    sqftPerHC: number;
    rentPerSqftPerYr: number;
    snacksPerHCPerYr: number;
    utilitiesPerSqftPerYr: number;
    notes: string;
  }>;
  fy27DefaultReference: {
    fy27DefaultGross: number[];
    fy27DefaultAllocations: number[];
    fy27DefaultNet: number[];
    totalGrossPhase4Placeholder: number;
    totalGrossCorrected: number;
    totalAllocations: number;
    totalNetPretax: number;
    totalNetAfterTax: number;
    totalCapex: number;
    lhiCapex: number;
    ffCapex: number;
    oeCapex: number;
    totalDA: number;
    deltaFANet: number;
    deltaAP: number;
    operatingCF: number;
    investingCF: number;
    netCashChange: number;
    expansionSqft: number;
  };
  fy27Defaults: {
    densitySqftPerHC: number;
    buildoutCostPerSqft: number;
    fnfPerSeat: number;
    oePerHC: number;
    snacksPerHCYearly: number;
    hcVariancePct: number;
    taxRate: number;
    capacityTriggerSqftPerHC: number;
    expansionMonth: string;
    effectiveAllocationRatio: number;
  };
  leverRanges: {
    density: { min: number; max: number; step: number; default: number };
    hcVariance: { min: number; max: number; step: number; default: number };
    buildoutCost: { min: number; max: number; step: number; default: number };
    snacksPerHCYearly: { min: number; max: number; step: number; default: number };
    fnfPerSeat: { min: number; max: number; step: number; default: number };
  };
  useful_lives_years: { LHI: number; FF: number; OE: number };
};

/**
 * GL buckets shown in the per-bucket detail table (16 lines).
 * Order is canonical — matches the order of FORECAST_DRIVERS.md §2.
 */
export type BucketName =
  | "Rent"
  | "Utilities"
  | "Maintenance"
  | "Insurance"
  | "FacilitiesPayroll"
  | "Snacks"
  | "TandE"
  | "OfficeSupplies"
  | "TeamEvents"
  | "Postage"
  | "FurnitureOpex"
  | "EquipSoftware"
  | "BankCharges"
  | "ProfServices"
  | "Taxes"
  | "Depreciation";

/** Driver family used to scale each bucket's FY27 default to the current scenario. */
export type DriverFamily =
  | "rent"           // sqftFactor × 1.03 (escalator already baked in)
  | "sqftXInflation" // sqftFactor × 1.03 (Util/Maint/Insur/FacilitiesPayroll)
  | "snacks"         // hcFactor × snacksRateFactor × 1.03
  | "hcXInflation"   // hcFactor × 1.03 (HC-driven ex Snacks)
  | "inflationOnly"  // 1.0 (inflation already baked into FY27 default)
  | "depreciation";  // engine's existing dep math (asset roll-forward)

export type BucketDetailRow = {
  bucket: BucketName;
  driver: DriverFamily;
  /** Human-readable driver label for the table cell. */
  driverLabel: string;
  fy26: number;
  fy27: number;
  deltaDollar: number;
  /** Δ% as decimal (e.g., 0.347 for +34.7%). null if FY26 was zero. */
  deltaPct: number | null;
};

/**
 * Six draggable levers — PLAN.md §2.2.
 */
export type Levers = {
  density: number;             // sqft / HC
  hcVariance: number;          // -0.15 to +0.15 (decimal, not %)
  buildoutCost: number;        // $/sqft for LHI capex
  snacksPerHCYearly: number;   // $ snacks / HC / year
  fnfPerSeat: number;          // $ furniture & fixtures per new seat
  /** Hold-the-line scenario toggle. When false: zero new sqft, zero LHI/F&F
   *  capex, OE capex continues (HC still grows → laptops still needed).
   *  Sf/HC ratios drop below the 150 target → breach is the *point* of this
   *  scenario. */
  expand: boolean;
};

export type ThreeStmtRow = {
  label: string;
  statement: "pnl" | "bs" | "cf";
  /** FY26 actual. Null for BS movements and cash flow rows — the parent project
   *  doesn't model FY26 BS or CF (no opening trial balance was provided). */
  fy26: number | null;
  current: number;
  /** Succinct driver from WRITEUP_CALLOUTS.md Like-for-like view. */
  driver: string;
  /** Sign convention: +Δ = unfavorable for cash (oxblood);
   *  -Δ = favorable for cash (sage). Cash-change rows + dep growth inverted. */
  signFlipForDelta?: boolean;
  /** Headline / subtotal row — receives stronger visual emphasis. Used to
   *  highlight Gross facilities P&L as the top-line CFO metric. */
  emphasized?: boolean;
};

export type Scenario = {
  kpis: {
    grossPnL: number;
    netPretaxPnL: number;
    totalCapex: number;
    netCashChange: number;
    /** Firm-wide FY27 average headcount, levered by hcVariance. Sum of 8 office
     *  monthly HC × hcFactor, averaged across 12 months. France/Germany have no
     *  HC plan in the parent project so they're excluded. */
    fy27AvgHC: number;
    /** Gross facilities P&L per FTE = grossPnL / fy27AvgHC. Both numerator and
     *  denominator move with levers. */
    opexPerFTE: number;
  };
  monthlyPnL: { fy26Gross: number[]; fy27Gross: number[] };
  capex: {
    lhi: number;
    fnf: number;
    oe: number;
    total: number;
    expansionSqft: number;
    monthly: number[];   // total capex, by FY27 month
  };
  pnl: {
    rent: number;
    sqftDrivenOther: number;     // utilities, maintenance, insurance combined
    snacks: number;
    hcDrivenExSnacks: number;
    fixed: number;
    unallocated: number;
    depreciation: number;
    grossExclDep: number;
    gross: number;
    allocations: number;
    netPretax: number;
  };
  bs: {
    deltaFAGross: number;
    deltaAccumDep: number;
    deltaFANet: number;
    deltaAP: number;
    deltaRetainedEarnings: number;
  };
  cf: {
    /** Cash OPEX = grossExclDep (cash portion of gross spend, D&A excluded). */
    cashOpex: number;
    /** ΔAP timing benefit, scales with gross. */
    deltaAP: number;
    /** Operating cash = -cashOpex + deltaAP. Allocations are excluded — they
     *  are intercompany transfers and don't represent real cash leaving the
     *  company. */
    operating: number;
    investing: number;
    financing: number;
    netCashChange: number;
  };
  threeStmtRows: ThreeStmtRow[];
  /** GL-bucket-level FY26 vs FY27 detail (16 rows). Powers the bucket-detail
   *  table below the 3-stmt walk; reactive to lever movements. */
  bucketDetail: BucketDetailRow[];
  /** Per-office unit economics under current levers. Static notes lifted from
   *  WRITEUP_CALLOUTS.md; numeric metrics computed live. */
  reasonability: ReasonabilityRow[];
  /** FY26 → FY27 net pretax bridge by category, for the driver waterfall. */
  waterfall: WaterfallStep[];
};

/** A single step in the FY26→FY27 net pretax waterfall. Anchors are absolute
 *  totals; deltas are signed contributions stacked on the running total. */
export type WaterfallStep = {
  label: string;
  /** "anchor" = absolute total (FY26 start, FY27 end);
   *  "delta"  = signed contribution that bridges anchor to anchor. */
  kind: "anchor" | "delta";
  /** For anchors: the absolute net pretax. For deltas: the signed change. */
  value: number;
  /** Tone for color: "good" (sage) for cost-down, "bad" (oxblood) for cost-up,
   *  "neutral" for anchors. */
  tone: "good" | "bad" | "neutral";
  /** Short attribution (e.g., "Capacity expansion + escalator"). */
  driver?: string;
  /** GL buckets that roll up into this step. Used by the tooltip drill-down to
   *  show per-bucket Δ$/Δ% under current levers. Omitted for anchors. */
  buckets?: BucketName[];
};

export type ReasonabilityRow = {
  office: string;
  fy27AvgHC: number;
  fy27SqftWeighted: number;
  sqftPerHC: number;
  rentPerSqftPerYr: number;
  snacksPerHCPerYr: number;
  utilitiesPerSqftPerYr: number;
  notes: string;
};
