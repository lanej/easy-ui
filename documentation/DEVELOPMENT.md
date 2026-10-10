# Visualization and reporting development

These additions make compact metrics, charts, maps, and grouped reports reusable in practical applications. The goal is to support application layouts and controls while retaining Easy UI's existing conventions and predictable package entry points.

## Current workstream

[Lane J PR #1](https://github.com/lanej/easy-ui/pull/1) contains the cumulative contribution. Continue fixes on its existing `feat/metric-card-sparkline` branch. The Recharts comparison is a retired experiment; earlier chart, map, guide, and grid reviews were consolidated into this PR. The fork's older combined `main` is not the review base.

Local worktree names are historical. Consult the workspace inventory before editing an adoption checkout. Port useful application feedback to the cumulative branch once, then validate a package built from that source. Keep application pins stable until their own compatibility checks pass.

ScoreComposition is an explicitly separate feature review on `feat/score-composition`, based on `feat/metric-card-sparkline`. Keep its changes in that child review and merge the parent first. Its [specification](specs/ScoreComposition.md) and [component documentation](../easy-ui-react/src/ScoreComposition/ScoreComposition.mdx) describe the native score-explanation API.

## Component boundaries

- **Assessment composition:** `HealthAssessment` is an organism coordinating the pill, observed value, freshness, optional percentile metrics, and responsive reference layout. `DurationDistribution` is a molecule owning the supplied duration reference graph. Compose that same molecule into the organism rather than duplicating rendering or health policy. Classification follows responsibility, including when optional content is hidden.

- **Rendering surfaces:** `ChartSurface` and `NetworkMapSurface` own engine rendering and lifecycle. Optional providers connect independently placed headings, controls, legends, selection details, and exact data. Do not require logistics placeholders or a title to render a map.
- **Small visual components:** use `Chart` for trends and reuse native components such as `RangePlot` and `BarList` when they express the data. The standalone SVG Sparkline API and MetricCard trend prop have been removed. ECharts is an optional lazy peer; MapLibre is a required package dependency that loads lazily when a map mounts. A map detail chart should not force a second rendering engine into every map.
- **Rich map inspectors:** `renderCellDetails` hosts arbitrary React content. Compose `NetworkMapCellDetails` with children to retain summary/provenance around a supplied chart. Keep chart recipes separate from map behavior; applications own histogram bins, density estimation and time-series data. Embedded controls pin the card while retaining focus, and the same renderer serves the keyboard-accessible table detail.
- **Application meaning:** callers own aggregation, units, forecasts, domains, and provenance. A median and IQR width do not establish quartile endpoints or a histogram. Draw distributions only from supplied distribution data; retain useful summaries when it is unavailable.
- **Configuration:** extend the existing coherent API before introducing overlapping switches. Map `controls` governs control presence; `layerVisibility` governs rendered layers. Hiding a control does not erase equivalent data. Use independently placed companions for application-specific layouts.
- **Chart data disclosures:** enrich the chart's existing folded data view through `dataTable.renderCell` and column options. Keep plot and table derived from the same records; preserve exact values and comparison baselines. Custom content mounts on first opening and remains mounted across collapse. Sorting is opt-in by column and uses original or supplied sort values; controlled requests do not change the plot. Sticky headings and measured leading-column pinning preserve context while reserving space for data on narrow screens.
- **Mobile chart layout:** ordinary unpositioned Cartesian charts use a wrapping HTML `ChartLegend` outside the plot. Keep explicit engine layouts intact; `layout="native"` opts out. Preserve shared legend state, keyboard/touch selection, and caller typography. Use the existing bare variant inside application cards; keep concise axis labels and full exact-data labels derived from the same records.
- **Mobile grids:** use existing column selection and `size="sm"` before inventing a second table model. Column `whiteSpace` keeps identifiers and units together; numeric body values default to no wrapping, with an explicit `"normal"` override. Rows and headers grow for rich content and larger text, and expanded details follow the measured body height. For dense comparisons, keep columns at readable minimum widths, allow headings to wrap, and retain the identifying column while scrolling within the table. The ten-column example defaults to the full report and fits on wide desktops. A focused metric and its supplied sample are an optional application view; explain comparison baselines once.
- **Vertical drawer rows:** `DrawerTable` composes `DrawerRow` molecules adapted from Logistics Services. Summary facts stay visible above full-width inline details, with unrelated actions outside the disclosure button. This is a list, not a native table or replacement for DataGrid's column and selection semantics. Its optional footer composes the shared Pagination molecule through `DrawerTable.Pagination` and `DrawerTable.RowsPerPage`. Applications own page rows, order, fetching, and URL state.
- **Date inputs:** reuse `DatePicker` or `DateRangePicker` for editable dates and calendar selection. Use `@internationalized/date` values, linked descriptions/errors, and `name` or `startName`/`endName` for form submission. Clearing is opt-in. Read-only values remain submittable; disabled values do not. Applications own submission and controlled values.
- **State and accessibility:** respect controlled values, preserve camera/selection through ordinary data updates, and support keyboard and touch paths alongside pointer interactions. Exact values and missing-data states must survive engine failures and hidden layers.

## Bring application feedback back to the component

1. Capture the failing input and observable outcome. Identify the package source and consuming application's resolution mode or engine version when relevant.
2. Check whether the active API already solves the issue; older hand-patched packages can be several iterations behind. Document migration instead of copying old props into the current design.
3. Add a focused regression case for consequential behavior. Reuse component-local setup, and keep generated screenshots/reports in validation artifacts rather than source.
4. Follow existing React Aria, Sass-token, TypeScript, Vite, and Vitest patterns. Avoid unrelated upstream refactors or a parallel design system.
5. Update component API documentation and a realistic synthetic example. PR descriptions should explain the final behavior, review paths, and material limits.

## Verification

Run focused tests while developing, then the relevant package tests, lint, and build before publication. Interactive map changes also need the existing real-browser map harness, including narrow layouts and large text. See [map verification](../scripts/preview-maps/README.md) and the [example index](examples/README.md).

Package adoption must use an actual `npm pack` artifact. `scripts/check-style-package.mjs` verifies both packed layouts, legacy Node and modern bundler TypeScript resolution, component/declaration subpaths, CSS, and Sass. Preserve generated root compatibility entries and `dist/styles` assets. Record real consumer checks separately from isolated-package checks, with source SHA and remaining gaps.

For drawer-row changes, run the focused `DrawerTable` and `Disclosure` tests.
With Storybook running and the locked `scripts/preview-metrics` browser dependencies
installed, run `STORYBOOK_URL=http://localhost:9013 node scripts/check-drawer-rows.mjs`.
Set `BROWSER_CHANNEL=chrome` to use installed Chrome, or install Playwright's
Chromium. `DRAWER_REPORT_DIR` selects the screenshot/report directory. The harness
covers Light/Dark, narrow layouts, enlarged text, full-width panels, keyboard
expansion, independent actions, lazy detail mounting, controlled page navigation,
rows-per-page changes, and component accessibility.

The [acceptance matrix](specs/VisualizationAcceptance.md) is the shared review contract. Earlier successful checks establish their recorded snapshot; new application feedback remains part of ongoing development.

For date-picker changes, run the focused `DatePicker`, `DateRangePicker`, `Calendar`,
and `RangeCalendar` tests. With Storybook running and the same locked browser
dependencies installed, run:

```sh
BROWSER_CHANNEL=chrome STORYBOOK_URL=http://localhost:9013 node scripts/check-date-pickers.mjs
```

`DATE_REPORT_DIR` selects its output directory. The harness checks single/range
forms, native required validation, independent clearing, keyboard focus, calendar
selection, read-only controls, French localization, accessibility, Light/Dark,
narrow layouts, and enlarged text.

### Browser CI

Charts, maps, screenshots, and layout reviews reuse recent successful browser evidence when their built preview and test inputs are identical. Each suite hashes actual production assets, its harness and dependency lockfile, workflow, applicable layout rules, and Node/runner image. Changes to a shared component, Sass, tokens, or fonts that affect a preview invalidate its evidence automatically. A component absent from that preview does not trigger its browser checks. This avoids the cumulative-PR path-filter problem without relying on only the latest commit's diff.

Evidence must come from a successful run of the same workflow and PR/ref, and expires after seven days. Failed, cancelled, missing, or inaccessible evidence causes fresh checks. Manual workflow dispatch and reruns always execute the checks. A reused job summary links to the original run; it does not present that run's screenshots as new captures. Preview builds, bundle assertions, and ordinary package checks continue to run. Browser installation, interaction/accessibility audits, screenshot comparisons, and View Rule execution can then be skipped independently for unchanged suites.

Every documentation deployment checks its new source revision and published inspector/worker assets over HTTP. Its expensive hosted map audit is reused only when the deployed map build and test inputs match. Keep these deployment checks even when reusing browser results. Run `node --test scripts/browser-proof.test.mjs` when changing the shared evidence helper or workflow conditions.

### Duration reference verification

Run focused `DurationDistribution` and `HealthAssessment` tests. With Storybook running and the locked `scripts/preview-metrics` Playwright dependencies installed, run:

```sh
BROWSER_CHANNEL=chrome STORYBOOK_URL=http://localhost:9013 node scripts/check-duration-distribution.mjs
```

`DURATION_REPORT_DIR` selects its screenshots and report. The harness covers supplied CDF/bin overlays, quantiles without invented geometry, missing/invalid/outside states, optional exact-data keyboard disclosure, standalone and composed references, narrow layouts, enlarged text, forced colors, both themes, and the existing assessment option alignment. Browser executable/module overrides support managed test environments. Run `node scripts/check-style-package.mjs` after building to verify packed package exports and TypeScript consumers.

### Linked investigation verification

`InvestigationWorkspace` owns the controlled event/location/path/connection selection and composes the existing timeline and map. Applications supply candidate membership and detail content; preserve ambiguous histories and unlocated events when coordinating the views.

Run its focused tests and `NetworkMap` tests, then build Storybook and run `STORYBOOK_URL=http://localhost:9019 node scripts/check-investigation-workspace.mjs` using the locked `scripts/preview-metrics` Playwright dependencies. `INVESTIGATION_REPORT_DIR` selects its screenshots and report. The harness checks actual map clicks, keyboard selection, location stepping, shared connections, external selection, immutable refreshes, camera retention, related-event filtering, mobile keyboard tabs, disclosure state, initial framing after revealing a hidden map, responsive layouts, large text, and light/dark accessibility. The investigation workflow retains this browser evidence. Examples use a local schematic basemap with synthetic observations.
