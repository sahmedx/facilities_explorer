"use client";

import type { BucketDetailRow, BucketName, DriverFamily, Scenario } from "@/lib/types";
import { fmtMoneyShort, fmtDelta, fmtPercent, deltaClass } from "@/lib/format";
import { BUCKET_LABEL } from "@/lib/labels";
import styles from "./bucket-detail-table.module.css";

// Group order (matches FORECAST_DRIVERS.md §1).
const GROUP_ORDER: Array<{
  driver: DriverFamily;
  title: string;
  /** Optional secondary tag (which lever moves this group). */
  hint: string;
}> = [
  { driver: "rent",           title: "Rent",                hint: "Density lever + sqft expansion" },
  { driver: "sqftXInflation", title: "Sqft × inflation",    hint: "Density lever + sqft expansion" },
  { driver: "snacks",         title: "Snacks",              hint: "HC variance + snacks/HC lever" },
  { driver: "hcXInflation",   title: "HC × inflation",      hint: "HC variance lever" },
  { driver: "inflationOnly",  title: "Miscellaneous",       hint: "Inflation only — held flat under levers" },
  { driver: "depreciation",   title: "Asset roll-forward",  hint: "Capex levers (density, buildout, F&F)" },
];

// Per-bucket overrides for the Driver column display. Most buckets show
// `r.driverLabel` from compute; entries here replace that text.
const DRIVER_LABEL_OVERRIDE: Partial<Record<BucketName, string>> = {
  BankCharges: "Inflation only + one-time adjustment",
};

export function BucketDetailTable({ current }: { current: Scenario }) {
  // Pre-bucket lookup by family for ordering.
  const byDriver = new Map<DriverFamily, BucketDetailRow[]>();
  for (const row of current.bucketDetail) {
    const existing = byDriver.get(row.driver) ?? [];
    existing.push(row);
    byDriver.set(row.driver, existing);
  }

  const grossFy26 = current.bucketDetail.reduce((s, r) => s + r.fy26, 0);
  const grossFy27 = current.bucketDetail.reduce((s, r) => s + r.fy27, 0);
  const grossDelta = grossFy27 - grossFy26;
  const grossPct = grossFy26 === 0 ? 0 : grossDelta / grossFy26;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className="label">Forecast detail by GL bucket</span>
        <span className={styles.sub}>FY26 actual · FY27 forecast · Δ — reactive to levers</span>
      </header>

      <div className={styles.table} role="table">
        <div className={`${styles.row} ${styles.headRow}`} role="row">
          <span className={`label ${styles.cellLabel}`} role="columnheader">Bucket</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">FY26</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">FY27</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">Δ$</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">Δ%</span>
          <span className={`label ${styles.cellDriver}`} role="columnheader">Driver</span>
        </div>

        {GROUP_ORDER.map(({ driver, title, hint }) => {
          const rows = (byDriver.get(driver) ?? []).slice().sort((a, b) => b.fy27 - a.fy27);
          if (rows.length === 0) return null;
          return (
            <section key={driver} className={styles.group} role="rowgroup">
              <div className={styles.groupHeader}>
                <span className={styles.groupTitle}>{title}</span>
                <span className={styles.groupSub}>{hint}</span>
              </div>
              {rows.map((r) => {
                const cls = deltaClass(r.deltaDollar);
                const pctText = r.deltaPct === null ? "—" : fmtPercent(r.deltaPct, 1);
                const driverText = DRIVER_LABEL_OVERRIDE[r.bucket] ?? r.driverLabel;
                return (
                  <div key={r.bucket} className={styles.row} role="row">
                    <span className={styles.cellLabel} role="cell">
                      {BUCKET_LABEL[r.bucket]}
                    </span>
                    <span className={`mono ${styles.cellNum}`} role="cell">
                      {fmtMoneyShort(r.fy26)}
                    </span>
                    <span className={`mono ${styles.cellNum}`} role="cell">
                      {fmtMoneyShort(r.fy27)}
                    </span>
                    <span
                      className={`mono ${styles.cellNum} ${cls === "pos" ? styles.deltaPos : ""} ${
                        cls === "neg" ? styles.deltaNeg : ""
                      }`}
                      role="cell"
                    >
                      {fmtDelta(r.deltaDollar)}
                    </span>
                    <span
                      className={`mono ${styles.cellNum} ${cls === "pos" ? styles.deltaPos : ""} ${
                        cls === "neg" ? styles.deltaNeg : ""
                      }`}
                      role="cell"
                    >
                      {pctText}
                    </span>
                    <span className={styles.cellDriver} role="cell">
                      {driverText}
                    </span>
                  </div>
                );
              })}
            </section>
          );
        })}

        <div className={`${styles.row} ${styles.rowEmphasized}`} role="row">
          <span className={styles.cellLabel} role="cell">Gross facilities P&amp;L</span>
          <span className={`mono ${styles.cellNum}`} role="cell">{fmtMoneyShort(grossFy26)}</span>
          <span className={`mono ${styles.cellNum}`} role="cell">{fmtMoneyShort(grossFy27)}</span>
          <span className={`mono ${styles.cellNum}`} role="cell">{fmtDelta(grossDelta)}</span>
          <span className={`mono ${styles.cellNum}`} role="cell">{fmtPercent(grossPct, 1)}</span>
          <span className={styles.cellDriver} role="cell">Sum of all 16 GL buckets</span>
        </div>
      </div>

      <p className={styles.note}>
        Each bucket's FY27 value scales by its driver family relative to the
        FY27 default (= the parent forecast at default levers). Group totals
        sum exactly to the corresponding waterfall bar above. Allocations are
        excluded — they're intercompany reclassifications and don't change
        gross spend. Δ% is FY27 vs FY26 actual.
      </p>
    </div>
  );
}

export function BucketDetailPlaceholder() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className="label">Forecast detail by GL bucket</span>
        <span className={styles.sub}>FY26 actual · FY27 forecast · Δ</span>
      </header>
      <div className={styles.placeholder}>Loading…</div>
    </div>
  );
}
