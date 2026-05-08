# Facilities Explorer — Build Plan

> **⚠ Historical note (post-rebuild):** This document was written during the initial dashboard build. The anchor numbers throughout (`$33.23M gross`, `$5.22M net after-tax`, `−$12.41M net cash`, etc.) reflect the **pre-rebuild** state of the parent forecast. After the build, several refinements were applied to the parent project (10-month avg backfill for Feb-Mar 2025, Unallocated HC scaling, FacilitiesPayroll switched to sqft-driven, allocations excluded from totals, gross-OPEX cash framing, +$226K Apr 2026 Maintenance forecast adjustment), and the dashboard's KPI cards / waterfall / 3-stmt walk / bucket-detail table were updated accordingly. **Current anchors at expand-to-plan: gross $35.74M, capex $13.44M, net cash −$42.93M, +34,800 sqft.** See `../FORECAST_DRIVERS.md` and `../PROJECT_INDEX.md` for current numbers; this document preserves the build-plan structure with its original anchors.

**Companion to:** the FY27 facilities forecast in `../writeup.md` and `../forecast_model.xlsx`.
**Project navigation:** `../PROJECT_INDEX.md` is the canonical file map for the parent case-study project — every CSV, phase script, assumption file, methodology doc, and writeup is described there. Consult it first when looking for source data, phase outputs, or methodology references.
**Deliverable:** a single-page interactive web app, deployed to Vercel, that lets a CFO/FP&A audience drag five levers (now six, with `expand` toggle added post-build) and see live three-statement impact for the FY27 facilities plan.
**Form factor:** Next.js (App Router) + TypeScript + hand-rolled SVG charting on d3-scale. No backend.

---

## 1. Audience and intent

The static writeup answers "what does the FY27 plan cost?" The dashboard answers the harder follow-up: **"what are the consequences of the plausible alternatives?"**

Per `../writeup.md` §Executive Summary, the single most consequential FY27 decision is whether to execute the implied 34,800 sqft capacity expansion at the 150 sqft/HC threshold, at $12M of LHI capex. Tighter densification (125 sqft/HC) materially cuts both capex and rent; a looser standard (200 sqft/HC) pushes capex to ~$18M. The dashboard makes that decision space draggable.

**Positioning:** an FP&A-partner-built tool, not a sensitivity toy. The hiring manager should be able to click three preset scenarios and reach an informed view in 30 seconds, without needing to know what 150 sqft/HC means.

---

## 2. Product spec

### 2.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  WORDMARK                                            v1 PROTOTYPE│
├──────────────────────────────────────────────────────────────────┤
│  Prose strap: 1–2 sentences framing the question                 │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                     │
│  │ Gross  │ │ Net    │ │ Total  │ │ Net    │   ← KPI cards (4)   │
│  │ P&L    │ │ AT P&L │ │ Capex  │ │ Cash Δ │     value + Δ vs    │
│  └────────┘ └────────┘ └────────┘ └────────┘     base case       │
├────────────────────────────────────────────────┬─────────────────┤
│                                                │                 │
│  Monthly P&L chart                             │  Levers         │
│  FY26 baseline (slate, muted)                  │                 │
│  FY27 forecast (indigo)                        │  [presets]      │
│  July 2026 expansion marker                    │                 │
│                                                │  ▸ Density       │
│                                                │  ▸ HC variance   │
├────────────────────────────────────────────────┤  ▸ Buildout cost │
│                                                │  ▸ Snacks $/HC   │
│  Three-statement table                         │  ▸ F&F per seat  │
│  Base │ Current │ Δ                            │                 │
│  P&L · BS movements · CF · ties                │  [reset]        │
│                                                │                 │
└────────────────────────────────────────────────┴─────────────────┘
│  Footer: methodology note + Korea WeWork signal footnote         │
└──────────────────────────────────────────────────────────────────┘
```

Sidebar fixed at 380px (per Plex Reorg precedent). Main column flexes.

### 2.2 The five levers

| # | Lever | Range | Step | Default | Drives | Track annotation |
|---|---|---|---|---|---|---|
| 1 | Space density (sqft/HC) | 100–250 | 25 | 150 | sqft trajectory → rent + LHI capex | 100–130 **DENSIFY**, 130–160 **STANDARD**, 160–250 **PREMIUM** |
| 2 | HC variance (%) | -15 to +15 | 1 | 0 | HC-driven OPEX, F&F/OE capex | Footnote: *affects Capex more than P&L; most HC OPEX flows through allocations* |
| 3 | Buildout cost ($/sqft, LHI) | 200–600 | 25 | 350 | LHI capex only | $250 Class B · $350 standard · $500 Class A |
| 4 | Snacks ($/HC/yr) | 3,000–15,000 | 500 | 14,000 | Snacks line on P&L | Shaded zone $1.5k–$3k = industry benchmark |
| 5 | F&F per seat ($) | 2,000–5,000 | 250 | 3,399 | F&F capex only | (no zones) |

**Cut deliberately:** Korea toggle, defer-expansion toggle, rent escalator, inflation. Each was either too small to earn a slot, redundant, or scope-creep on the math model.

### 2.3 Scenario presets

Three buttons that snap all five sliders simultaneously. This is the central UX mechanism — without it, the user has to invent plausible scenarios; with it, the answer is one click.

| Preset | Density | HC var | Buildout | Snacks | F&F | Narrative |
|---|---:|---:|---:|---:|---:|---|
| Densify | 125 | 0% | $350 | $5,000 | $3,399 | "Hot-desking + opex squeeze" |
| Base case | 150 | 0% | $350 | $14,000 | $3,399 | "FY27 plan as written" |
| Premium expansion | 200 | 0% | $500 | $14,000 | $4,500 | "Class A standard — both density and buildout cost stacked" |

A **Reset** button reverts to Base case. URL query params encode current scenario state for shareability.

> **On Premium capex magnitude:** stacking density 200 sqft/HC with $500/sqft buildout produces ~$36M total capex, well above the writeup's §4 single-lever sensitivity ceiling of $18.7M. That's not a bug — it's the dashboard demonstrating exactly why combining levers matters: the multipliers compound. The narrative should frame Premium as "what if we accepted both a generous space standard *and* a Class A buildout cost?" rather than implying it lands inside the writeup's range.

### 2.4 KPI cards (4) — current values reflect post-rebuild

Each shows: label · current value · signed delta vs base case in oxblood (positive = worse cash) or sage (negative = better cash). Mono tabular, large display size.

| Card | Expand-to-plan default | Sign convention |
|---|---:|---|
| Gross facilities P&L | $35.7M | positive Δ = worse |
| Total Capex FY27 | $13.4M | positive Δ = worse |
| Net Cash Change | −$42.9M | positive Δ = better (less negative) |
| OpEx per FTE | $46k | positive Δ = worse (per-HC cost ↑) |

Cash Change is the headline metric — visually slightly larger, since it's the number leadership actually decides on (per writeup §1.3). The "Net after-tax P&L" card from the original plan was dropped post-rebuild: facilities is a cost center with no operating income of its own to tax, and allocations are excluded from totals. "OpEx per FTE" replaces it as a per-HC efficiency view.

### 2.5 Monthly chart

- X axis: 12 months Feb 2026 – Jan 2027.
- Y axis: monthly gross facilities P&L, $.
- Two series: FY26 baseline (slate `--c-emp`, muted, 50% opacity) vs FY27 forecast (indigo `--c-team`, primary).
- Hairline gridlines at $1M intervals.
- Vertical guide line at July 2026 with label *"Capacity expansion: +N,NNN sqft"* — N updates as the density slider moves.
- Tooltip on hover: month + both series values, mono.
- Hand-rolled SVG, d3-scale only (no Recharts). ~200 lines.

### 2.6 Three-statement table

Compact ~10 rows, three columns: **Base · Current · Δ**.

```
                          Base       Current      Δ
P&L
  Rent                  $9.2M       …           …
  HC-driven OPEX        $X.XM       …           …
  Snacks                $X.XM       …           …
  Allocations OUT     -$26.3M       …           …
  Net after-tax @25%    $5.2M       …           …
BS movements
  Δ Fixed Assets       +$9.4M       …           …
  Δ Accum Dep          -$4.0M       …           …
  Δ Retained Earnings  -$5.2M       …           …
CF
  Operating CF         +$1.0M       …           …
  Capex (Investing)   -$13.4M       …           …
  Net Cash Change     -$12.4M       …           …
```

Hairline borders, mono numerals, signed deltas with `+`/`−` (true minus, not hyphen).

### 2.7 Prose strap

Above the KPI cards, two sentences:

> *"FY27 implies a $12M leasehold buildout to relieve a 150 sqft/HC capacity ceiling. Use the levers below — or click a preset — to compare densification, base case, and premium expansion paths. Numbers reconcile to the underlying Excel model at default settings."*

### 2.8 Footer

One line, in muted ink:
> *"Methodology: see ../writeup.md. The transaction data — a ₩54.7M deposit and 'Korea WeWork rent' entries in Apr 2026 — corroborates the capacity expansion case."*

### 2.9 Wordmark

Following Plex Reorg conventions: literal text in IBM Plex Sans 700, `-0.01em` tracking. **`TechCo · Facilities`** with a small mono pill `FY27 · INTERACTIVE` in indigo on `--c-team-bg`. No graphic mark.

---

## 3. Visual design — two layers

The interface inherits from two design skills already in this repo. Both are non-optional for this build. The Plex Reorg layer defines what the interface *looks like*; the Make-Interfaces-Feel-Better layer defines how it *behaves*. They're complementary, not redundant.

### 3.1 Identity layer — Plex Reorg (`../design/`)

Lifted wholesale. Tokens come in via `app/globals.css` from `../design/colors_and_type.css`.

- **Type.** IBM Plex Sans 400/500/600/700 for display + UI; IBM Plex Mono 400/500/600 for codes, currency, HC counts, deltas, and eyebrow labels. Both via `next/font/google` in `app/layout.tsx`.
- **Color.** Indigo `#6366f1` accent (KPIs, sliders, presets); slate `#64748b` for the FY26 baseline series. Oxblood `#b04848` for cost increases (positive Δ on this dashboard); sage `#2f8a64` for cost decreases. Solid colors only — no gradients, no textures, no full-bleed imagery.
- **Density.** Comfier than typical SaaS: 38px row equivalents, section padding 14–22px, header padding 14×22.
- **Borders.** 1px hairline (10% ink) for soft separators; 1px hairline-strong (20%) for structural ones. The active-state accent line under preset buttons is 2px indigo.
- **Radii.** 3–4px on tiny pills/badges; 4–6px on inputs and buttons; 6–8px on cards. Never above 8.
- **Iconography.** None. Unicode glyphs only (`↺` reset, `▾` chevron, `▸` collapsed, `—` em-dash separator). No SVG icons in the component layer. No emoji.
- **Casing.** Sentence case throughout. UPPERCASE only for tiny tracked labels (column headers, eyebrows like `P&L` / `BS MOVEMENTS` / `CASH FLOW`).
- **Numerals.** Always mono, always tabular, always currency- or unit-suffixed (`$1.55M`, `+34,800 sqft`, `±$0`). Negatives use the true `−` minus sign in computed deltas, never the hyphen `-`. Sign always present on deltas, even when zero (`±$0`).
- **Microcopy register.** Quiet, factual, slightly clinical. Implicit second person. No "we" or "I". No marketing voice. No exclamation points. No filler — every label earns its place.

### 3.2 Polish layer — Make Interfaces Feel Better (`make-interfaces-feel-better/`)

Applied at the component level. Each principle has a specific landing spot in this build.

| Principle | Where it applies |
|---|---|
| **Concentric border radius** | KPI cards (outer radius = inner content radius + padding); preset button group (outer container vs button radii); slider container vs thumb. Calculate `outerRadius = innerRadius + padding` rather than reusing the same value. |
| **Tabular numerals** | All slider value displays, KPI cards, chart tooltips, 3-stmt table cells. `font-variant-numeric: tabular-nums` set on `:root` via `globals.css`, with explicit `tabular-nums` className on dynamic spans for SSR robustness. |
| **Font smoothing** | `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale` on `html` element in `app/layout.tsx`. |
| **Text wrapping** | `text-wrap: balance` on the prose strap (heading-like, ≤2 lines). `text-wrap: pretty` on footer microcopy. Neither on long paragraphs (none in this build, but applies if added). |
| **Interruptible transitions** | KPI value color changes (oxblood↔ink↔sage as deltas flip sign), preset selection states, hover lifts — all CSS transitions, never keyframes. The user dragging a slider mid-recompute must retarget smoothly without snapping. |
| **No `transition: all`** | Specify exact properties everywhere: `transition-property: scale, background-color, color, box-shadow`. Tailwind's plain `transition` is also banned — use bracket syntax `transition-[scale,opacity]` if Tailwind is added. |
| **Scale on press** | Preset buttons, Reset button: `scale(0.96)` on `:active` (never below 0.95 — anything less feels exaggerated). Not applicable to sliders (continuous input) or to chart bars (not interactive). |
| **Stagger enter on first load** | Prose strap → KPI cards → chart → 3-stmt table, ~100ms apart. Each item: `opacity 0→1`, `translateY 12px→0`, `blur 4px→0`, 400ms ease-out. After first load, no enter animations on slider-driven re-renders. |
| **Skip animation on default-state elements** | If AnimatePresence ends up used anywhere, `initial={false}` so default-state elements (KPIs at base case) don't re-animate on first paint. Verify nothing legitimate breaks. |
| **Subtle exit** | Chart tooltip on hover-out: `opacity 1→0` + `translateY 0→-4px`, 150ms ease-in. Don't use full-height slides. |
| **Minimum hit area** | Slider thumbs: visible 16×16px circle, hit area extended to 40×40px via `::before` pseudo-element. Reset button: minimum 40×40 padding-box. Preset buttons satisfy this naturally given their text + padding. |
| **`will-change` sparingly** | Add `will-change: transform` to slider thumbs only if first-frame stutter shows during fast drags (likely on Safari). Never preemptive. Never `will-change: all`. |
| **Optical alignment** | Reset button has a `↺` glyph + "Reset" text — apply the icon-side trim rule (right padding = left padding − 2px) so the glyph doesn't visually drift. |

### 3.3 Component-specific rules

These are the per-component design specs that combine both layers.

**Sliders.** Hairline-strong track (4px height, 20% ink) with indigo fill from track-start to thumb position. Thumb: 16×16 white circle, hairline-strong border, `var(--elev-2)` shadow on hover. Hit area extended via `::before` pseudo to 40×40. Value display floats above the thumb in IBM Plex Mono with `tabular-nums`, unit suffix in `--ink-muted`. Track annotations (density zones, snacks benchmark band) rendered below the track in 10.5px UPPERCASE with `0.06em` tracking, in `--ink-muted`. The value display follows the thumb position smoothly via CSS transform.

**KPI cards.** White paper, 1px hairline border, 8px outer radius, `var(--s-5)` padding (18px). Inner content (label / value / delta) is text-only — no nested rounded surfaces, so concentric math doesn't kick in here. Net Cash Change card has a 1px indigo border (full-strength accent) instead of hairline; the other three are hairline. Value transitions: `transition-property: color` 120ms ease-out (for sign-flip color shift); the value text content updates instantly (React re-render). KPI value spans carry both `font-feature-settings: "tnum"` and `font-variant-numeric: tabular-nums`.

**Preset buttons.** Three side-by-side, equal width, hairline border, 6px radius. Selected: 1px indigo border + `--c-team-bg` background tint. Unselected: paper background, `--ink-soft` text. Hover: surface lift to `--surface` (only the background changes, not the border). Press: `scale(0.96)`. `transition-property: scale, background-color, border-color` 150ms ease-out. Concentric: if the three buttons live inside a rounded container, use `outerR = 6 + 4 = 10px` on the container; if not, no container.

**Reset button.** Standalone, hairline border, 6px radius, `↺ Reset` label. Optical padding: left 12px, right 10px (icon-side rule). Press scale 0.96. Hit area at minimum 40×40.

**Chart.** Hand-rolled SVG (no Recharts). Bars: 12 month-cells × 2 series. FY26 series is `--c-emp` slate at 50% opacity; FY27 series is `--c-team` indigo at 100%. Hairline gridlines at $1M intervals: `<line stroke="var(--hairline)" stroke-width="1"/>`. July 2026 expansion marker: 2px dashed indigo vertical line, label above with dynamic sqft count. Tooltip: white paper, hairline border, 6px radius, 8×12 padding, `var(--elev-2)` shadow. Tooltip enter: 50ms opacity 0→1. Tooltip exit: 150ms opacity 1→0 + `translateY(0→-4px)` (subtle exit). All numbers in tooltip mono + tabular.

**Three-statement table.** No outer border. Hairline section dividers between P&L / BS / CF blocks, with eyebrow label above each (`P&L`, `BS MOVEMENTS`, `CASH FLOW` in 10.5px UPPERCASE, `0.06em` tracking, `--ink-muted`). Three columns at 33%/33%/33%, right-aligned mono values. Δ column: oxblood for unfavorable, sage for favorable, `--ink-faint` for `±$0`. Row hover: surface lift to `--surface`, 120ms ease-out — same hover treatment as Plex Reorg tree rows.

**Wordmark.** `TechCo · Facilities` in IBM Plex Sans 700 at 18px (h2 scale), `-0.005em` tracking. Adjacent mono pill `FY27 · INTERACTIVE` in indigo on `--c-team-bg`, 10.5px/500, `0.02em` tracking, 4px radius, `2px 7px` padding (the canonical code-pill spec). No graphic mark. No tagline.

**Prose strap.** Two sentences max, `--t-h3` size (15px), `--ink-soft` color, `text-wrap: balance`, max-width 720px. Sits between the wordmark and the KPI cards with `--s-6` (22px) of vertical breathing room above and below.

**Footer.** One line, `--t-small` (12px), `--ink-muted`, `text-wrap: pretty`. Hairline-strong rule above.

### 3.4 First-load choreography

The 400ms first-paint sequence (`opacity` + `translateY` + `blur`):

```
0ms      Wordmark + version pill              (always visible, no animation)
100ms    Prose strap                          (heading-like, balance)
200ms    KPI cards (4)                        (the numbers — most important)
300ms    Chart                                (visual)
400ms    Lever panel + 3-stmt table           (interactive surface + detail)
```

Each stage uses `opacity 0→1`, `translateY 12px→0`, `filter blur(4px)→blur(0)`, 400ms ease-out. **Implemented as CSS-only utility classes** (`.stagger`, `.stagger-1`, `.stagger-2`, `.stagger-3`, `.stagger-4` with `animation-delay`). No `motion/react` dependency. A `prefers-reduced-motion: reduce` media query disables the animation and forces `opacity: 1`.

After first load, no further enter animations. Slider-driven KPI updates are pure CSS transitions on color (interruptible). The chart re-renders with no animation — bars snap to new heights since the user is actively dragging.

---

## 4. Tech choices

| Choice | Rationale |
|---|---|
| Next.js (App Router) | Familiar deployment story to Vercel; one route is enough. |
| TypeScript | Math engine and lever schema benefit from type safety. |
| d3-scale + hand-rolled SVG | Pixel-perfect Plex aesthetic; Recharts defaults fight the design. |
| Plex Reorg design system (lifted) | Already exists in `../design/`; copy `colors_and_type.css` into `globals.css`. |
| URL query params for scenario state | Shareable links; no backend needed. |
| IBM Plex Sans + Plex Mono via `next/font/google` (CSS variable approach) | Per design system; tokens reference `var(--font-plex-sans/mono)`. |
| Static export / serverless on Vercel | No SSR needed; numbers are fully client-computed. |
| Vitest for the math engine | Isolated tests against the verification gate; runs under Node, not the browser. |

**Pinned versions** (verified live as of 2026-05-07; do not regress without checking the docs):

| Package | Version | Notes |
|---|---|---|
| next | 16.2.5 | Turbopack is the default bundler; no `experimental.turbo` block needed. |
| react / react-dom | 19.2.6 | App Router uses React 19 stable features. |
| typescript | ^5.7.3 | TS 6 was available; held back one major for tooling-compat safety. |
| d3-scale | ^4.0.2 | Only `scaleLinear` / `scaleBand` are used in Phase 6. |
| @types/d3-scale | ^4.0.9 | |
| vitest | ^4.1.5 | |
| eslint | ^9 | Flat config (`eslint.config.mjs`) — required by Next 16. |
| eslint-config-next | 16.2.5 | |
| @types/node | ^25.6.0 | |

**Out of stack:** Recharts, Chart.js, MUI, Tailwind, Lucide / Heroicons, any icon library, motion/react. Per Plex Reorg rules: unicode glyphs and text labels only. Stagger animation is CSS-only (see §3.4).

---

## 5. Data and math model

### 5.1 Base case JSON (`data/base-case.json`)

Frozen snapshot generated by `scripts/generate_base_case.py` from the parent project's Phase 4–7 outputs. ~19 KB. Re-run the generator if any upstream phase output changes.

**Architectural note:** the schema below is the *as-shipped* shape. An earlier draft of this plan defined per-office `rentRatePerSqftMonthly` etc. and expected the math engine to recompute FY27 from FY26 unit rates × FY27 drivers. That approach drifts from the parent project by ~$1.35M because the parent uses `FY26 same-fiscal-month cell × driver factor × cost factor (1.03 inflation/escalator)`, not unit-rate math. The current schema instead captures the parent's **FY27 default monthly cells per office × per category**, and the math engine multiplies them by lever-driven scaling factors. At default levers all multipliers = 1.0, so reconciliation is *guaranteed by construction*. See `POSTMORTEM.md` for the full story.

```ts
type BaseCase = {
  fy27Months: string[];            // 12 entries: 2026-02 … 2027-01
  fy26Months: string[];            // 12 entries: 2025-02 … 2026-01
  offices: Array<{
    name: string;
    sqftCurrent: number;
    sqftPostExpansion: number;     // parent's plan at default density 150
    sqftAdditionFY27: number;
    q4Fy27Hc: number;
    capacityBreach: boolean;       // at default density
    expansionMonth: string | null; // "2026-07" if breach, else null
    fy27MonthlyHC: number[];       // 12 entries (Feb 2026 → Jan 2027)
    hcAnchorJan2026: number;       // for Feb 2026 HC delta (FF/OE capex)
    rentPerSqftMonthly: number;    // FY26 reference, kept for traceability
    snacksPerHCMonthly: number;    // FY26 reference, kept for traceability
    /** FY27 default monthly cells (parent's Phase 4 PnL output, by category).
     *  These ARE the math engine's baseline. Lever multipliers scale them. */
    fy27DefaultMonthly: {
      rent: number[];              // 12 entries
      sqftDrivenOther: number[];   // utilities + maintenance + insurance
      snacks: number[];
      hcDrivenExSnacks: number[];  // office supplies + team events + postage + T&E + furniture opex + equip software
      fixed: number[];             // facilities payroll + bank charges + prof services + taxes
    };
  }>;
  unallocated: {
    monthlyFixed: number;          // FY26 reference
    annualFixed: number;
    fy27DefaultMonthly: number[];  // catch-all: Unallocated/INTL + small actuals-only offices (France, Germany)
  };
  depreciation: {
    existingAnnualByType: { LHI: number; FF: number; OE: number };  // Phase 5 reclassified existing run-rate
    existingAnnualTotal: number;   // ≈ $3.01M, NOT the $2.84M FY26-unit-rate sum
    existingMonthlyTotal: number;
    fy27DefaultMonthly: number[];  // total dep at default (existing + new) per Phase 5
  };
  fy26Monthly: { gross: number[]; allocations: number[]; net: number[] };
  fy26Seasonality: number[];       // monthly gross / annual gross
  fy26Total: { gross: number; allocations: number; net: number; netAfterTax: number };
  fy27DefaultReference: {
    fy27DefaultGross: number[];           // Phase 4 PnL placeholder dep
    fy27DefaultAllocations: number[];
    fy27DefaultNet: number[];
    totalGrossPhase4Placeholder: number;  // $32.30M
    totalGrossCorrected: number;          // $33.23M (Phase 7 integrated walk)
    totalAllocations: number;             // -$26.26M
    totalNetPretax: number;
    totalNetAfterTax: number;             // $5.22M
    totalCapex: number;                   // $13.44M
    lhiCapex: number;
    ffCapex: number;
    oeCapex: number;
    totalDA: number;                      // $4.02M
    deltaFANet: number;                   // $9.42M
    deltaAP: number;                      // $2.23M (used for ΔAP scaling)
    operatingCF: number;
    investingCF: number;
    netCashChange: number;                // -$12.41M
    expansionSqft: number;                // 34,800
  };
  fy27Defaults: {
    densitySqftPerHC: 150;
    buildoutCostPerSqft: 350;
    fnfPerSeat: 3399.16;
    oePerHC: 1686.45;
    snacksPerHCYearly: 14000;
    hcVariancePct: 0;
    taxRate: 0.25;
    capacityTriggerSqftPerHC: 150;
    expansionMonth: "2026-07";
    effectiveAllocationRatio: 0.7904;     // calibrated against corrected gross so default reconciles
  };
  leverRanges: {
    density:           { min: 100,  max: 250,   step: 25,   default: 150 };
    hcVariance:        { min: -0.15, max: 0.15, step: 0.01, default: 0 };
    buildoutCost:      { min: 200,  max: 600,   step: 25,   default: 350 };
    snacksPerHCYearly: { min: 3000, max: 15000, step: 500,  default: 14000 };
    fnfPerSeat:        { min: 2000, max: 5000,  step: 250,  default: 3399 };
  };
  useful_lives_years: { LHI: 7; FF: 5; OE: 3 };
};
```

### 5.2 Math engine (`lib/compute.ts`)

Pure function:

```ts
type Levers = {
  density: number;             // sqft / HC
  hcVariance: number;          // -0.15 to +0.15 (decimal, not %)
  buildoutCost: number;        // $/sqft for LHI capex
  snacksPerHCYearly: number;   // $ snacks / HC / year
  fnfPerSeat: number;          // $ furniture & fixtures per new seat
};

function computeScenario(base: BaseCase, levers: Levers): Scenario;
```

(`Scenario` shape is in `lib/types.ts` — kpis, monthlyPnL, capex, pnl, bs, cf, threeStmtRows.)

**Architecture: lever multipliers against parent's default cells.** Each cost category has a default monthly value (from `base.offices[i].fy27DefaultMonthly[category][month]`) and a lever-driven multiplier. At default levers all multipliers = 1.0, so reconciliation is by construction.

**The five lever multipliers:**

| Lever | Multiplier definition | Affects |
|---|---|---|
| `density` | per-office, per-month: `1.0` if `month < expansionMonthIdx` else `newPostSqft / defaultPostSqft`, where `newPostSqft = max(sqftCurrent, peakLeveredHC × density)` | rent, sqftDrivenOther; LHI capex (independently, via expansionSqft) |
| `hcVariance` | `1 + hcVariance` (uniform across offices and months) | snacks, hcDrivenExSnacks, per-office fixed (FacilitiesPayroll dominates); FF + OE capex via HC delta on the levered HC trajectory |
| `buildoutCost` | `levers.buildoutCost / 350` (linear) | LHI capex only |
| `snacksPerHCYearly` | `levers.snacksPerHCYearly / 14000` (linear) | snacks only (combines multiplicatively with hcVariance) |
| `fnfPerSeat` | `levers.fnfPerSeat / 3399.16` (linear) | FF capex only (and through it, FF new-asset depreciation) |

**Compute order** (the actual implementation):

1. **Compute lever scalars** — `hcFactor = 1 + hcVariance`, `snacksRateFactor`, `buildoutFactor`, `fnfFactor`.
2. **Per-office sqft trajectory** — apply `hcFactor` to monthly HC; compute `peakLeveredHC × density`; if `> sqftCurrent`, expand. Per-month `sqftFactor[m]` = `1.0` pre-expansion, `newPostSqft / defaultPostSqft` post-expansion.
3. **Per-office monthly P&L** — for each (office × month): `rent[m] = default × sqftFactor[m]`; `sqftDrivenOther[m] = default × sqftFactor[m]`; `snacks[m] = default × hcFactor × snacksRateFactor`; `hcDrivenExSnacks[m] = default × hcFactor`; `fixed[m] = default × hcFactor` (FacilitiesPayroll dominates this bucket and scales with company HC; small fixed buckets approximated as also HC-scaling — acceptable error at 0.16% of gross).
4. **Aggregate** — sum per-office monthly P&L; add unallocated (held flat — not lever-affected); compute per-category and total annual gross excluding depreciation.
5. **Capex** — LHI = `Σ expansionSqft × buildoutCost`; FF + OE per month from `max(0, hcMonthly[m] - hcMonthly[m-1]) × per-seat-rate` summed across offices (anchor on `hcAnchorJan2026 × hcFactor` for Feb 2026 delta).
6. **Depreciation** — existing (Phase 5 by-asset run-rate, constant) + new-asset SL: `LHI = lhiCapex / (7 × 12) × monthsAfterPIS`, FF and OE summed similarly per monthly addition.
7. **Allocations** — `-effectiveAllocationRatio × gross` (where `gross = grossExclDep + depreciation`). Effective ratio (0.7904) is calibrated so default reconciles to -$26.26M.
8. **Net pretax** = `gross + allocations`. **Net after-tax** = `netPretax × (1 - taxRate)`.
9. **Cash flow** — `ΔAP = (parent's default ΔAP / parent's default gross) × gross` (linear scaling). `OperatingCF = -netAfterTax + depreciation + ΔAP`. `InvestingCF = -totalCapex`. `NetCashChange = sum`.
10. **BS movements** — `ΔFAGross = totalCapex`, `ΔAccumDep = -depreciation`, `ΔFANet = ΔFAGross + ΔAccumDep`, `ΔRetainedEarnings = -netAfterTax`, `ΔTaxPayable = -netPretax × taxRate`.

**Documented model simplifications** (mention in Phase 8 README):

1. **Allocations as ratio × gross.** The parent's allocations are HC-driven per-bucket. Approximating as a single ratio means HC variance moves allocations only via the gross channel, not directly. Reconciles to the dollar at defaults; behaves directionally correct under levers; expected drift under extreme levers is small.
2. **Per-office "fixed" bucket scales with `hcFactor`.** FacilitiesPayroll (the dominant component) genuinely scales with company HC. Small buckets (BankCharges, ProfServices, Taxes) are approximated. Error at 0.16% of gross.
3. **France + Germany small-office actuals** roll into unallocated (held flat). They appear in Feb-Mar 2026 transactions but aren't in the parent's HC/sqft plan; treating them as a fixed catch-all is the cleanest path.
4. **Existing depreciation uses Phase 5 reclassified run-rate** ($3.01M annual: LHI/FF/OE), not the FY26-unit-rate sum ($2.84M). This is what the parent's integrated walk reconciles to.

### 5.3 Verification gate (Phase 2 exit criterion)

At default levers, compute output must match the writeup's headline numbers within rounding. Under the lever-multiplier architecture (§5.2), reconciliation is *guaranteed by construction*: all multipliers = 1.0 at defaults, so KPIs equal the parent project's stored default values to the dollar.

**Actual reconciliation as shipped** (from `lib/compute.test.ts` diagnostic dump):

| Metric | Output | Target | Diff |
|---|---:|---:|---:|
| Gross facilities P&L | $33,228,541 | $33,228,541 | $0 |
| Net after-tax P&L | $5,223,527 | $5,224,403 | -$876 |
| Total Capex | $13,436,146 | $13,436,146 | $0 |
| Net Cash Change | -$12,411,939 | -$12,412,816 | +$877 |
| ΔFixed Assets (Net) | $9,416,410 | $9,416,410 | $0 |
| Expansion sqft | 34,800 | 34,800 | 0 |
| Depreciation | $4,019,736 | $4,019,736 | $0 |
| Allocations | -$26,263,839 | -$26,262,670 | -$1,169 |

The ~$1K diffs come from rounding the effective allocation ratio to 4 decimal places (0.7904). All within the writeup's natural rounding band. **All 13 vitest tests pass** (anchor reconciliation × 6, preset smoke tests × 3, directional sanity × 3, diagnostic dump × 1).

---

## 6. File structure

```
explorer/
├── PLAN.md                       (this file)
├── POSTMORTEM.md                 retrospective on Phases 1-3
├── README.md                     (Phase 8)
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs             flat config, Next 16 requirement
├── vitest.config.ts              test runner config
├── .gitignore
├── app/
│   ├── layout.tsx                fonts (next/font/google CSS variables) + metadata
│   ├── page.tsx                  composition root
│   ├── page.module.css           grid layout (1fr / 380px sidebar)
│   └── globals.css               lifted from ../design/colors_and_type.css + polish layer
├── components/
│   ├── wordmark.tsx              + wordmark.module.css
│   ├── prose-strap.tsx
│   ├── kpi-cards.tsx             + kpi-cards.module.css
│   ├── monthly-chart.tsx         d3-scale + raw SVG (Phase 6)
│   ├── three-stmt-table.tsx      3-column layout (Phase 7)
│   ├── lever-panel.tsx           container for sliders + presets + reset (Phase 4)
│   ├── slider.tsx                custom slider primitive (Phase 4)
│   ├── scenario-presets.tsx      3 preset buttons (Phase 4)
│   ├── footer.tsx
│   └── pane.module.css           shared pane chrome
├── lib/
│   ├── types.ts                  BaseCase, Levers, Scenario, ThreeStmtRow
│   ├── compute.ts                math engine (~250 lines)
│   ├── compute.test.ts           verification suite (13 tests)
│   ├── base-case.ts              imports JSON, exports defaultLevers + presets
│   ├── levers.ts                 URL serialization (Phase 4)
│   └── format.ts                 mono number formatters (Phase 5)
├── scripts/
│   └── generate_base_case.py     idempotent: re-reads parent CSVs, rebuilds JSON
└── data/
    └── base-case.json            generated, ~19 KB
```

**Note on `scripts/generate_base_case.py`:** this is a first-class artifact, not a one-off. If the parent project regenerates Phase 4–7 outputs, run `python3 scripts/generate_base_case.py` to rebuild the dashboard's base. The script prints a reconciliation summary on each run so any drift is caught immediately.

---

## 7. Phase plan

> **Status as of 2026-05-07:** Phases 1, 2, and 3 are complete and combined Phase 2 + 3 implementation was the right call (the math engine needs the dependency tree of a Next.js project to be testable in isolation under Vitest). See `POSTMORTEM.md` for the cross-phase retrospective.

### Phase 1 — Data layer ✅

**Goal:** produce frozen `data/base-case.json` from the parent project's Phase 4–7 outputs.

**Steps:**
1. Read `../assumptions/*.csv`, `../fy26_runrate/*.csv`, `../fy27_forecast/*.csv`. (Use `../PROJECT_INDEX.md` to confirm exact file paths and what each CSV contains; the parent project has many files and the index is the fastest way to orient.)
2. Derive per-office FY27 monthly cells per category (rent, sqftDrivenOther, snacks, hcDrivenExSnacks, fixed) — these become the math engine's baseline. Capture per-office Jan 2026 HC anchor (needed for Feb 2026 FF/OE capex delta).
3. Pull FY26 monthly gross/allocations/net series for chart baseline.
4. Pull FY27 default reference block (Phase 7 corrected gross $33.23M; Phase 4 placeholder $32.30M kept for traceability; full reconciliation totals).
5. Capture Phase 5 existing-asset depreciation by type ($3.01M annual: LHI/FF/OE), NOT the FY26-unit-rate sum.
6. Roll any non-tracked office (France, Germany, INTL, Unallocated) into the unallocated catch-all bucket.
7. Calibrate `effectiveAllocationRatio` against the *corrected* gross (yields 0.7904).
8. Write `explorer/data/base-case.json`. Print reconciliation summary on each run.

**Outputs:** `data/base-case.json` (~19 KB) + idempotent `scripts/generate_base_case.py` generator.

**Verification:** generator prints `gross excl dep | dep | total gross` totals matching Phase 7 walk to the dollar.

### Phase 2 — Math engine ✅ (combined with Phase 3)

**Goal:** TypeScript port of the FY27 forecast logic. Pure function, fully testable.

**Steps:**
1. Implement `computeScenario(base, levers)` per §5.2 — lever multipliers against parent's default cells.
2. Write `lib/compute.test.ts` covering the 6 anchor metrics in §5.3 at default levers.
3. Add smoke tests: Densify preset (Capex < base, < $8M), Premium preset (Capex > base, $25M-$45M — note: stacks levers, not single-lever like writeup §4 sensitivity), HC -10% (modest P&L move).
4. Add directional sanity tests (higher density → more sqft + LHI; higher snacks → higher gross; higher F&F → bigger capex than P&L diff).

**Outputs:** `lib/types.ts` + `lib/base-case.ts` + `lib/compute.ts` (~250 lines) + `lib/compute.test.ts` (13 tests) + `vitest.config.ts`.

**Verification:** all six anchor checks in §5.3 reconcile to the dollar (or within $1.2K rounding from the 4-decimal effective allocation ratio). All 13 tests pass. **Do not advance until these pass** — every UI element below depends on correct math.

> **Architectural lesson learned:** the first attempt recomputed FY27 from FY26 unit rates × FY27 drivers and overshot by $1.35M because the parent uses FY26 monthly cells × driver factor × inflation/escalator. Switching to "default cells × lever multipliers" made reconciliation guaranteed by construction. If a future revision drifts at defaults by more than ~0.1%, the architecture has been broken — don't paper it over.

### Phase 3 — Next.js scaffold + design tokens ✅

**Goal:** runnable shell with the layout grid, fonts, design tokens, and global polish rules in place.

**Steps:**
1. `npx create-next-app@latest --typescript` inside `explorer/`.
2. Add IBM Plex Sans + Plex Mono via `next/font/google` in `app/layout.tsx`.
3. Copy `../design/colors_and_type.css` into `app/globals.css` with provenance comment. Add the polish-layer globals on `:root` / `html`: `font-variant-numeric: tabular-nums`, `-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`.
4. Define base transition tokens (`--t-fast: 120ms ease-out`, `--t-med: 150ms ease-out`, `--t-slow: 400ms ease-out`) in `globals.css`.
5. Define the first-load stagger pattern as either a CSS utility (`.stagger-item:nth-child(N) { animation-delay: ... }`) or a motion variant — pick one based on whether `motion/react` ends up installed.
6. Build the page grid: header / strap / KPIs / [chart | sidebar] / table / footer.
7. Lift the wordmark and code pill primitive from `../design/`.

**Outputs:** dev server boots, layout shell renders with placeholder content, fonts crisp, numbers tabular, first-load stagger plays.

**Verification:** visual diff against the layout sketch in §2.1; fonts render with antialiased smoothing on macOS; first-load stagger animates in the correct order (strap → KPIs → chart → table); tokens accessible via CSS vars.

### Phase 4 — Slider primitives + lever state + presets

**Goal:** five working sliders, three preset buttons, reset, URL sync — all polished per §3.

**Steps:**
1. Build `components/slider.tsx`: hairline-strong track (4px / 20% ink), indigo fill, 16×16 white thumb with hairline-strong border. Hit area extended via `::before` pseudo-element to 40×40px. Mono value + unit display floats above the thumb with `tabular-nums`. Optional shaded zones (density: DENSIFY/STANDARD/PREMIUM) and benchmark band (snacks: $1.5k–$3k) rendered below the track in 10.5px UPPERCASE / `0.06em` tracking / `--ink-muted`.
2. Build `components/scenario-presets.tsx`: three buttons in a row, hairline border, 6px radius, `scale(0.96)` on `:active`. Selected state: 1px indigo border + `--c-team-bg` tint. `transition-property: scale, background-color, border-color` 150ms ease-out — no `transition: all`.
3. Lever state in a single React Context or `useState` lifted to `page.tsx`. Expose `levers`, `setLever(name, value)`, `applyPreset(name)`, `reset()`.
4. URL serialization in `lib/levers.ts`: `?d=125&hc=0&b=350&s=5000&f=3399`. Round-trip on mount.
5. Reset button: `↺ Reset` glyph + label, optical padding (left 12px / right 10px per icon-side trim rule), `scale(0.96)` on press. Reverts to Base case preset.
6. All clickable elements satisfy 40×40 minimum hit area.

**Outputs:** lever panel fully interactive; URL reflects state; presets snap all five sliders simultaneously; press feedback feels tactile.

**Verification:** drag each slider (thumb hit area lands cleanly, value display tracks smoothly), click each preset (sliders snap in unison, scale-on-press visible), refresh page (URL state survives), share URL with self in another tab. No `transition: all` anywhere.

### Phase 5 — KPI cards

**Goal:** four cards above the fold, live values + signed deltas vs base case, with interruptible transitions.

**Steps:**
1. Build `components/kpi-cards.tsx`. White paper, 1px hairline border, 8px outer radius, `--s-5` padding.
2. Wire to `computeScenario(base, currentLevers)` and `computeScenario(base, baseLevers)`. Memoize the base computation.
3. Format with `lib/format.ts`: `$1.55M`, `+$X.XM` / `−$X.XM` (true minus, never hyphen), `±$0` for zero deltas. Tabular-nums explicitly set on every dynamic value span.
4. Net Cash Change card emphasized: 1px indigo border (full-strength) instead of hairline; otherwise same dimensions.
5. Value transitions: CSS only, never keyframes. `transition-property: color` 120ms ease-out so the delta color (oxblood ↔ ink ↔ sage) retargets smoothly when the user drags a slider through the sign-flip point. The number text itself updates via React re-render — no animated counter.
6. First-load: KPI cards are stage 200ms in the stagger sequence per §3.4.

**Outputs:** dragging any slider updates the four cards live; sign-flips on deltas color-shift smoothly without snapping mid-drag.

**Verification:** at expand-to-plan preset, cards show $35.7M / $13.4M / −$42.9M / $46k OpEx-per-FTE with `±$0` deltas in `--ink-faint` (post-rebuild anchors). Hold-the-line preset (the new default) shifts to $30.7M / $0.4M / −$26.2M. Drag the density slider rapidly through 130→140→150→140 — color transitions retarget without jank. No layout shift as digit widths change (tabular-nums working).

### Phase 6 — Monthly chart

**Goal:** hand-rolled SVG showing FY26 baseline vs FY27 forecast with July expansion marker.

**Steps:**
1. d3-scale linear scales for X (12 months) and Y ($M).
2. Render two series as bars: FY26 in `--c-emp` slate at 50% opacity (muted), FY27 in `--c-team` indigo at 100%. Bars share month cells with small gap.
3. Hairline gridlines at $1M intervals via `<line stroke="var(--hairline)" stroke-width="1"/>`. Axis labels in IBM Plex Mono / `tabular-nums` / `--ink-muted` / 10.5px.
4. Vertical July 2026 expansion marker: 2px dashed indigo line. Label above with dynamic text "Capacity expansion: +N,NNN sqft" — N updates live as the density slider moves. Use `text-wrap: balance` on the label.
5. Hover tooltip: white paper, 1px hairline border, 6px radius, 8×12 padding, `var(--elev-2)` shadow. Contents in mono with tabular-nums. Tooltip enter: 50ms `opacity: 0→1`. Tooltip exit: 150ms `opacity: 1→0` + `translateY(0→-4px)` (subtle exit principle). `transition-property: opacity, translate` — never `all`.
6. If first-frame stutter shows on tooltip enter (Safari especially), add `will-change: transform` to the tooltip element only. Otherwise leave it off.

**Outputs:** chart renders cleanly at all preset scenarios; July step visible; tooltip enter/exit feels light, never abrupt.

**Verification:** sum of FY27 monthly bars equals KPI Gross P&L value within rounding. July marker label updates as density slider drags. Tooltip enter is fast (50ms), exit is slower (150ms) and slightly upward.

### Phase 7 — Three-statement table

**Goal:** compact ~10-row table, three-column layout (Base / Current / Δ).

**Steps:**
1. Build `components/three-stmt-table.tsx`.
2. Pull rows from `scenario.threeStmtRows`, group by statement section with hairline section dividers.
3. Mono numerals; signed deltas in oxblood/sage.
4. Section eyebrows: `P&L`, `BS MOVEMENTS`, `CASH FLOW`.

**Outputs:** complete table rendering at all preset scenarios; ties visible.

**Verification:** at default levers, after-tax NI row equals -ΔRetained Earnings row (the writeup's cross-statement tie).

### Phase 8 — Polish + deploy

**Goal:** publishable URL, README, link in `../writeup.md`. Both design layers fully audited.

**Steps:**
1. Footer with methodology note + Korea WeWork signal footnote (`text-wrap: pretty`, hairline-strong rule above).
2. Empty-state / loading polish (avoid flash of unstyled content; if next/font is cooperating this should be free).
3. Mobile responsiveness check — acceptable to require ≥1024px; below that, show a clean message ("Best viewed on desktop") with the same design system.
4. **Run the make-interfaces-feel-better review checklist:** concentric border radii on every nested rounded element, tabular-nums on every dynamic number, no `transition: all` anywhere (grep the codebase), `initial={false}` on any AnimatePresence, slider hit areas ≥40×40, scale-on-press at exactly 0.96, true minus signs on negatives, font smoothing on root, balance/pretty applied correctly, `will-change` only on transform/opacity/filter and only where stutter was observed. Fix anything that fails.
5. **Run the Plex Reorg identity audit:** sentence case verified throughout, UPPERCASE only on tracked labels, no SVG icons / no emoji slipped in, no gradients/textures, all numbers mono-tabular, deltas with explicit signs and true minuses, hairline borders consistent (10% vs 20% ink).
6. Write `README.md`: what it is, how to run, link back to writeup.
7. `vercel deploy`. **Confirm with user before pushing the production URL** — this is a publish-and-share action.
8. Add the Vercel URL to `../writeup.md` (header callout) and `../PROJECT_INDEX.md` (file map entry).
9. Update `../PROJECT_INDEX.md` to describe `explorer/`.

**Outputs:** live URL + updated cross-references in parent project; both design layers verified against their checklists.

**Verification:** open the live URL in a fresh browser, demo the 30-second flow per §9: Base → Densify → Premium. All four KPIs animate smoothly without snap, chart July marker updates, 3-stmt table Δ column flips colors correctly. No visual artifacts on a 13" laptop. Lighthouse / accessibility quick-pass.

---

## 8. Out of scope (deliberate)

| Item | Why cut |
|---|---|
| Korea expansion toggle | -$64k P&L / -$1.4M capex; doesn't earn primary slot. Surfaced in footer instead. |
| Defer-expansion timing toggle | Mostly shifts cash between fiscal years; adds complexity to math model. |
| Inflation lever | Vague; double-counts with the cut rent escalator. §4 sensitivity says ±200bps moves gross by ~$50k. |
| Rent escalator lever | §4 sensitivity says ±200bps moves gross by ~$60k. Below the noise floor. |
| FX lever | ±10% moves gross by ±$150k. Below the noise floor. |
| Tax rate lever | Distracts from the operating decision; tax shield not applied in the framing anyway (facilities is a cost center). |
| Per-office sqft override | Significant UI complexity; aggregate density slider captures the same decision. |
| Multi-scenario comparison view | A second column in the 3-stmt table per scenario would be valuable but doubles the build. v2. |
| ASC 842 lease modeling | Out of scope for the parent writeup; ditto here. |
| Authentication / persistence | URL params are sufficient; no backend. |

---

## 9. Demo flow (the 30-second story)

1. Land on the page. Prose strap reads: "FY27 implies a $12M leasehold buildout..."
2. KPI cards show **hold-the-line** (the new default): $30.7M gross, $0.4M capex, −$26.2M net cash, +0 expansion sqft. Seven of eight offices already breaching 150 sf/HC at year-end — that's the implicit cost of inaction.
3. Click **Expand to plan** preset. Sliders + expand toggle snap; KPIs animate. Capex steps to $13.4M, net cash worsens to −$42.9M (a $16.8M cash swing — the cost of the capacity decision). Expansion sqft jumps from 0 to +34,800.
4. Driver waterfall updates: Rent +$4.0M, FacilitiesPayroll +$0.43M, Sqft other +$0.13M — the sqft-led increase is visible per-bar.
5. Bucket-detail table shows all 16 GL lines reflowing per family. Maintenance moves into the +11.5% YoY range with the +$226K April adjustment baked in.
6. Click **Invest ahead**. Capex blows out to ~$36M (density 200 + buildout $500 + F&F $4500 stacked — well above the single-lever $18.7M ceiling). Cash burn worsens past −$60M. This is the "compounding levers" insight made visible.
7. Click **Hold the line** to reset, or drag any individual slider to explore.

That's the demo. The hiring manager doesn't need a tour; the presets carry the narrative.

---

## 10. Open questions

None at planning time. If the math engine in Phase 2 fails to reconcile to the writeup anchors, we'll need to debug the data layer (Phase 1) — that's the most likely failure mode and where to look first.

---

## 11. Data quirks (appendix)

Things that surprised me in Phases 1–2 and are worth flagging for anyone touching the data layer or math engine. Full retrospective in `POSTMORTEM.md`.

| Quirk | Where it bites | Resolution |
|---|---|---|
| Parent has TWO "FY27 gross" numbers | Phase 4 PnL CSV says $32.30M (placeholder D&A); Phase 7 integrated walk says $33.23M (corrected D&A). Writeup uses $33.23M. | Anchor on Phase 7. The generator stores both for traceability. |
| France + Germany small offices | Appear in Feb-Mar 2026 actuals (~$54k combined Rent + Snacks) but aren't in `hc_plan_monthly.csv` or `sqft_plan.csv`. | Generator rolls *any* non-tracked office into `unallocated.fy27DefaultMonthly`. |
| Existing depreciation has TWO totals | FY26 unit-rate sum: $2.84M annual. Phase 5 reclassified by asset type: $3.01M annual. | Use Phase 5 ($3.01M with LHI/FF/OE split) — that's what the integrated walk reconciles to. |
| Parent's Phase 4 uses FY26 monthly cells × factors, not unit rates | Recomputing from unit rates × FY27 drivers drifts by ~$1.35M because of inflation (3%), rent escalator (3%), and lost month-over-month variance (Australia rent gap). | Architecture pivot: use parent's default cells × lever multipliers. See §5.2. |
| Australia rent has a Jan 2026 substitution | The parent's `phase4_fy27_pnl.py` has a special case: if Australia FY26 rent for the look-up month is 0, substitute Jan 2026 rent as new baseline. | Captured in the parent's stored FY27 monthly values, so transparent to our math engine. |
| Phase 4 PnL has a `Snacks` value of -$200k under Unallocated | A reversing entry in actuals. | Rolls into our `unallocated` total — held flat under all levers. Doesn't affect leverable portion. |
| `next dev` modifies `tsconfig.json` on first boot | Changes `jsx: "preserve"` → `jsx: "react-jsx"`, adds `.next/dev/types` to `include`. | Expected; commit the modified file. |
| Vercel plugin hooks fire on every framework file write | Each one mandates "training data outdated, read docs first." Noisy but the underlying message is correct — Next 16.2.5 is current, not Next 15. | Always `npm view <pkg> version` before pinning when training cutoff is months stale. |
