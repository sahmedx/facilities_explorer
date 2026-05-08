# Facilities Explorer — Phases 1–3 Post-Mortem

A short retrospective on building the data layer, math engine, and Next.js scaffold + design tokens. Captured 2026-05-07 immediately after the Phase 2 verification gate passed and the dev server booted clean.

---

## TL;DR

Three things surprised me, one architectural pivot saved the build, and one generalizable lesson is worth carrying forward.

| Surprise | Cost | Resolution |
|---|---|---|
| Parent project has multiple "FY27 gross" numbers depending on source ($32.30M Phase 4 placeholder vs $33.23M Phase 7 corrected) | ~30 min of confused reconciliation | Anchor explicitly on Phase 7 integrated walk |
| France + Germany small offices appear in FY27 actuals but not in the HC/sqft plan | $54k diff in default reconciliation | Roll any non-tracked office into unallocated |
| Initial math architecture (FY26 unit rate × FY27 driver) was wrong by ~$1.35M | Most of Phase 2 — required a full rewrite | Pivot to "FY27 default cells × lever multipliers" |

**Generalizable lesson**: when the dashboard's job is to show the impact of moving levers off the default, anchor on the parent's exact default values and compute deltas. Don't recompute from first principles unless you have to — you'll re-derive every assumption the parent already encoded (inflation, escalator, special-case rent gaps) and you'll drift.

---

## Phase 1 — Data layer

### What worked

- **Generator as a first-class artifact.** `scripts/generate_base_case.py` is idempotent and reads from the parent project's CSVs. If Phases 4–7 of the parent project regenerate, one command rebuilds the dashboard's base. This was the right shape.
- **Reconciliation print at the end of the generator.** Catching `target $33,228,541 / actual $33,174,867 / diff $-53,673` immediately at generation time, not at test time, saved a debug round-trip.

### What surprised me

- **Phase 4 vs Phase 7 numbers diverge.** Phase 4's `fy27_pnl_monthly.csv` has placeholder D&A ($3.09M) because the dep roll-forward is a Phase 5 output. Phase 7's integrated walk swaps in the corrected D&A ($4.02M), giving gross $33.23M. The writeup uses the Phase 7 number. If you anchor on Phase 4 alone, you'll be $930K under.
- **Eight offices in the plan, ten in the actuals.** Cleaned transactions for Feb-Mar 2026 had small Rent and Snacks entries for France and Germany — offices that don't exist in `hc_plan_monthly.csv` or `sqft_plan.csv`. They roll cleanly into unallocated once detected, but the catch wasn't obvious from the schema alone.
- **Existing depreciation has two answers.** Summing FY26 unit-rate dep gives $2.84M; the Phase 5 dep_roll says existing run-rate is $3.01M (LHI/FF/OE reclassified). Used Phase 5 — that's what the integrated walk reconciles to.

### What I'd do differently

Spend 5 minutes upfront computing the *target* totals from the parent's deepest-pipeline output (Phase 7 integrated walk report) before writing any generator code. I had the writeup's headline numbers but not the bucket-level decomposition that exposes which buckets land where.

---

## Phase 2 — Math engine

### What worked

- **Verification-first discipline.** Plan said "do not advance to Phase 3 until anchors pass." I kept that gate even when tempted to scaffold UI in parallel. When the first compute attempt overshot by $1.35M, I had nowhere to hide.
- **Test-time diagnostic dump.** A free `it("dump", () => { console.log(...); expect(true).toBe(true) })` test prints all six anchors with targets and diffs every test run. Tiny effort, huge debug value when comparing two compute architectures back-to-back.
- **Pivoting fast when the math was wrong.** I caught the $1.35M overshoot, traced it to inflation/escalator missing from my model, started to add 1.03 multipliers — then realized the right move was to abandon first-principles and anchor on the parent's default cells. About 45 minutes of "is this the right architecture?" before committing to the rewrite.

### What surprised me

- **First-principles math drifts even when the model looks right.** Approach 1: `FY26 unit rate ($/sqft/mo) × FY27 sqft × 12 months`. Approach 2 (parent): `FY26 same-fiscal-month value × sqft factor × 1.03`. They look equivalent but aren't. Approach 1 loses month-over-month variance (Australia rent gap, Feb-Mar 2026 actuals replacing extrapolations) that Approach 2 preserves. Plus parent applies inflation 3% on most opex and escalator 3% on rent — a multiplier I would not have known to add without reading `phase4_fy27_pnl.py`.
- **The cleanest math was the simplest math.** Once I pivoted to `gross(levers) = Σ default_cell × lever_multiplier(category, levers)`, the entire engine collapsed to ~250 lines, and reconciliation at defaults became *guaranteed by construction* (all multipliers = 1.0 at default). No tolerance bands needed.
- **Premium preset stacks levers in the same direction.** Density 200 + buildout $500 → ~$36M capex, not the ~$18M I'd written into the plan and demo flow. The writeup's $9.9M-$18.7M sensitivity range is single-lever; the dashboard's job is to show the multiplier when you stack them. The number is correct; the narrative needed updating.

### What I'd do differently

- **Read the parent's compute logic before writing my own.** I skimmed `phase4_fy27_pnl.py` only after my model overshot. Had I spent 10 minutes on it upfront, I'd have seen the FY26-cell-based approach and the cost factors immediately.
- **Default to "anchor + multiplier" architecture for any dashboard that's downstream of a forecast model.** It's not just simpler — it's structurally correct: the dashboard should match the model at default and show *deltas*, which is exactly what multipliers express.

---

## Phase 3 — Next.js scaffold + design tokens

### What worked

- **Verifying live versions before scaffolding.** My training data cutoff is Jan 2026; we're in May 2026. I `npm view`d each dependency before pinning. Result: Next 16.2.5 (not 15), React 19.2.6 (not 18), TypeScript 6.0.3 available (used 5.7 for tooling-compat safety), vitest 4.1.5. Saved a future "why doesn't this work" debug session.
- **Lifting design tokens wholesale, not adapting them.** `globals.css` is a near-verbatim copy of `../design/colors_and_type.css` plus the polish layer additions. No translation, no interpretation. The wordmark and code-pill primitives transferred without modification.
- **Two-layer design integration in code.** Plex Reorg identity layer (tokens, hairlines, mono numerals) + make-interfaces-feel-better polish layer (tabular-nums on `:root`, font-smoothing, transition tokens, stagger keyframe, prefers-reduced-motion guard). Both layers landed in one `globals.css` without conflict.

### What surprised me

- **Vercel plugin hooks fire on almost every file write.** `package.json`, `tsconfig.json`, `next.config.ts`, every `components/*.tsx`. Each one mandates "your training data is outdated, read the docs before continuing." Noisy in flow, but the underlying message turned out to be correct — I shipped current Next 16 patterns instead of 2025-era memorized ones.
- **Next dev modifies `tsconfig.json` on first boot.** Changes `jsx: "preserve"` → `jsx: "react-jsx"`, adds `.next/dev/types` to `include`. Expected behavior but not documented loudly. Caught me off guard mid-edit.
- **React Server Components serialization shows `$$` for `$` in the wire stream.** Looks like a double-dollar bug in the rendered HTML, but it's just RSC encoding — the actual DOM has the right single dollar. Worth knowing: don't grep the raw stream for currency symbols.

### What I'd do differently

Nothing major. Combining Phase 2 (math) and Phase 3 (scaffold) into one implementation step was the right call — the math engine needs the dependency tree of a Next project (`@/data/...`, `@/lib/...`) to be testable in isolation under Vitest. Splitting them would have been double work.

---

## Cross-phase patterns

### Things to repeat

1. **Generator scripts as first-class artifacts.** Idempotent, re-runnable, with reconciliation prints at the end.
2. **Verification gates between phases.** Especially "do not advance until anchors reconcile." Resist the urge to scaffold UI while math is uncertain.
3. **Diagnostic dump tests.** Cheap; high signal when comparing model versions.
4. **Live-version checks before scaffolding.** `npm view <pkg> version` is a one-line cost; misalignment is a silent failure mode.
5. **Two-layer design integration as a single CSS file.** Tokens + polish in one place beats fragmenting them across module boundaries.

### Things to flag earlier next time

1. **Architecture choice matters more than implementation details.** When the math model is downstream of someone else's forecast, anchor + multiplier > first-principles recompute. This should be the default for any dashboard companion to a model.
2. **Source-of-truth divergence in upstream pipelines.** Multi-phase projects often have placeholder values in early phases and corrections in later phases. Verify which value the headline number reconciles to *before* anchoring on it.
3. **Small offices / edge cases in actuals.** Any office that exists in transactions but not in the plan needs an explicit catch-all path.

---

## What this implies for the rest of the build

- Phase 4 (sliders + presets + URL state) is mostly UI plumbing on top of a now-solid math engine. Risk is low — the levers feed a function whose signature is locked.
- Phase 5 (KPI cards live-wired) inherits the same math engine and the design tokens are already in place. Mostly a matter of formatting (`lib/format.ts`) and CSS transitions on color.
- Phase 6 (chart) — d3-scale + hand-rolled SVG. The compute engine already returns `monthlyPnL.fy27Gross`, so chart is mostly axis math.
- Phase 7 (3-stmt table) — trivial given `threeStmtRows[]` is already in the Scenario shape.
- Phase 8 (deploy) — Vercel CLI is on hand; will confirm with user before pushing the production URL.

The math foundation is what could have killed this build. It didn't. The rest is execution.
