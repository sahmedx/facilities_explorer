"use client";

import type { Scenario } from "@/lib/types";
import { fmtInteger } from "@/lib/format";
import styles from "./reasonability-checks.module.css";

/**
 * Per-office FY27 unit economics. Numeric metrics recompute live with the
 * lever multipliers in compute.ts. Notes are static per office (lifted from
 * WRITEUP_CALLOUTS.md — they describe office character, not lever-dependent
 * outcomes).
 */
export function ReasonabilityChecks({ current }: { current: Scenario }) {
  const rows = current.reasonability;

  const totalHC = rows.reduce((s, r) => s + r.fy27AvgHC, 0);
  const totalSqft = rows.reduce((s, r) => s + r.fy27SqftWeighted, 0);
  const blendedSqftPerHC = totalHC > 0 ? totalSqft / totalHC : 0;
  const totalRentDollars = rows.reduce(
    (s, r) => s + r.rentPerSqftPerYr * r.fy27SqftWeighted,
    0,
  );
  const blendedRentPerSqft = totalSqft > 0 ? totalRentDollars / totalSqft : 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="section-index">
          <span className="code-badge code-badge--dim">03 · REASONABILITY</span>
          <span className="section-index__rule" aria-hidden />
          <span className="label">Per-office unit economics</span>
        </div>
      </header>

      <div className={styles.table} role="table">
        <div className={`${styles.row} ${styles.headRow}`} role="row">
          <span className={`label ${styles.cellOffice}`} role="columnheader">Office</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">FY27 HC</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">Sq ft</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">sq ft / HC</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">Rent / sq ft</span>
          <span className={`label ${styles.cellNotes}`} role="columnheader">Notes</span>
        </div>

        {rows.map((r) => (
          <div key={r.office} className={styles.row} role="row">
            <span className={styles.cellOffice} role="cell">{r.office}</span>
            <span className={`mono ${styles.cellNum}`} role="cell">
              {fmtInteger(r.fy27AvgHC)}
            </span>
            <span className={`mono ${styles.cellNum}`} role="cell">
              {fmtInteger(r.fy27SqftWeighted)}
            </span>
            <span className={`mono ${styles.cellNum} ${belowThreshold(r.sqftPerHC) ? styles.cellBelowThreshold : ""}`} role="cell">
              {Math.round(r.sqftPerHC)}
            </span>
            <span className={`mono ${styles.cellNum}`} role="cell">
              ${Math.round(r.rentPerSqftPerYr).toLocaleString("en-US")}
            </span>
            <span className={styles.cellNotes} role="cell">{r.notes}</span>
          </div>
        ))}

        <div className={`${styles.row} ${styles.totalRow}`} role="row">
          <span className={styles.cellOffice} role="cell">Total / blended</span>
          <span className={`mono ${styles.cellNum}`} role="cell">
            {fmtInteger(totalHC)}
            <span
              className={styles.footnoteMarker}
              tabIndex={0}
              role="note"
              aria-label="Footnote: weighted average throughout the year"
            >
              <span className={styles.footnoteNumber}>1</span>
              <span className={styles.footnoteTooltip} aria-hidden="true">
                Weighted average throughout the year
              </span>
            </span>
          </span>
          <span className={`mono ${styles.cellNum}`} role="cell">
            {fmtInteger(totalSqft)}
            <span
              className={styles.footnoteMarker}
              tabIndex={0}
              role="note"
              aria-label="Footnote: weighted average throughout the year"
            >
              <span className={styles.footnoteNumber}>1</span>
              <span className={styles.footnoteTooltip} aria-hidden="true">
                Weighted average throughout the year
              </span>
            </span>
          </span>
          <span className={`mono ${styles.cellNum}`} role="cell">
            {Math.round(blendedSqftPerHC)}
          </span>
          <span className={`mono ${styles.cellNum}`} role="cell">
            ${Math.round(blendedRentPerSqft).toLocaleString("en-US")}
          </span>
          <span className={styles.cellNotes} role="cell">
            sqft-weighted average
          </span>
        </div>
      </div>

      <p className={styles.note}>
        Square footage per FTE highlighted when below 120 (over-densified). Numbers recompute as
        you drag the levers — try Densify (Square footage per FTE drops into the 120s) or
        Premium (Square footage per FTE pushes past 180). Two pre-existing data quirks survive
        into FY27 because we used FY26 as the basis: UK rent at $22/sf
        (coworking) and Japan rent at $427/sf (likely bundled services).
      </p>
    </div>
  );
}

function belowThreshold(sqftPerHC: number): boolean {
  return sqftPerHC < 120;
}

function formatSnacks(perHC: number): string {
  if (perHC < 1000) return `$${Math.round(perHC).toLocaleString("en-US")}`;
  return `$${(perHC / 1000).toFixed(1)}k`;
}
