# Chart review examples

This isolated harness renders actual components and Storybook fixtures with synthetic shipping data and the published Easy UI token version declared by the library.

Keep fixture runtime dependencies in this package and its Vite aliases, including the icon package and React Aria Components used by DataGrid/Select. Verify a clean install outside the monorepo when introducing a new component; a local build can otherwise silently resolve dependencies from the surrounding checkout.

`mobile-data-grid.html` opens a ten-column benchmark report with readable column widths, wrapping headings, a fixed zone column and signed changes. The full comparison fits on a wide desktop and scrolls within its card on a phone; a focused metric view with its actual sample count is optional. Test 320/390 px and Larger text; `?expanded=1` exercises wrapped rich rows with expanded details. The fixture reuses the DataGrid Mobile Benchmarks story composition.

The original first gallery shows MetricCard KPIs, Sparkline report rows, BarList category comparisons, and BulletChart targets. The analytical gallery retains Sankey, time series, stacked area, grouped and stacked bars, scatter/bubble, heatmap, donut, and treemap. Open `?portfolio=lightweight` to load only the lightweight portfolio; `?renderer=canvas` exercises the analytical canvas renderer.

```sh
cd scripts/preview-metrics
npm ci
npm run build
npm run measure
npx playwright install chromium
npm run capture
```

`dist/` contains the runnable preview, manifest, lazy analytical chunks, and `bundle-sizes.json`. The measurement retains component exports and includes transitive Easy UI primitives; React, global styles, tokens, fonts, and application data are excluded. Sizes are decimal bytes with gzip per emitted asset, not a device performance benchmark.

`screenshots/` contains all four galleries at desktop, mobile, and PR widths, Sankey details, a table example, and `validation.json`. Browser checks cover the analytical recipes, pointer selection, keyboard zoom and row selection, overflow, runtime errors, and the lightweight page making zero requests for analytical dynamic entries identified by the build manifest. The Chart examples workflow publishes both directories as an artifact.

The preview complements monorepo CI and the Storybook build. Keep generated captures and measurements in the workflow artifacts; link the current run from the PR. [Example documentation](../../documentation/examples/README.md) links the maintained galleries and historical review archive.

## Additive galleries

`NativeExtensions` adds CompactTimeSeries comparisons/steps, RangePlot benchmarks/percentiles, shared-scale small multiples, and marker variants. `AnalyticalExtensions` adds nine analytical task examples. Both original galleries stay visible. The lightweight-only URL includes all six native components and still makes zero analytical chunk requests.

The screenshot artifact adds `native-extensions-{desktop,mobile,review}.png` and `analytical-extensions-{desktop,mobile,review}.png`. Browser capture checks SVG and canvas renderers, the compact chart's keyboard data disclosure, and both original and additional galleries. Record the source revision with each browser artifact.

## Modular ECharts comparison

`npm run measure:modular` builds the complete gallery with full and modular ECharts in separate output folders. `npm run capture:modular` checks both and compares their rendered PNGs, including desktop/mobile SVG, Canvas, and Sankey emphasis. See [the experiment notes](./modular/README.md) for registrations, measurement boundaries, and the opt-in API needed before production adoption.

## Native acceptance fixture

`mobile-charts.html` exercises the application's grouped transit-tier pattern in one card. Its HTML legend wraps below the plot with 44px keyboard/touch controls. The browser audit checks 320/390px containers, larger typography, exact tier labels, SVG/canvas selection, retained state across themes, and the folded table. `?native=1` retains the native engine layout for comparison; `?large=1` starts with larger text.

`chart-data-view.html` exercises rich content inside the chart's existing folded data disclosure. Expand “View data table” for currency formatting, shipment counts, and comparison badges from the same observations as the plot. Custom cells mount on first opening and remain mounted across collapse. Column widths, numeric alignment, large text, and keyboard scrolling are included in the shared browser audit.

`native-regressions.html` exercises all six native components with synthetic edge cases. The shared [browser audit](./audit/README.md) measures circular Sparkline markers at 80, 160, and 480 CSS pixels, singleton time labels, and explicit elapsed-time positions. It also checks abbreviated axes against full exact values, distinct missing/invalid/zero/overflow states, shared BarList scales, unframed metric composition, and every supported typography role at larger sizes. The native fixture imports no chart engine.

Each Chrome, Firefox, and Safari audit records the measured geometry and text sizes in `audit.json`, plus `native-markers.png`, `native-data.png`, and `native-typography.png`. These checks are part of both the full and modular builds.

## Score composition review

`score-composition.html` uses the same synthetic example as `Components/ScoreComposition` in Storybook. It includes container-width, larger-text, dark-theme, RTL, and data-refresh controls plus independent primitives. The shared browser audit verifies decorative connector endpoints against the actual DOM, keyboard disclosures, independently collapsed columns, hidden-tab-stop exclusion, retained details through collapse and refreshed records, narrow layouts, long text, touch targets, and accessibility. The optional `?rich=1` fixture unfolds a signal trend and contribution response curve using the existing Chart companions. It verifies the rendered current point against supplied coordinates and curve geometry, shaded threshold extents, exact-data access, chart lifecycle through node/column collapse, and dark/mobile/large-text layouts. It runs through the existing Chrome, Firefox, and native Safari workflow transports.
