"use client";

import { presets } from "@/lib/base-case";
import type { Levers } from "@/lib/types";
import styles from "./scenario-presets.module.css";

export type PresetName = keyof typeof presets;

const PRESET_LABELS: Record<PresetName, { label: string; sub: string }> = {
  holdLine:     { label: "Baseline",       sub: "No expansion" },
  expandToPlan: { label: "Expand to plan", sub: "HC-driven capacity model" },
  investAhead:  { label: "Invest ahead",   sub: "Build for future growth" },
};

function presetEquals(a: Levers, b: Levers): boolean {
  return (
    a.density === b.density &&
    a.hcVariance === b.hcVariance &&
    a.buildoutCost === b.buildoutCost &&
    a.snacksPerHCYearly === b.snacksPerHCYearly &&
    a.fnfPerSeat === b.fnfPerSeat &&
    a.expand === b.expand
  );
}

export function ScenarioPresets({
  current,
  onSelect,
}: {
  current: Levers;
  onSelect: (preset: PresetName) => void;
}) {
  const active: PresetName | null =
    (Object.keys(presets) as PresetName[]).find((k) => presetEquals(current, presets[k])) ?? null;

  return (
    <div className={styles.row} role="group" aria-label="Scenario presets">
      {(Object.keys(presets) as PresetName[]).map((k) => {
        const isActive = active === k;
        return (
          <button
            key={k}
            type="button"
            className={`${styles.btn} ${isActive ? styles.active : ""}`}
            onClick={() => onSelect(k)}
            aria-pressed={isActive}
          >
            <span className={styles.label}>{PRESET_LABELS[k].label}</span>
            <span className={styles.sub}>{PRESET_LABELS[k].sub}</span>
          </button>
        );
      })}
    </div>
  );
}
