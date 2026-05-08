"use client";

import type { Scenario } from "@/lib/types";
import { fmtMoneyShort, fmtDelta, deltaClass, fmtMoneyFull, fmtMoneyFullDelta } from "@/lib/format";
import styles from "./kpi-cards.module.css";

const PLACEHOLDERS = [
  { label: "Gross facilities P&L", value: "$35.5M", emphasis: false },
  { label: "Total capex FY27",     value: "$13.4M", emphasis: false },
  { label: "Net cash change",      value: "−$42.7M", emphasis: true },
  { label: "OpEx per FTE",         value: "$46,127", emphasis: false },
];

/** SSR placeholder — same shape as the live cards, used by the server page. */
export function KpiCardsPlaceholder() {
  return (
    <div className={styles.row}>
      {PLACEHOLDERS.map(({ label, value, emphasis }) => (
        <div
          key={label}
          className={`${styles.card} ${emphasis ? styles.emphasis : ""}`}
        >
          <div className="label">{label}</div>
          <div className={`mono ${styles.value}`}>{value}</div>
          <div className={`mono ${styles.delta}`}>±$0</div>
        </div>
      ))}
    </div>
  );
}

type KpiCardsProps = {
  base: Scenario;
  current: Scenario;
};

type Fmt = "money" | "moneyFull";

export function KpiCards({ base, current }: KpiCardsProps) {
  const cards: Array<{
    label: string;
    value: number;
    delta: number;
    emphasis: boolean;
    signFlipForDelta: boolean;
    fmt: Fmt;
  }> = [
    {
      label: "Gross facilities P&L",
      value: current.kpis.grossPnL,
      delta: current.kpis.grossPnL - base.kpis.grossPnL,
      emphasis: false,
      signFlipForDelta: false,
      fmt: "money",
    },
    {
      label: "Total capex FY27",
      value: current.kpis.totalCapex,
      delta: current.kpis.totalCapex - base.kpis.totalCapex,
      emphasis: false,
      signFlipForDelta: false,
      fmt: "money",
    },
    {
      label: "Net cash change",
      value: current.kpis.netCashChange,
      delta: current.kpis.netCashChange - base.kpis.netCashChange,
      emphasis: true,
      // Cash change is more-negative-is-worse. So a NEGATIVE delta in the cash-
      // change number = WORSE outcome → flag with oxblood.
      signFlipForDelta: true,
      fmt: "money",
    },
    {
      label: "OpEx per FTE",
      value: current.kpis.opexPerFTE,
      delta: current.kpis.opexPerFTE - base.kpis.opexPerFTE,
      emphasis: false,
      // Higher $/FTE = worse (cost up) — same convention as gross P&L.
      signFlipForDelta: false,
      fmt: "moneyFull",
    },
  ];

  return (
    <div className={styles.row}>
      {cards.map(({ label, value, delta, emphasis, signFlipForDelta, fmt }) => {
        const cls = deltaClass(delta, { signFlipForDelta });
        const valueText =
          fmt === "money" ? fmtMoneyShort(value) : fmtMoneyFull(value);
        const deltaText = fmt === "money" ? fmtDelta(delta) : fmtMoneyFullDelta(delta);
        return (
          <div
            key={label}
            className={`${styles.card} ${emphasis ? styles.emphasis : ""}`}
          >
            <div className="label">{label}</div>
            <div className={`mono ${styles.value}`}>{valueText}</div>
            <div
              className={`mono ${styles.delta} ${cls === "pos" ? styles.deltaPos : ""} ${
                cls === "neg" ? styles.deltaNeg : ""
              }`}
            >
              {deltaText}
            </div>
          </div>
        );
      })}
    </div>
  );
}
