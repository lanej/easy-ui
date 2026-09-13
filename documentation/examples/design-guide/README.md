# View Rule examples

These are the canonical React implementations and synthetic fixtures for the
[View Rule design guide](https://github.com/lanej/viewrule/pull/11). They compose
Easy UI's ThemeProvider, Card, Button, CompactTimeSeries, RangePlot, and BulletChart.
They do not add public component APIs. The original area-encoding SVG is an
explicit teaching control, not a purported Easy UI chart component.

The pricing task is fictional: compare proposed prices, contribution scenarios,
and constraint states before queueing analyst review. Nothing activates a price;
these are not EasyPost business rules. Changing the task makes different
presentations appropriate. Sources cited on each example support principles,
not an experimental evaluation of this interface.

## Run and reuse

- Source and fixtures: `easy-ui-react/src/examples/DesignGuide.*`.
- Storybook: `Patterns / View Rule`, including multiple expanded rows and advisory
  counterexamples. Storybook args set the initial state; remount to reset it.
- Existing chart gallery: `/comparisons/pricing.html` and
  `/comparisons/encodings.html`; these routes are build outputs, not a claim of deployment.
- `pricing.html?mode=compact&open=A,B` retains both expanded rows.
  Other modes: `sparse`, `overloaded`, `clipped`, `table`, `trends`, `detail`.
  Tasks: `routine`, `trend`, `audit`. Notes and actions stay in memory and are
  excluded from shared URLs. Reset/reload clears them.

```sh
npm ci --prefix scripts/preview-metrics
EASY_UI_GUIDE_ONLY=1 EASY_UI_PREVIEW_BASE=./ EASY_UI_PREVIEW_OUT_DIR=dist-guide npm run --prefix scripts/preview-metrics build
cd scripts/preview-metrics
npx vite preview --outDir dist-guide
```

The normal `npm run build:docs` includes the same entries alongside existing
charts, Storybook, API documentation, and maps. The small guide-only build avoids
ECharts/MapLibre and emits redistribution notices, local fonts, and static assets.

Keep the implementation here. View Rule's `npm run examples:import -- <checkout>
<commit>` builds and imports this output from a clean, pinned checkout, records
checksums in its guide manifest, and keeps the installed examples usable offline.
Do not independently edit the generated View Rule HTML/JS/CSS. Its rules JSON and
Markdown guidance remain canonical in View Rule.

## Design and verification boundaries

Several Card rows expand independently; this does not change DataGrid's
single-expansion API. CompactTimeSeries uses explicit shared dates and a 0–200
value domain. Sparkline's per-series auto-scaling is unsuitable for this
magnitude-comparison task. RangePlot and BulletChart use explicit domains.
The area-control SVG represents 80, 40, 20 through circle area, not radius.

View Rule's existing installed regression owns the composed examples' contract:
`pricing-labels` expects three clipping findings only in `clipped`;
`encoding-shared-domain` expects two mismatched declarations in `rescaled`.
Sparse/overloaded rows and area encodings can pass these checks while making the
stated comparison harder. A pass cannot establish decision sufficiency or
independently recover chart truth. Keep the fixture and expectations in sync.

Screenshots here were rendered locally at 1200×1000 CSS px (full page), mobile
390×844, device scale 1, Chromium 138.0.7204.0, light theme. `compact.png` and
`mobile.png` have A expanded; `trends.png` uses the trend task; `audit.png` uses
the individual investigation task. Full-page height is not viewport fit.

Before importing a revision, run the repository build and relevant lint checks,
inspect actual states and keyboard behavior, then run View Rule's installed
workflow against the imported assets. Refresh screenshots when appearance changes.
