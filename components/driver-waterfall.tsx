"use client";

import { useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import type { BucketDetailRow, Scenario, WaterfallStep } from "@/lib/types";
import { deltaClass, fmtDelta, fmtMoneyShort, fmtPercent } from "@/lib/format";
import { BUCKET_LABEL } from "@/lib/labels";
import styles from "./driver-waterfall.module.css";

const W = 760;
const H = 340;
const M = { top: 30, right: 16, bottom: 84, left: 60 };
const INNER_W = W - M.left - M.right;
const INNER_H = H - M.top - M.bottom;
/** Y-axis ceiling floor. Holds the axis steady at $50M while gross stays under
 *  it across most lever combinations; only grows for extreme scenarios. */
const Y_AXIS_MIN_CEILING = 50_000_000;

type DrawnStep = WaterfallStep & {
  /** y-axis top (higher value); for anchors === value */
  top: number;
  /** y-axis bottom (lower value); for anchors === 0 */
  bottom: number;
  /** Running total *after* this step (used for the connector line from this
   *  step's right edge to the next step's left edge). */
  runningAfter: number;
};

export function DriverWaterfall({ current }: { current: Scenario }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState(0);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  const trackY = (e: React.MouseEvent) => {
    const rect = chartWrapRef.current?.getBoundingClientRect();
    if (rect) setHoverY(e.clientY - rect.top);
  };

  const drawn = useMemo<DrawnStep[]>(() => {
    let running = 0;
    return current.waterfall.map((step) => {
      if (step.kind === "anchor") {
        running = step.value;
        return { ...step, top: step.value, bottom: 0, runningAfter: running };
      }
      const next = running + step.value;
      const top = Math.max(running, next);
      const bottom = Math.min(running, next);
      running = next;
      return { ...step, top, bottom, runningAfter: running };
    });
  }, [current.waterfall]);

  const { xScale, yScale, gridTicks, barWidth } = useMemo(() => {
    const x = scaleBand<number>()
      .domain(Array.from({ length: drawn.length }, (_, i) => i))
      .range([0, INNER_W])
      .padding(0.2);

    const yMaxData = Math.max(...drawn.map((d) => d.top), 1);
    const yMinRaw = Math.min(...drawn.map((d) => d.bottom), 0);
    // Pin axis at $50M unless data exceeds that; grow with 1.08× headroom above.
    const yMaxRaw = Math.max(yMaxData * 1.08, Y_AXIS_MIN_CEILING);
    const y = scaleLinear()
      .domain([Math.min(0, yMinRaw), yMaxRaw])
      .range([INNER_H, 0])
      .nice();

    return { xScale: x, yScale: y, gridTicks: y.ticks(5), barWidth: x.bandwidth() };
  }, [drawn]);

  const xCenter = (idx: number) => (xScale(idx) ?? 0) + barWidth / 2;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <span className="label">Driver waterfall · FY26 → FY27</span>
        </div>
        <div className={styles.legend} aria-hidden>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchBad}`} /> Cost up
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchGood}`} /> Cost down
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchAnchor}`} /> Total
          </span>
        </div>
      </header>

      <div className={styles.chartWrap} ref={chartWrapRef}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="FY26 to FY27 driver waterfall"
        >
          <g transform={`translate(${M.left},${M.top})`}>
            {/* Y gridlines + labels */}
            {gridTicks.map((t) => {
              const y = yScale(t);
              return (
                <g key={t}>
                  <line
                    x1={0}
                    x2={INNER_W}
                    y1={y}
                    y2={y}
                    stroke="var(--hairline)"
                    strokeWidth={1}
                  />
                  <text
                    x={-8}
                    y={y}
                    dy="0.35em"
                    textAnchor="end"
                    className={styles.axisText}
                  >
                    {t === 0 ? "$0" : fmtMoneyShort(t, { fractionDigits: 0 })}
                  </text>
                </g>
              );
            })}

            {/* X baseline */}
            <line
              x1={0}
              x2={INNER_W}
              y1={yScale(0)}
              y2={yScale(0)}
              stroke="var(--hairline-strong)"
              strokeWidth={1}
            />

            {/* Connector dashed lines: from each step's runningAfter to next step's left edge */}
            {drawn.slice(0, -1).map((step, i) => {
              const yLine = yScale(step.runningAfter);
              const xRight = (xScale(i) ?? 0) + barWidth;
              const xNextLeft = xScale(i + 1) ?? 0;
              return (
                <line
                  key={`conn-${i}`}
                  x1={xRight}
                  x2={xNextLeft}
                  y1={yLine}
                  y2={yLine}
                  stroke="var(--ink-faint)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              );
            })}

            {/* Bars */}
            {drawn.map((d, i) => {
              const xLeft = xScale(i) ?? 0;
              const yTop = yScale(d.top);
              const yBot = yScale(d.bottom);
              const h = Math.max(2, yBot - yTop);
              const isHover = hoverIdx === i;

              const fillClass =
                d.kind === "anchor"
                  ? styles.barAnchor
                  : d.tone === "bad"
                    ? styles.barBad
                    : styles.barGood;

              return (
                <g key={i}>
                  <rect
                    x={xLeft}
                    y={yTop}
                    width={barWidth}
                    height={h}
                    rx={1}
                    className={`${styles.bar} ${fillClass} ${isHover ? styles.barHover : ""}`}
                  />
                  {/* Value label on top of bar */}
                  <text
                    x={xCenter(i)}
                    y={yTop - 6}
                    textAnchor="middle"
                    className={styles.valueLabel}
                  >
                    {d.kind === "anchor"
                      ? fmtMoneyShort(d.value)
                      : fmtDelta(d.value)}
                  </text>
                </g>
              );
            })}

            {/* Diagonal X-axis labels */}
            {drawn.map((d, i) => {
              const x = xCenter(i);
              const y = INNER_H + 16;
              return (
                <g key={`label-${i}`} transform={`translate(${x},${y}) rotate(-32)`}>
                  <text className={styles.axisLabel} textAnchor="end">
                    {d.label}
                  </text>
                </g>
              );
            })}

            {/* Hit rects for hover */}
            {drawn.map((_d, i) => {
              const xLeft = xScale(i) ?? 0;
              const cellLeft =
                xLeft - (xScale.step() * xScale.padding()) / 2;
              const cellWidth = xScale.step();
              return (
                <rect
                  key={`hit-${i}`}
                  x={cellLeft}
                  y={0}
                  width={cellWidth}
                  height={INNER_H}
                  fill="transparent"
                  onMouseEnter={(e) => {
                    setHoverIdx(i);
                    trackY(e);
                  }}
                  onMouseMove={trackY}
                  onMouseLeave={() =>
                    setHoverIdx((cur) => (cur === i ? null : cur))
                  }
                />
              );
            })}
          </g>
        </svg>

        <Tooltip
          visible={hoverIdx !== null}
          step={hoverIdx !== null ? drawn[hoverIdx] : null}
          bucketDetail={current.bucketDetail}
          xCenterPct={
            hoverIdx !== null
              ? ((M.left + xCenter(hoverIdx)) / W) * 100
              : 50
          }
          yPx={hoverY}
        />
      </div>
    </div>
  );
}

function Tooltip({
  visible,
  step,
  bucketDetail,
  xCenterPct,
  yPx,
}: {
  visible: boolean;
  step: DrawnStep | null;
  bucketDetail: BucketDetailRow[];
  xCenterPct: number;
  yPx: number;
}) {
  const flipRight = xCenterPct > 70;
  // 16px below cursor — keeps the bar visible above the tooltip.
  const top = yPx + 16;

  const drillRows = useMemo(() => {
    if (!step || step.kind !== "delta" || !step.buckets) return [];
    const wanted = new Set(step.buckets);
    return bucketDetail
      .filter((r) => wanted.has(r.bucket))
      .slice()
      .sort((a, b) => Math.abs(b.deltaDollar) - Math.abs(a.deltaDollar));
  }, [step, bucketDetail]);

  return (
    <div
      className={`${styles.tooltip} ${visible ? styles.tooltipVisible : ""} ${flipRight ? styles.tooltipFlip : ""}`}
      style={{ left: `${xCenterPct}%`, top: `${top}px` }}
      aria-hidden={!visible}
    >
      <div className={styles.tooltipLabel}>{step?.label ?? ""}</div>
      <div className={`mono ${styles.tooltipValue}`}>
        {step
          ? step.kind === "anchor"
            ? fmtMoneyShort(step.value)
            : fmtDelta(step.value)
          : ""}
      </div>
      {step?.driver ? (
        <div className={styles.tooltipDriver}>{step.driver}</div>
      ) : null}

      {drillRows.length > 0 ? (
        <div className={styles.tooltipDrill} role="table" aria-label="GL bucket contributions">
          <div className={`${styles.drillRow} ${styles.drillHead}`} role="row">
            <span className={styles.drillBucket} role="columnheader">Bucket</span>
            <span className={styles.drillNum} role="columnheader">Δ$</span>
            <span className={styles.drillNum} role="columnheader">Δ%</span>
          </div>
          {drillRows.map((r) => {
            const cls = deltaClass(r.deltaDollar);
            const pctText = r.deltaPct === null ? "—" : fmtPercent(r.deltaPct, 0);
            return (
              <div key={r.bucket} className={styles.drillRow} role="row">
                <span className={styles.drillBucket} role="cell">
                  {BUCKET_LABEL[r.bucket]}
                </span>
                <span
                  className={`mono ${styles.drillNum} ${cls === "pos" ? styles.drillPos : ""} ${cls === "neg" ? styles.drillNeg : ""}`}
                  role="cell"
                >
                  {fmtDelta(r.deltaDollar)}
                </span>
                <span
                  className={`mono ${styles.drillNum} ${cls === "pos" ? styles.drillPos : ""} ${cls === "neg" ? styles.drillNeg : ""}`}
                  role="cell"
                >
                  {pctText}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function WaterfallPlaceholder() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <span className="label">Driver waterfall · FY26 → FY27</span>
          <p className={styles.sub}>Loading…</p>
        </div>
      </header>
      <div className={`${styles.chartWrap} ${styles.placeholder}`} />
    </div>
  );
}
