"use client";

import type { Levers } from "@/lib/types";
import { baseCase, presets, defaultLevers } from "@/lib/base-case";
import { fmtPercent } from "@/lib/format";
import { ScenarioPresets, type PresetName } from "./scenario-presets";
import { Slider } from "./slider";
import styles from "./lever-panel.module.css";

const ranges = baseCase.leverRanges;

export type LeverPanelProps = {
  levers: Levers;
  setLever: <K extends keyof Levers>(key: K, value: Levers[K]) => void;
  applyPreset: (preset: PresetName) => void;
  reset: () => void;
};

export function LeverPanel({
  levers,
  setLever,
  applyPreset,
  reset,
}: LeverPanelProps) {
  const isBase =
    levers.density === defaultLevers.density &&
    levers.hcVariance === defaultLevers.hcVariance &&
    levers.buildoutCost === defaultLevers.buildoutCost &&
    levers.snacksPerHCYearly === defaultLevers.snacksPerHCYearly &&
    levers.fnfPerSeat === defaultLevers.fnfPerSeat &&
    levers.expand === defaultLevers.expand;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className="label">Levers</span>
        <button
          type="button"
          className={styles.reset}
          onClick={reset}
          disabled={isBase}
          aria-label="Reset to base case"
        >
          <span className={styles.resetGlyph} aria-hidden>
            ↺
          </span>
          <span>Reset</span>
        </button>
      </div>

      <ScenarioPresets current={levers} onSelect={applyPreset} />

      <div className={styles.expandToggle} role="group" aria-label="Expand FY27 capacity">
        <span className={styles.expandLabel}>Expand FY27?</span>
        <div className={styles.expandButtons}>
          <button
            type="button"
            className={`${styles.expandBtn} ${levers.expand ? styles.expandBtnActive : ""}`}
            onClick={() => setLever("expand", true)}
            aria-pressed={levers.expand}
          >
            Yes
          </button>
          <button
            type="button"
            className={`${styles.expandBtn} ${!levers.expand ? styles.expandBtnActive : ""}`}
            onClick={() => setLever("expand", false)}
            aria-pressed={!levers.expand}
          >
            No
          </button>
        </div>
      </div>

      <div className={styles.sliders}>
        <Slider
          label="Space density"
          unit="sqft / HC"
          value={levers.density}
          min={ranges.density.min}
          max={ranges.density.max}
          step={ranges.density.step}
          onChange={(v) => setLever("density", v)}
          formatValue={(v) => `${v}`}
          zones={[
            { from: 100, to: 130, label: "Densify" },
            { from: 130, to: 160, label: "Standard", tone: "accent" },
            { from: 160, to: 250, label: "Premium" },
          ]}
        />
        <Slider
          label="HC variance"
          unit="vs plan"
          value={levers.hcVariance}
          min={ranges.hcVariance.min}
          max={ranges.hcVariance.max}
          step={ranges.hcVariance.step}
          onChange={(v) => setLever("hcVariance", roundHc(v))}
          formatValue={(v) => fmtPercent(v, 0)}
          footnote="Affects capex more than P&L; most HC OPEX flows through allocations."
        />
        <Slider
          label="Buildout cost"
          unit="$ / sqft (LHI)"
          value={levers.buildoutCost}
          min={ranges.buildoutCost.min}
          max={ranges.buildoutCost.max}
          step={ranges.buildoutCost.step}
          onChange={(v) => setLever("buildoutCost", v)}
          formatValue={(v) => `$${v}`}
          zones={[
            { from: 200, to: 300, label: "Class B" },
            { from: 300, to: 400, label: "Standard", tone: "accent" },
            { from: 400, to: 600, label: "Class A" },
          ]}
        />
        <Slider
          label="Snacks"
          unit="$ / HC / year"
          value={levers.snacksPerHCYearly}
          min={ranges.snacksPerHCYearly.min}
          max={ranges.snacksPerHCYearly.max}
          step={ranges.snacksPerHCYearly.step}
          onChange={(v) => setLever("snacksPerHCYearly", v)}
          formatValue={(v) =>
            v >= 10000 ? `$${(v / 1000).toFixed(0)}k` : `$${(v / 1000).toFixed(1)}k`
          }
        />
        <Slider
          label="F&F per seat"
          unit="$ / seat"
          value={levers.fnfPerSeat}
          min={ranges.fnfPerSeat.min}
          max={ranges.fnfPerSeat.max}
          step={ranges.fnfPerSeat.step}
          onChange={(v) => setLever("fnfPerSeat", v)}
          formatValue={(v) => `$${Math.round(v).toLocaleString("en-US")}`}
        />
      </div>
    </div>
  );

  // The hcVariance slider step is 0.01 but JS float math produces tails like
  // -0.030000000000000002. Round to 2 decimals for clean URL serialization.
  function roundHc(v: number) {
    return Math.round(v * 100) / 100;
  }
}

// Small helper used by parent state. Re-exported here for convenience.
export { presets };
