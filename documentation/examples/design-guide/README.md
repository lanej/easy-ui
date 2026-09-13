# View Rule examples

These are the canonical React implementations and synthetic fixtures for the
[View Rule design guide](https://github.com/lanej/viewrule/pull/11). They compose
Easy UI's ThemeProvider, Card, Button, CompactTimeSeries, RangePlot, BulletChart,
Chart, and NetworkMap. NetworkMap gains an optional `showSelectionDetails` prop
(default true) for compositions that already show selected context elsewhere.
The original area-encoding SVG is an
explicit teaching control, not a purported Easy UI chart component.

The pricing task is fictional: compare proposed prices, contribution scenarios,
and constraint states before queueing analyst review. Nothing activates a price;
these are not EasyPost business rules. Changing the task makes different
presentations appropriate. Sources cited on each example support principles,
not an experimental evaluation of this interface.

## Run and reuse

- Source and fixtures: `easy-ui-react/src/examples/DesignGuide.*` and `NetworkGuide.*`.
- Storybook: `Patterns / View Rule`, including multiple expanded rows and advisory
  counterexamples. Storybook args set the initial state; remount to reset it.
- Existing chart gallery: `/comparisons/pricing.html` and
  `/comparisons/encodings.html`, and `/comparisons/network.html`; these routes are
  build outputs, not a claim of deployment.
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
charts, Storybook, API documentation, and maps. The guide build emits redistribution notices, local fonts, and static assets.
Its lightweight entries avoid loading the network entry’s ECharts/MapLibre engines.

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

## Linked network investigation

`NetworkGuide.examples.tsx` and its fixtures add a MapLibre NetworkMap, an ECharts
bar/line capacity comparison, a labeled heatmap, and a count-conserving Sankey.
Open `network.html` or Storybook `Patterns / View Rule / Network Investigation`.
`network.html?mode=fragmented` presents the same task, components, data, and selected
hub in separate evidence tabs. It is an advisory counterexample, not a prohibition
on tabs. Map/heatmap/exact-table selection updates the selected hub's charts.
Keyboard tab navigation, explicit missing observations, local queue feedback, and
exact-data disclosures remain available.

The task is to choose a hub to investigate before dispatch. It assumes that
capacity, trajectory, and downstream exposure matter together; this is a design
hypothesis. Hourly throughput/capacity, six-hour transfer counts, and 24-hour
facility-cohort exception risk use different denominators. Sankey widths are
counts, not future risk; transfer lines are endpoints, not traveled roads. Capacity
and risk color thresholds are supplied illustrative inputs, not View Rule failures
or actual EasyPost policy. At narrow widths the panels stack and simultaneous
comparison is lost.

The network entry loads the existing full ECharts engine and MapLibre plus its
matching module worker. Pricing/encoding entries do not request those engines.
The guide build now includes these optional assets; it no longer has an entirely
engine-free bundle. A production modular loader remains outside this change.

### Offline geographic context

The map uses a bundled GeoJSON style with no remote tile, glyph, sprite, or basemap
requests. WebGL2 is required; NetworkMap keeps its location table if rendering
fails. All hubs, operations, forecasts, and weather in this example are synthetic.
Geographic context is generalized Natural Earth 1:50m, not navigational data.

Natural Earth sources, commit `ca96624a56bd078437bca8184e78163e5039ad19`:

- [Lakes](https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_lakes.geojson)
- [State/province boundary lines](https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_admin_1_states_provinces_lines.geojson)
- [Public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/)

`NetworkGuide.geography.json` retains features with any coordinate inside
longitude −90…−76, latitude 37…46; boundary features additionally require
`ADM0_A3` USA or CAN. It retains complete geometry and only the layer/name
properties (42 features). This is feature selection, not geometric clipping.
The source coordinates are unchanged. The style overlays synthetic connections
and optional forecast weather on the local geographic context.

The network screenshots use Chromium 138.0.7204.0 with its matching SwiftShader
libraries: 1440×1100 CSS px desktop and 390×844 mobile, device scale 1, light
scheme, reduced motion. Detroit is selected; the optional synthetic weather
layer is enabled. The mobile capture starts at its own viewport. All browser
requests outside the local preview origin were blocked. This composition hides
the map’s duplicate detail card because its selected context is above the panels.
The default card now paints above its markers. The heatmap scrolls within a labeled region on
narrow screens instead of squeezing percentage labels into unreadable cells.
