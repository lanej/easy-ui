# Recharts comparison experiment

This branch starts at PR #1 (`a0bd1a8`) and compares its ECharts renderer with
Recharts 3.10.1. It does not change the default analytical library or publish a
second Easy UI API. Recharts is a dependency of this private preview harness only.

## Run

From `scripts/preview-metrics`:

```sh
npm ci
npm run build
npx vite preview
```

Open `/comparison.html`. Choose a chart, renderer, theme, and loading state.
Use `?engine=recharts` or `?engine=echarts` to load only one analytical renderer.
`?chart=refresh` compares zoom during a domain change. `/` retains the original
gallery and every lightweight example.

## Comparison contract

All 18 pairs read the same original synthetic fixtures and exact tables. Ports
use those records directly rather than converting arbitrary ECharts options.
The internal `ChartFrame` owns titles, descriptions, actions, states, and tables.
Each renderer owns its marks and interaction state. Recharts animation is disabled.
All six native components are unchanged.

| Pattern                                         | Recharts implementation                         | Remaining tradeoff                                    |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| Time series, stacked area, CDF, scenarios       | ComposedChart, Line, Area                       | App owns controlled zoom and series visibility        |
| Targets, warning regions, events                | ReferenceLine, ReferenceArea, ReferenceDot      | Label placement must be reviewed at small widths      |
| Grouped, normalized and labeled bars, histogram | Bar and LabelList                               | Bin definitions remain application data               |
| Scatter / bubble                                | Scatter and ZAxis                               | Area scales with volume; SVG only                     |
| Sankey                                          | Sankey with labeled nodes                       | Current ECharts adjacency emphasis is not reproduced  |
| Heatmaps                                        | Native HTML/CSS matrix                          | Extra component to maintain; not provided by Recharts |
| Donut and treemap                               | Pie and Treemap                                 | Treemap's small leaves use exact-table fallback       |
| Supplied min/P25/median/P75/max                 | Bar with custom summary shape                   | Supplied quartiles and tooltip; no invented samples   |
| Prediction interval                             | Range-valued Area plus observed/predicted Lines | Bounds are supplied model output                      |
| Contribution waterfall                          | Range-valued Bar with signed labels and tooltip | Layout/ledger transformation belongs to the port      |

The exact tables remain the common keyboard-accessible data path. Recharts adds
native keyboard tooltips and brushing where supported. This experiment does not
claim universal mark-level accessibility or dense-data Canvas parity.

## Lifecycle experiment

The live-refresh page uses the unchanged PR #1 ECharts interaction code. It
deliberately retains the two review findings as comparison evidence:

- A responsive default overwrites user zoom on refresh.
- A percentage interaction on an initially absolute range reverts to value mode.

The Recharts implementation keeps `{mode, start, end}` in React state. A data or
layout refresh does not replace that state; zoom actions explicitly select percent
mode. The original ECharts PR still needs its fixes independently of this branch.

## Evidence

```sh
npm run check:comparison
npm run measure:comparison
npm run capture:comparison
```

The capture command needs Playwright Chromium and runs in GitHub Actions. It
checks all pairs at 1440px and 390px, table equivalence, finite marks, missing-data
gaps, keyboard zoom, series visibility, suppressed heatmap cells, supplied box
summaries, prediction bands, signed tooltips, scatter selection, theme/states,
and isolated renderer requests. It also records both live-refresh cases.

`dist/comparison-bundles.json` measures complete production dependency closures,
including React, examples, frame, and integration. CSS is separate; fonts are
excluded. This is a fairer application comparison than selected Recharts exports
versus the entire ECharts library. ECharts has not been modularized here.

`screenshots/comparison/validation.json` includes five fresh-context navigation-to-
marks timings per renderer on the CI runner. These are descriptive, unthrottled
desktop measurements; they establish no mobile or large-dataset performance claim.

Review the screenshots and gaps before deciding on migration. Keep all 18 patterns
and the six native components through that decision.

## Color preference limitation

Easy UI `defaultTheme` currently reads `theme.light` for both color preferences.
The selector exercises theme-context and renderer lifecycle changes; it does not
supply a new dark palette. The comparison uses the default palette consistently
and avoids a simulated dark background that would misrepresent either renderer.
A complete dark theme needs a separate set of Easy UI token overrides.
