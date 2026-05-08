"use client";

import styles from "./slider.module.css";

export type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
  /** Optional label rendered to the right of the title (e.g., "$ / sqft"). */
  unit?: string;
  /** Shaded zones rendered behind the track (e.g., DENSIFY/STANDARD/PREMIUM). */
  zones?: Array<{ from: number; to: number; label: string; tone?: "muted" | "accent" }>;
  /** Footnote text below the track. */
  footnote?: string;
};

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  unit,
  zones,
  footnote,
}: SliderProps) {
  const fillPct = ((value - min) / (max - min)) * 100;

  return (
    <div className={styles.slider}>
      <div className={styles.head}>
        <span className="label">{label}</span>
        {unit ? <span className={`label ${styles.unit}`}>{unit}</span> : null}
        <span className={`mono ${styles.value}`}>{formatValue(value)}</span>
      </div>

      <div className={styles.trackWrap}>
        {zones && zones.length > 0 ? (
          <div className={styles.zones} aria-hidden>
            {zones.map((z) => {
              const left = ((z.from - min) / (max - min)) * 100;
              const width = ((z.to - z.from) / (max - min)) * 100;
              return (
                <div
                  key={z.label}
                  className={`${styles.zone} ${z.tone === "accent" ? styles.zoneAccent : ""}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={z.label}
                />
              );
            })}
          </div>
        ) : null}

        <div className={styles.track} aria-hidden>
          <div className={styles.fill} style={{ width: `${fillPct}%` }} />
        </div>

        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={formatValue(value)}
        />
      </div>

      {zones && zones.length > 0 ? (
        <div className={styles.zoneLabels} aria-hidden>
          {zones.map((z) => {
            const left = ((z.from - min) / (max - min)) * 100;
            const width = ((z.to - z.from) / (max - min)) * 100;
            return (
              <div
                key={z.label}
                className={`label ${styles.zoneLabel}`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                {z.label}
              </div>
            );
          })}
        </div>
      ) : null}

      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
    </div>
  );
}
