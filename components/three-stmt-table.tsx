"use client";

import type { Scenario } from "@/lib/types";
import { fmtMoneyShort, fmtDelta, deltaClass } from "@/lib/format";
import styles from "./three-stmt-table.module.css";

const SECTIONS: Array<{ key: "pnl" | "bs" | "cf"; label: string }> = [
  { key: "pnl", label: "P&L" },
  { key: "bs",  label: "BS movements" },
  { key: "cf",  label: "Cash flow" },
];

const EM_DASH = "—";

export function ThreeStmtTable({ current }: { current: Scenario }) {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="section-index">
          <span className="code-badge code-badge--dim">04 · STATEMENTS</span>
          <span className="section-index__rule" aria-hidden />
          <span className="label">Three-statement walk</span>
        </div>
        <span className={styles.sub}>FY26 actual · FY27 forecast · Δ</span>
      </header>

      <div className={styles.table} role="table">
        <div className={`${styles.row} ${styles.headRow}`} role="row">
          <span className={styles.cellLabel} role="columnheader">{" "}</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">FY26</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">FY27</span>
          <span className={`label ${styles.cellNum}`} role="columnheader">Δ</span>
          <span className={`label ${styles.cellDriver}`} role="columnheader">Driver</span>
        </div>

        {SECTIONS.map(({ key, label }) => {
          const sectionRows = current.threeStmtRows.filter((r) => r.statement === key);
          if (sectionRows.length === 0) return null;
          return (
            <section key={key} className={styles.section} role="rowgroup">
              <div className={styles.eyebrow}>
                <span className="label">{label}</span>
              </div>
              {sectionRows.map((r) => {
                const hasFy26 = r.fy26 !== null;
                const delta = hasFy26 ? r.current - (r.fy26 as number) : 0;
                const cls = hasFy26
                  ? deltaClass(delta, { signFlipForDelta: r.signFlipForDelta })
                  : null;
                return (
                  <div
                    key={r.label}
                    className={`${styles.row} ${r.emphasized ? styles.rowEmphasized : ""}`}
                    role="row"
                  >
                    <span className={styles.cellLabel} role="cell">{r.label}</span>
                    <span className={`mono ${styles.cellNum} ${!hasFy26 ? styles.cellMuted : ""}`} role="cell">
                      {hasFy26 ? fmtMoneyShort(r.fy26 as number) : EM_DASH}
                    </span>
                    <span className={`mono ${styles.cellNum}`} role="cell">
                      {fmtMoneyShort(r.current)}
                    </span>
                    <span
                      className={`mono ${styles.cellNum} ${
                        cls === "pos" ? styles.deltaPos : ""
                      } ${cls === "neg" ? styles.deltaNeg : ""} ${
                        !hasFy26 ? styles.cellMuted : ""
                      }`}
                      role="cell"
                    >
                      {hasFy26 ? fmtDelta(delta) : EM_DASH}
                    </span>
                    <span className={styles.cellDriver} role="cell">
                      {r.driver}
                    </span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <p className={styles.note}>
        Gross facilities P&L (highlighted) is the headline — the actual dollars
        committed to facilities. Allocations are excluded from every total on
        this dashboard: they're intercompany reclassifications that move cost
        between departments without changing the corporation's total cash, BS,
        or RE impact. Δ Retained earnings mirrors gross P&L; operating cash =
        −gross OPEX (excl. D&A) + ΔAP. FY26 columns blank for BS / CF — the
        parent model has no opening trial balance.
      </p>
    </div>
  );
}

/** SSR placeholder used by the server page until the client takes over. */
export function ThreeStmtPlaceholder() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="section-index">
          <span className="code-badge code-badge--dim">04 · STATEMENTS</span>
          <span className="section-index__rule" aria-hidden />
          <span className="label">Three-statement walk</span>
        </div>
        <span className={styles.sub}>FY26 actual · FY27 forecast · Δ</span>
      </header>
      <div className={styles.placeholder}>Loading…</div>
    </div>
  );
}
