"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeScenario } from "@/lib/compute";
import { baseCase, defaultLevers, presets } from "@/lib/base-case";
import { leversToQuery } from "@/lib/levers";
import type { Levers } from "@/lib/types";
import { KpiCards } from "./kpi-cards";
import { LeverPanel } from "./lever-panel";
import { DriverWaterfall } from "./driver-waterfall";
import { ReasonabilityChecks } from "./reasonability-checks";
import { ThreeStmtTable } from "./three-stmt-table";
import { BucketDetailTable } from "./bucket-detail-table";
import type { PresetName } from "./scenario-presets";
import pageStyles from "@/app/page.module.css";

/**
 * Stateful root for the dashboard. Holds lever state, computes the current and
 * base scenarios, syncs URL on change. Initial levers come from the server
 * (via `initialLevers` prop), so the SSR HTML matches the URL — no flash on
 * hydration even when the URL has non-default lever values.
 */
export function Explorer({ initialLevers }: { initialLevers?: Levers }) {
  const [levers, setLevers] = useState<Levers>(initialLevers ?? defaultLevers);

  // Sync URL whenever levers change (after first paint, to avoid SSR/CSR mismatch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = leversToQuery(levers);
    const url = `${window.location.pathname}${next}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [levers]);

  const setLever = useCallback(
    <K extends keyof Levers>(key: K, value: Levers[K]) => {
      setLevers((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const applyPreset = useCallback((name: PresetName) => {
    setLevers({ ...presets[name] });
  }, []);

  const reset = useCallback(() => setLevers({ ...defaultLevers }), []);

  const baseScenario = useMemo(
    () => computeScenario(baseCase, defaultLevers),
    [],
  );
  const currentScenario = useMemo(
    () => computeScenario(baseCase, levers),
    [levers],
  );

  return (
    <>
      <section className={`${pageStyles.kpis} stagger stagger-2`}>
        <KpiCards base={baseScenario} current={currentScenario} />
      </section>

      <section className={`${pageStyles.chartPane} stagger stagger-3`}>
        <DriverWaterfall current={currentScenario} />
      </section>

      <aside className={`${pageStyles.sidebar} stagger stagger-4`}>
        <LeverPanel
          levers={levers}
          setLever={setLever}
          applyPreset={applyPreset}
          reset={reset}
        />
      </aside>

      <section className={`${pageStyles.reasonPane} stagger stagger-4`}>
        <ReasonabilityChecks current={currentScenario} />
      </section>

      <section className={`${pageStyles.tablePane} stagger stagger-4`}>
        <ThreeStmtTable current={currentScenario} />
      </section>

      <section className={`${pageStyles.bucketDetailPane} stagger stagger-5`}>
        <BucketDetailTable current={currentScenario} />
      </section>
    </>
  );
}
