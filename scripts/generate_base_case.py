"""
Generate explorer/data/base-case.json from the parent project's Phase 4–7 outputs.

This is a one-off ETL: every value here is sourced from a CSV produced by the
parent forecast model. Re-run this script if any upstream phase output changes.

Output shape consumed by `lib/compute.ts` math engine. Schema is documented in
explorer/PLAN.md §5.1.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # notion case/
EXPLORER = Path(__file__).resolve().parents[1]  # explorer/
OUT_PATH = EXPLORER / "data" / "base-case.json"

# Office order — matches parent project. India is included for completeness but
# is over-spec'd at default density (321 sqft/HC) and so its expansion is zero.
OFFICES = [
    "HQ - SF",
    "New York",
    "Ireland",
    "United Kingdom",
    "Japan",
    "South Korea",
    "Australia",
    "India",
]

FY27_MONTHS = [
    "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
    "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01",
]

FY26_MONTHS = [
    "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07",
    "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
]

HC_ANCHOR_MONTH = "2026-01"  # Jan 2026 ending HC; needed for Feb 2026 HC delta

# Bucket → category for the math engine.
SQFT_DRIVEN = {"Rent", "Utilities", "Maintenance", "Insurance"}
HC_DRIVEN_EX_SNACKS = {
    "OfficeSupplies", "TeamEvents", "Postage", "TandE",
    "FurnitureOpex", "EquipSoftware",
}
FIXED_PER_OFFICE = {"FacilitiesPayroll", "BankCharges", "ProfServices", "Taxes"}
# Depreciation is handled separately (existing run-rate + new asset SL).
# InternalAllocations is handled separately (effective ratio × gross).


def read_csv(path: Path) -> list[dict]:
    with path.open() as f:
        return list(csv.DictReader(f))


def build_hc_plan() -> tuple[dict[str, list[int]], dict[str, int]]:
    """Per-office monthly HC for FY27 + Jan 2026 anchor (for Feb HC delta)."""
    rows = read_csv(ROOT / "assumptions" / "hc_plan_monthly.csv")
    by_office: dict[str, dict[str, int]] = defaultdict(dict)
    for r in rows:
        by_office[r["office"]][r["month"]] = int(r["hc"])
    monthly: dict[str, list[int]] = {}
    anchor: dict[str, int] = {}
    for office in OFFICES:
        monthly[office] = [by_office[office][m] for m in FY27_MONTHS]
        anchor[office] = by_office[office][HC_ANCHOR_MONTH]
    return monthly, anchor


def build_sqft_plan() -> dict[str, dict]:
    """Per-office sqft pre/post + expansion month."""
    rows = read_csv(ROOT / "assumptions" / "sqft_plan.csv")
    out: dict[str, dict] = {}
    for r in rows:
        out[r["office"]] = {
            "sqftCurrent": int(float(r["sqft_current"])),
            "sqftPostExpansion": int(float(r["sqft_post_expansion"])),
            "sqftAdditionFY27": int(float(r["sqft_addition_fy27"])),
            "q4Fy27Hc": int(float(r["q4_fy27_hc"])),
            "expansionMonth": r["expansion_month"] or None,
            "capacityBreach": r["capacity_breach"] == "Y",
        }
    return out


def build_unit_rates() -> dict[str, dict]:
    """Per-office FY26 unit rates, organized by category.

    For each office, returns:
        rentPerSqftMonthly         (single $/sqft/mo)
        sqftDrivenPerSqftMonthly   (rent + utilities + maintenance + insurance)
        snacksPerHCMonthly         (single $/HC/mo for Snacks)
        hcDrivenExSnacksPerHCMonthly (sum of HC-driven ex Snacks)
        fixedPerMonth              (sum of fixed buckets per office)
    """
    rows = read_csv(ROOT / "fy26_runrate" / "fy26_unit_rates.csv")
    by_office: dict[str, dict] = {
        o: {
            "rentPerSqftMonthly": 0.0,
            "sqftDrivenPerSqftMonthly": 0.0,
            "snacksPerHCMonthly": 0.0,
            "hcDrivenExSnacksPerHCMonthly": 0.0,
            "fixedPerMonth": 0.0,
        }
        for o in OFFICES
    }
    for r in rows:
        office = r["office"]
        if office not in by_office:
            continue  # skip Unallocated / INTL
        bucket = r["bucket"]
        unit_rate = float(r["unit_rate"])
        monthly_avg = float(r["fy26_monthly_avg_usd"])
        if bucket == "Rent":
            by_office[office]["rentPerSqftMonthly"] = unit_rate
            by_office[office]["sqftDrivenPerSqftMonthly"] += unit_rate
        elif bucket in SQFT_DRIVEN:
            by_office[office]["sqftDrivenPerSqftMonthly"] += unit_rate
        elif bucket == "Snacks":
            by_office[office]["snacksPerHCMonthly"] = unit_rate
        elif bucket in HC_DRIVEN_EX_SNACKS:
            by_office[office]["hcDrivenExSnacksPerHCMonthly"] += unit_rate
        elif bucket in FIXED_PER_OFFICE:
            by_office[office]["fixedPerMonth"] += monthly_avg
    return by_office


def build_unallocated_costs() -> dict[str, float]:
    """Buckets booked to 'Unallocated' or 'INTL' that flow into gross
    independent of any office driver. Held constant under all levers."""
    rows = read_csv(ROOT / "fy26_runrate" / "fy26_unit_rates.csv")
    monthly = 0.0
    for r in rows:
        if r["office"] in ("Unallocated", "INTL"):
            if r["bucket"] in ("InternalAllocations",):
                continue
            if r["bucket"] == "Depreciation":
                continue  # handled by depreciation block
            monthly += float(r["fy26_monthly_avg_usd"])
    return {
        "monthlyFixed": round(monthly, 2),
        "annualFixed": round(monthly * 12, 2),
    }


def build_fy26_monthly() -> dict[str, list[float]]:
    """FY26 monthly gross/allocations/net for the chart baseline."""
    rows = read_csv(ROOT / "fy26_runrate" / "fy26_runrate_monthly.csv")
    gross: dict[str, float] = defaultdict(float)
    alloc: dict[str, float] = defaultdict(float)
    for r in rows:
        m, b, usd = r["month"], r["bucket"], float(r["usd_amount"])
        if b == "InternalAllocations":
            alloc[m] += usd
        else:
            gross[m] += usd
    return {
        "gross": [round(gross[m], 2) for m in FY26_MONTHS],
        "allocations": [round(alloc[m], 2) for m in FY26_MONTHS],
        "net": [round(gross[m] + alloc[m], 2) for m in FY26_MONTHS],
    }


def build_fy26_by_category() -> dict[str, float]:
    """FY26 actuals aggregated by the same categories the math engine uses.
    Powers the FY26 column in the three-statement table."""
    rows = read_csv(ROOT / "fy26_runrate" / "fy26_runrate_summary.csv")
    by_bucket: dict[str, float] = defaultdict(float)
    for r in rows:
        by_bucket[r["bucket"]] += float(r["fy26_total_usd"])

    rent              = by_bucket["Rent"]
    sqft_other        = sum(by_bucket[b] for b in ("Utilities", "Maintenance", "Insurance"))
    snacks            = by_bucket["Snacks"]
    hc_driven         = sum(by_bucket[b] for b in (
        "OfficeSupplies", "TeamEvents", "Postage", "TandE",
        "FurnitureOpex", "EquipSoftware",
    ))
    fixed_plus_unall  = sum(by_bucket[b] for b in (
        "FacilitiesPayroll", "BankCharges", "ProfServices", "Taxes",
    ))
    depreciation      = by_bucket["Depreciation"]
    allocations       = by_bucket["InternalAllocations"]

    gross_excl_dep = rent + sqft_other + snacks + hc_driven + fixed_plus_unall
    gross          = gross_excl_dep + depreciation
    net_pretax     = gross + allocations
    net_after_tax  = net_pretax * 0.75

    return {
        "rent":                 round(rent, 2),
        "sqftDrivenOther":      round(sqft_other, 2),
        "snacks":               round(snacks, 2),
        "hcDrivenExSnacks":     round(hc_driven, 2),
        "fixedPlusUnallocated": round(fixed_plus_unall, 2),
        "depreciation":         round(depreciation, 2),
        "allocations":          round(allocations, 2),
        "grossExclDep":         round(gross_excl_dep, 2),
        "gross":                round(gross, 2),
        "netPretax":            round(net_pretax, 2),
        "netAfterTax":          round(net_after_tax, 2),
    }


BUCKET_DRIVER_FAMILY: dict[str, str] = {
    "Rent":              "rent",                # sqftFactor × 1.03
    "Utilities":         "sqftXInflation",      # sqftFactor × 1.03
    "Maintenance":       "sqftXInflation",
    "Insurance":         "sqftXInflation",
    "FacilitiesPayroll": "sqftXInflation",
    "Snacks":            "snacks",              # hcFactor × snacksRate × 1.03
    "TandE":             "hcXInflation",        # hcFactor × 1.03
    "OfficeSupplies":    "hcXInflation",
    "TeamEvents":        "hcXInflation",
    "Postage":           "hcXInflation",
    "FurnitureOpex":     "hcXInflation",
    "EquipSoftware":     "hcXInflation",
    "BankCharges":       "inflationOnly",       # held flat (inflation already in default)
    "ProfServices":      "inflationOnly",
    "Taxes":             "inflationOnly",
    "Depreciation":      "depreciation",        # asset roll-forward in engine
}


def build_fy26_by_bucket() -> dict[str, float]:
    """FY26 actual totals per GL bucket, summed across all offices.
    Drives the FY26 column of the lever-reactive bucket-detail table."""
    rows = read_csv(ROOT / "fy26_runrate" / "fy26_runrate_summary.csv")
    by_bucket: dict[str, float] = defaultdict(float)
    for r in rows:
        b = r["bucket"]
        if b == "InternalAllocations":
            continue
        by_bucket[b] += float(r["fy26_total_usd"])
    return {b: round(v, 2) for b, v in by_bucket.items() if b in BUCKET_DRIVER_FAMILY}


def build_fy27_default_by_bucket() -> dict[str, float]:
    """FY27 default annual totals per GL bucket, summed across all offices
    (modeled + Unallocated/INTL). Used as the per-bucket scaling anchor in
    the math engine."""
    rows = read_csv(ROOT / "fy27_forecast" / "fy27_pnl_monthly.csv")
    by_bucket: dict[str, float] = defaultdict(float)
    for r in rows:
        b = r["bucket"]
        if b == "InternalAllocations":
            continue
        by_bucket[b] += float(r["usd_amount"])
    return {b: round(v, 2) for b, v in by_bucket.items() if b in BUCKET_DRIVER_FAMILY}


def build_reasonability_checks() -> list[dict]:
    """Per-office FY27 unit economics (Phase 8 reasonability output)."""
    rows = read_csv(ROOT / "fy27_forecast" / "fy27_reasonability_checks.csv")
    notes = {
        "HQ - SF":         "At capacity target post-expansion",
        "New York":        "NYC market level",
        "Ireland":         "Snacks anomaly persists from FY26 (blank-EUR attribution)",
        "United Kingdom":  "Confirmed coworking (no snacks line, no utilities)",
        "Japan":           "High $/sf — likely bundled services or undercount",
        "South Korea":     "Post-expansion (3× footprint)",
        "Australia":       "Sydney mid-range",
        "India":           "Slack capacity (no expansion)",
    }
    out: list[dict] = []
    for r in rows:
        office = r["office"]
        out.append({
            "office":              office,
            "fy27AvgHC":           int(float(r["fy27_avg_hc"])),
            "fy27SqftWeighted":    int(float(r["fy27_sqft_weighted"])),
            "sqftPerHC":           float(r["sqft_per_hc"]),
            "rentPerSqftPerYr":    float(r["rent_per_sqft_per_yr"]),
            "snacksPerHCPerYr":    float(r["snacks_per_hc_per_yr"]),
            "utilitiesPerSqftPerYr": float(r["utilities_per_sqft_per_yr"]),
            "notes":               notes.get(office, ""),
        })
    return out


def build_depreciation() -> dict[str, float]:
    """Existing-asset depreciation run-rate by asset type, from Phase 5 dep_roll.

    Using Phase 5's existing run-rate (not the FY26 unit-rate sum) because the
    parent project's Phase 5 reclassifies existing dep by asset type, and this
    is what the integrated walk's $4.02M total D&A reconciles to.

    New asset D&A is computed in the math engine: LHI 7yr SL placed in expansion
    month, FF 5yr SL placed monthly per HC delta, OE 3yr SL same.
    """
    rows = read_csv(ROOT / "fy27_forecast" / "fy27_dep_roll_monthly.csv")
    existing_by_type: dict[str, float] = defaultdict(float)
    for r in rows:
        existing_by_type[r["asset_type"]] += float(r["dep_from_existing_assets"])
    return {
        "existingAnnualByType": {
            "LHI": round(existing_by_type["LHI"], 2),
            "FF": round(existing_by_type["FF"], 2),
            "OE": round(existing_by_type["OfficeEquip"], 2),
        },
        "existingAnnualTotal": round(sum(existing_by_type.values()), 2),
        "existingMonthlyTotal": round(sum(existing_by_type.values()) / 12, 2),
    }


def fy27_actuals_feb_mar() -> dict[str, list[float]]:
    """FY27 default monthly aggregate (gross / allocations / net) from
    parent's Phase 4 PnL. Used for chart baseline at default levers.
    """
    rows = read_csv(ROOT / "fy27_forecast" / "fy27_pnl_monthly.csv")
    gross: dict[str, float] = defaultdict(float)
    alloc: dict[str, float] = defaultdict(float)
    for r in rows:
        m, b, usd = r["month"], r["bucket"], float(r["usd_amount"])
        if b == "InternalAllocations":
            alloc[m] += usd
        else:
            gross[m] += usd
    return {
        "fy27DefaultGross": [round(gross[m], 2) for m in FY27_MONTHS],
        "fy27DefaultAllocations": [round(alloc[m], 2) for m in FY27_MONTHS],
        "fy27DefaultNet": [round(gross[m] + alloc[m], 2) for m in FY27_MONTHS],
    }


def build_fy27_defaults_per_office() -> dict[str, dict]:
    """Per-office FY27 default monthly values, decomposed by category.
    Math engine multiplies these by lever factors. At default levers all
    multipliers = 1.0, so KPIs reconcile to parent project by construction.

    Categories tracked:
        rent              — lever: density (per-month sqft factor)
        sqftDrivenOther   — utilities + maintenance + insurance
        utilities         — separate copy for the reasonability table's $/sf metric
        snacks            — levers: hcVariance × snacks rate
        hcDrivenExSnacks  — lever: hcVariance
        facilitiesPayroll — sqft-driven (split out from `fixed` so it scales with sqftFactor)
        otherFixed        — BankCharges + ProfServices + Taxes (held flat under levers; inflation already baked into the FY27 default)
        fixed             — sum of the two above (kept for backward-compat with existing engine code)

    `utilities` is also included inside `sqftDrivenOther` (not subtracted);
    the math engine sums sqftDrivenOther into gross, while reasonability uses
    the standalone `utilities` for $/sf utilities.
    """
    rows = read_csv(ROOT / "fy27_forecast" / "fy27_pnl_monthly.csv")

    # office → category → 12 monthly values
    by_office: dict[str, dict[str, list[float]]] = defaultdict(
        lambda: defaultdict(lambda: [0.0] * len(FY27_MONTHS))
    )
    month_idx = {m: i for i, m in enumerate(FY27_MONTHS)}

    for r in rows:
        office = r["office"]
        if office not in OFFICES:
            continue
        bucket = r["bucket"]
        if bucket in ("Depreciation", "InternalAllocations"):
            continue
        idx = month_idx.get(r["month"])
        if idx is None:
            continue
        usd = float(r["usd_amount"])
        if bucket == "Rent":
            by_office[office]["rent"][idx] += usd
        elif bucket in SQFT_DRIVEN:
            by_office[office]["sqftDrivenOther"][idx] += usd
            if bucket == "Utilities":
                by_office[office]["utilities"][idx] += usd
        elif bucket == "Snacks":
            by_office[office]["snacks"][idx] += usd
        elif bucket in HC_DRIVEN_EX_SNACKS:
            by_office[office]["hcDrivenExSnacks"][idx] += usd
        elif bucket == "FacilitiesPayroll":
            by_office[office]["facilitiesPayroll"][idx] += usd
            by_office[office]["fixed"][idx] += usd
        elif bucket in FIXED_PER_OFFICE:
            by_office[office]["otherFixed"][idx] += usd
            by_office[office]["fixed"][idx] += usd

    return {
        office: {
            cat: [round(v, 2) for v in by_office[office][cat]]
            for cat in ("rent", "sqftDrivenOther", "utilities", "snacks",
                        "hcDrivenExSnacks", "facilitiesPayroll", "otherFixed", "fixed")
        }
        for office in OFFICES
    }


def build_fy27_default_unallocated_monthly() -> dict[str, list[float]]:
    """Catch-all bucket: anything that isn't one of our 8 modeled offices.
    Includes Unallocated (company-wide), INTL, and small actuals-only offices
    (France, Germany) that appear in Feb–Mar 2026 transactions but aren't in
    the parent's HC/sqft plan.

    Split by category so the explorer can route Unallocated T&E into the
    HC-driven bar, Unallocated FacilitiesPayroll into the Fixed bar, etc.
    Without this split, the waterfall mis-attributes corporate T&E /
    OfficeSupplies to "Fixed + unallocated," making HC-driven OPEX appear to
    shrink while Fixed appears to balloon (categorization mismatch with the
    FY26 actuals which group purely by bucket type, regardless of office).

    `total` is kept for backward-compat / monthly chart series.
    """
    rows = read_csv(ROOT / "fy27_forecast" / "fy27_pnl_monthly.csv")
    n = len(FY27_MONTHS)
    series: dict[str, list[float]] = {
        "rent":               [0.0] * n,
        "sqftDrivenOther":    [0.0] * n,
        "snacks":             [0.0] * n,
        "hcDrivenExSnacks":   [0.0] * n,
        "facilitiesPayroll":  [0.0] * n,
        "otherFixed":         [0.0] * n,
        "fixed":              [0.0] * n,  # sum of FP + otherFixed (back-compat)
        "total":              [0.0] * n,
    }
    month_idx = {m: i for i, m in enumerate(FY27_MONTHS)}
    for r in rows:
        if r["office"] in OFFICES:
            continue
        bucket = r["bucket"]
        if bucket in ("InternalAllocations", "Depreciation"):
            continue
        idx = month_idx.get(r["month"])
        if idx is None:
            continue
        usd = float(r["usd_amount"])
        if bucket == "Rent":
            series["rent"][idx] += usd
        elif bucket in SQFT_DRIVEN:
            series["sqftDrivenOther"][idx] += usd
        elif bucket == "Snacks":
            series["snacks"][idx] += usd
        elif bucket in HC_DRIVEN_EX_SNACKS:
            series["hcDrivenExSnacks"][idx] += usd
        elif bucket == "FacilitiesPayroll":
            series["facilitiesPayroll"][idx] += usd
            series["fixed"][idx] += usd
        elif bucket in FIXED_PER_OFFICE:
            series["otherFixed"][idx] += usd
            series["fixed"][idx] += usd
        else:
            series["otherFixed"][idx] += usd  # safety net
            series["fixed"][idx] += usd
        series["total"][idx] += usd
    return {k: [round(v, 2) for v in arr] for k, arr in series.items()}


def build_fy27_default_depreciation_monthly() -> list[float]:
    """Phase 5 corrected monthly depreciation totals (LHI + FF + OE) at
    default levers. Math engine recomputes new-asset dep from levers but
    treats existing-asset dep as constant; defaults reconcile."""
    rows = read_csv(ROOT / "fy27_forecast" / "fy27_dep_roll_monthly.csv")
    monthly = [0.0] * len(FY27_MONTHS)
    month_idx = {m: i for i, m in enumerate(FY27_MONTHS)}
    for r in rows:
        idx = month_idx.get(r["month"])
        if idx is None:
            continue
        monthly[idx] += float(r["total_dep_expense"])
    return [round(v, 2) for v in monthly]


def main() -> None:
    hc_plan, hc_anchor = build_hc_plan()
    sqft_plan = build_sqft_plan()
    unit_rates = build_unit_rates()
    unallocated = build_unallocated_costs()
    fy26 = build_fy26_monthly()
    dep = build_depreciation()
    fy27_default = fy27_actuals_feb_mar()
    fy27_per_office = build_fy27_defaults_per_office()
    fy27_unallocated_monthly = build_fy27_default_unallocated_monthly()
    fy27_depreciation_monthly = build_fy27_default_depreciation_monthly()
    fy26_by_category = build_fy26_by_category()
    fy26_by_bucket = build_fy26_by_bucket()
    fy27_default_by_bucket = build_fy27_default_by_bucket()
    reasonability = build_reasonability_checks()

    # The Phase 4 PnL CSV has placeholder D&A ($3.09M); the writeup's $33.23M
    # gross uses Phase 5 corrected D&A ($4.02M). For lever-correct math, we
    # rebuild gross from drivers and add corrected D&A. The Phase 4 monthly
    # series here is kept only for the "FY27 default reference" block; the
    # effective allocation ratio is calibrated against the *corrected* gross
    # so allocations × gross reconciles to -$26.26M at defaults.
    phase4_gross = sum(fy27_default["fy27DefaultGross"])
    fy27_default_alloc_total = sum(fy27_default["fy27DefaultAllocations"])
    da_correction = 4019735.8 - 3090023.0   # phase 5 D&A − phase 4 placeholder
    fy27_corrected_gross = phase4_gross + da_correction
    effective_alloc_ratio = abs(fy27_default_alloc_total) / fy27_corrected_gross

    # FY26 seasonality: monthly gross / annual gross.
    fy26_gross_annual = sum(fy26["gross"])
    fy26_seasonality = [g / fy26_gross_annual for g in fy26["gross"]]

    offices_payload = []
    for o in OFFICES:
        sp = sqft_plan[o]
        ur = unit_rates[o]
        defaults = fy27_per_office[o]
        offices_payload.append({
            "name": o,
            "sqftCurrent": sp["sqftCurrent"],
            "sqftPostExpansion": sp["sqftPostExpansion"],
            "sqftAdditionFY27": sp["sqftAdditionFY27"],
            "q4Fy27Hc": sp["q4Fy27Hc"],
            "capacityBreach": sp["capacityBreach"],
            "expansionMonth": sp["expansionMonth"],
            "fy27MonthlyHC": hc_plan[o],
            "hcAnchorJan2026": hc_anchor[o],
            # FY26 unit rates kept for reference but no longer used by math engine
            "rentPerSqftMonthly": round(ur["rentPerSqftMonthly"], 4),
            "snacksPerHCMonthly": round(ur["snacksPerHCMonthly"], 2),
            # FY27 default monthly cells — math engine multiplies these by
            # lever factors. At default levers all factors = 1.0, so KPIs
            # reconcile to parent project by construction.
            "fy27DefaultMonthly": defaults,
        })

    payload = {
        "_provenance": {
            "generator": "explorer/scripts/generate_base_case.py",
            "sources": [
                "assumptions/hc_plan_monthly.csv",
                "assumptions/sqft_plan.csv",
                "assumptions/capex_unit_rates.csv",
                "fy26_runrate/fy26_unit_rates.csv",
                "fy26_runrate/fy26_runrate_monthly.csv",
                "fy27_forecast/fy27_pnl_monthly.csv",
            ],
            "fiscalYear": "FY27 = Feb 2026 – Jan 2027",
        },
        "fy27Months": FY27_MONTHS,
        "fy26Months": FY26_MONTHS,
        "offices": offices_payload,
        "unallocated": {
            **unallocated,
            "fy27DefaultMonthly": fy27_unallocated_monthly,
        },
        "depreciation": {
            **dep,
            "fy27DefaultMonthly": fy27_depreciation_monthly,
        },
        "fy26Monthly": fy26,
        "fy26Seasonality": [round(s, 6) for s in fy26_seasonality],
        "fy26Total": {
            "gross": round(fy26_gross_annual, 2),
            "allocations": round(sum(fy26["allocations"]), 2),
            "net": round(fy26_gross_annual + sum(fy26["allocations"]), 2),
            "netAfterTax": round(
                (fy26_gross_annual + sum(fy26["allocations"])) * 0.75, 2
            ),
        },
        "fy26ByCategory": fy26_by_category,
        "fy26ByBucket": fy26_by_bucket,
        "fy27DefaultByBucket": fy27_default_by_bucket,
        "reasonabilityChecks": reasonability,
        "fy27DefaultReference": {
            **fy27_default,
            "totalGrossPhase4Placeholder": round(phase4_gross, 2),
            "totalGrossCorrected": round(fy27_corrected_gross, 2),
            "totalAllocations": round(fy27_default_alloc_total, 2),
            "totalNetPretax": round(
                fy27_corrected_gross + fy27_default_alloc_total, 2
            ),
            "totalNetAfterTax": round(
                (fy27_corrected_gross + fy27_default_alloc_total) * 0.75, 2
            ),
            "totalCapex": 13436145.67,
            "lhiCapex": 12180000.0,
            "ffCapex": 800000.0,         # ~ 800k per phase 5 split
            "oeCapex": 456145.67,
            "totalDA": 4019735.8,
            "deltaFANet": 9416410.0,
            "deltaAP": 2227997.45,
            "operatingCF": 1023330.0,
            "investingCF": -13436145.67,
            "netCashChange": -12412815.67,
            "expansionSqft": 34800,
        },
        "fy27Defaults": {
            "densitySqftPerHC": 150,
            "buildoutCostPerSqft": 350,
            "fnfPerSeat": 3399.16,
            "oePerHC": 1686.45,
            "snacksPerHCYearly": 14000,
            "hcVariancePct": 0,
            "taxRate": 0.25,
            "capacityTriggerSqftPerHC": 150,
            "expansionMonth": "2026-07",
            "effectiveAllocationRatio": round(effective_alloc_ratio, 4),
            "_notes": (
                "effectiveAllocationRatio is calibrated so that, at default "
                "levers, allocations × gross reconciles to the parent project's "
                "FY27 figure ($-26.26M / $33.23M). Allocations scale linearly "
                "with gross under all levers (a simplification documented in "
                "PLAN.md §5.2 step 5)."
            ),
        },
        "leverRanges": {
            "density": {"min": 100, "max": 250, "step": 25, "default": 150},
            "hcVariance": {"min": -0.15, "max": 0.15, "step": 0.01, "default": 0},
            "buildoutCost": {"min": 200, "max": 600, "step": 25, "default": 350},
            "snacksPerHCYearly": {"min": 3000, "max": 15000, "step": 500, "default": 14000},
            "fnfPerSeat": {"min": 2000, "max": 5000, "step": 250, "default": 3399},
        },
        "useful_lives_years": {"LHI": 7, "FF": 5, "OE": 3},
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w") as f:
        json.dump(payload, f, indent=2)
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB)")
    print(f"Offices: {len(offices_payload)}")
    print(f"FY26 gross total: ${fy26_gross_annual:,.0f}")
    print(f"FY26 allocations total: ${sum(fy26['allocations']):,.0f}")
    print(f"FY27 phase-4 gross total:  ${phase4_gross:,.0f}")
    print(f"FY27 corrected gross total: ${fy27_corrected_gross:,.0f}")
    print(f"FY27 default allocations:  ${fy27_default_alloc_total:,.0f}")
    print(f"Effective allocation ratio: {effective_alloc_ratio:.4f}")
    print(f"Existing dep annual total: ${dep['existingAnnualTotal']:,.0f}")
    print(f"  by type: LHI ${dep['existingAnnualByType']['LHI']:,.0f} / "
          f"FF ${dep['existingAnnualByType']['FF']:,.0f} / "
          f"OE ${dep['existingAnnualByType']['OE']:,.0f}")


if __name__ == "__main__":
    main()
