# Data visualization proposal

Status: combined implementation for review. Original source audit: September 12, 2026, at commit `6a3a4c95dde6408cb38b4b2ae30d3904040757e8` (`@easypost/easy-ui` version `1.0.0-alpha.133`). This is a contribution proposal, not an approved roadmap.

## Combined review and component boundaries

As of September 20, 2026, [Lane J draft PR #1](https://github.com/lanej/easy-ui/pull/1) contains charts, sparklines and native plots, the modular ECharts assessment, NetworkMap, View Rule guide examples, and grouped/collapsible DataGrid. The working branch is `feat/metric-card-sparkline` in `lanej/easy-ui`. Continue improvements in this existing PR. The Recharts comparison is retired; the modular ECharts work is retained. The measurements and captures elsewhere in this document retain their recorded source provenance.

The implementation separates engine rendering and interaction, optional presentation and controls, and domain compositions such as parcel journeys or weather exposure. ECharts and MapLibre retain separate adapters and lazy loading boundaries. Native plots remain independent of both engines.

| Composition        | Public components and ownership                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Analytical chart   | `Chart` provides the complete frame. `ChartSurface` renders without a card, heading, controls, or table. `ChartProvider` connects one surface to separately placed `ChartZoomControls`; `ChartHeading` and `ChartDataView` can sit in application-owned layouts.          |
| Geographic map     | `NetworkMap` composes `NetworkMapProvider`, `NetworkMapSurface`, `NetworkMapHeading`, `NetworkMapControlPanel`, `NetworkMapLegend`, `NetworkMapSelectionDetails`, and `NetworkMapDataView`. The surface can stand alone and requires no facility or segment placeholders. |
| Compact indicators | `MetricCard` composes reusable `MetricContent` and `MetricComparisonContent`. Sparkline, CompactTimeSeries, RangePlot, BarList, and BulletChart retain their distinct scale and data contracts.                                                                           |

Visible titles and descriptions are independently optional on Chart and NetworkMap. Standard `aria-label`, `aria-labelledby`, and `aria-describedby` props identify the surface and associate an external heading, description, or equivalent data view. Chart keeps these associations during application loading/error states and engine loading, failure, and recovery. Removing visible framing does not remove provider attribution or appropriate status feedback.

Layer presence, visibility, and control placement are separate decisions. Latest-event actions, risk, weather, and delivery-time layers do not impose controls or placeholder records on unrelated maps. Selection details use normal document flow, and map labels use measured dimensions and reserve space for map controls. A weather-only or delivery-surface-only composition can provide its own controls, legend, and equivalent data view. Additional domain layers remain application choices; no housing-density model is built into the map core.

The shared `typography` prop defines CSS-pixel `title`, `description`, `label`, `control`, `legend`, and `detail` roles, defaulting to 18/14/12/14/12/12. Relevant roles reach HTML, SVG, canvas, and map labels; explicit native engine text options take precedence. Font and size changes update engine layout and measured geometry. The declared View Rule thresholds remain a review contract, not an accessibility certification.

The [implementation acceptance checklist](VisualizationAcceptance.md) records the behavior cases, component boundaries, and required evidence. The [combined PR](https://github.com/lanej/easy-ui/pull/1) links source revisions, current verification runs, and rendered artifacts. Historical measurements and captures in this document do not establish acceptance of subsequent changes.

### Map controls and layer state

`NetworkMap.controls` configures individual camera actions, layer switches, navigation, and scale, or accepts `false` to omit them all. Camera and layer controls appear only when their required data or selection is usable; an explicit `true` does not create an inapplicable control. Applicable controls remain disabled while the engine loads. An empty toolbar has no wrapper or reserved space. Provider attribution is retained.

`layerVisibility`, `defaultLayerVisibility`, and `onLayerVisibilityChange` separate application-owned state from the toolbar. Each layer can be controlled independently; hiding its switch does not hide its data. Existing visibility defaults remain risk on, weather and delivery surface off. `controlLabels` supplies application wording: the generic fit action is “Fit all locations,” while parcel examples explicitly request “Entire journey.” The legacy grouped and initial-visibility props remain compatibility fallbacks.

Review the carrier example at a narrow width: it should have fit, risk, and weather controls, with no selected-leg, latest-event, or delivery-surface placeholders. The shipper example adds its available delivery-surface switch. Focused state/applicability tests and the three-browser map harness cover these behaviors; browser checks also exercise keyboard selection, attribution, camera preservation, and narrow layouts. See the [NetworkMap API](../../easy-ui-react/src/NetworkMap/NetworkMap.mdx) for precedence and usage.

### Correctness and configuration

The implementation includes the following behavior contracts. The [acceptance checklist](VisualizationAcceptance.md) maps the itemized review findings to regression coverage and current verification status.

| Area                            | Implemented behavior                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map values and evidence         | Missing or invalid delivery estimates and cells without positive observation counts remain unfilled; true zero remains blue. `NetworkMapDataView` exposes exact surface/weather records, missing values, counts, IQR, source, timestamps, and geometry independently of facilities, layer visibility, and WebGL availability. Relative fill opacity describes observation counts, not statistical confidence.                                  |
| Map updates and selection       | Consumer paint survives data, selection, and visibility changes. A separate selected-route halo preserves evidence styles and supplied colors. Marker capability updates when handlers change. Unchanged sources are not resent during interaction updates, and marker lookup uses an index.                                                                                                                                                   |
| Geographic geometry             | Antimeridian routes split at ±180°, including equivalent boundary vertices; camera bounds and marker labels use wrapped geography.                                                                                                                                                                                                                                                                                                             |
| Chart interactions              | Theme changes preserve supported zoom and legend state, including active media overrides. Keyboard zoom targets an explicit ID/group or the first effective zoom component without resetting independent ranges. `zoomState`, `legendState`, `onZoomChange`, and `onLegendChange` coordinate charts; controlled values take precedence and prop updates do not create callback loops. Engine initialization failures expose an in-place retry. |
| Native precision and geometry   | Responsive Sparkline markers retain circular screen-space dimensions. Singleton time labels align with their observations. `formatAxisTime` and `formatAxisValue` abbreviate axes independently of exact-value and accessible formatting.                                                                                                                                                                                                      |
| Native scales                   | RangePlot, BulletChart, and BarList distinguish missing, invalid, and outside-domain observations. `overflow="omit"` retains exact finite values while omitting their marks; `overflow="clamp"` adds an explicit boundary treatment. BarList's optional `max` establishes a shared scale without silently expanding it.                                                                                                                        |
| DataGrid state and focus        | Controlled `expandedKey` accepts `null`; toggling reports the next key or null. Loading suspends expanded details and measurements without discarding expansion state. Removing focused details through group collapse returns focus to that group's disclosure. Stable subtotal content survives consumer-key collisions, and `grouping.getGroupLabel` separates identity from spoken labels.                                                 |
| Guide and rendering composition | `Disclosure`, `Disclosure.Trigger`, and `Disclosure.Content` provide scoped controlled/uncontrolled state and explicit mount policies. Network guide navigation uses `TabPanels`. Collapsed DataGrid groups retain their selection keys without invoking hidden data-cell renderers.                                                                                                                                                           |

Applications retain ownership of domain definitions, datasets, statistical calculations, and persisted interaction state. Performance checks cover representative source-upload and cell-rendering cases; they are not a general runtime-performance guarantee. Existing composed entry points and recipes remain available alongside the smaller public pieces.

## Problem and evidence

At the September 12 audited baseline, Easy UI provided the structure for analytical applications but no reusable visualization layer. That source tree and its package dependencies contained no line, area, bar, scatter, sparkline, or heatmap implementation. `BarChart` and `PieChart` in the icons package are icons. Existing `Card`, `SectionCard`, `DataGrid`, `DateRangePicker`, and selection controls supply much of the surrounding interface.

The [public repository](https://github.com/EasyPost/easy-ui) describes Easy UI as MIT licensed. This finding concerns the public design system. It does not establish which chart engines individual EasyPost applications use, or whether internal components already exist elsewhere. Before adopting an engine, inventory those applications and reuse a proven implementation where practical.

Public product references establish concrete demand:

| Reference inspected                                                                                                                                                                                                   | Visible pattern                                                                                   | Implication for Easy UI                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Analytics support screenshot](https://support.easypost.com/hc/article_attachments/30797776550797), linked from [EasyPost Analytics](https://support.easypost.com/hc/en-us/articles/4407880833037-EasyPost-Analytics) | Four KPI tiles; line charts; carrier split; service table; shared filters                         | Standardize metric cards, time series, categorical comparison, and consistent chart controls |
| [Delivery Performance screenshot](https://support.easypost.com/hc/article_attachments/34063416880013), linked from [Luma Insights](https://support.easypost.com/hc/en-us/articles/33478774806413-Luma-Insights)       | KPI strip, carrier comparison bars, transit distribution, time series with dashed benchmark lines | Support distributions as binned bars and benchmarks as reference series                      |
| [Spend Analytics screenshot](https://support.easypost.com/hc/article_attachments/34063432064781), linked from the same Luma article                                                                                   | Cost KPI strip; comparisons by carrier and service; weight/zone breakdowns; benchmark time series | Reuse the same chart families across financial and operational questions                     |
| [2024 Analytics announcement](https://www.easypost.com/blog/2024-10-01-reveal-cost-saving-strategies-with-in-depth-shipping-data-through-the-easypost-dashboard/)                                                     | Product marketing ties spend, volume, cost, and transit metrics to shipping decisions             | Preserve these familiar metric names and composition patterns                                |

The recurring visual language is restrained: white cards, blue/navy marks, light gridlines, compact headings, filter rows, and exact tables underneath. Use Easy UI's current tokens rather than copying screenshot hex values or embedded BI chrome. Screenshots are evidence of product needs, not evidence of reusable components. All new example values are synthetic.

## Analytical scope in this PR

The contribution includes `Chart` and its composable surface backed by Apache ECharts 6.1.0, plus complementary `MetricCard`, `Sparkline`, `CompactTimeSeries`, `RangePlot`, `BarList`, and `BulletChart` components. KPI summaries alone do not address the analytical requirement.

| Implemented example                                             | Shipping question                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Sankey with responsive layout and adjacency highlighting        | How do parcels flow from origins through carriers to delivery outcomes?       |
| Time series with elapsed-time axis, gaps, target line, and zoom | How does on-time performance change over time?                                |
| Stacked area                                                    | How does daily volume grow and split across carriers?                         |
| Grouped bars                                                    | How do rated costs compare with a benchmark by service?                       |
| Normalized stacked bars                                         | How do transit distributions differ across carriers?                          |
| Scatter/bubble                                                  | Which services balance cost and speed, and how much volume do they represent? |
| Matrix heatmap with exact sample counts in the table            | Where does performance vary across zone and weight?                           |
| Donut                                                           | What is the composition of exception reasons?                                 |
| Treemap                                                         | How does volume split across origins and their services?                      |

All fixtures are synthetic. Plots and their exact-value tables share source records. Sankey inflows and outflows balance at each carrier. Bubble area encodes count. The line example preserves gaps and true timestamp spacing. The heatmap leaves unavailable cells blank and includes their null values in the table.

## Lightweight portfolio

Compact indicators also deserve a complete set of examples. These components import no analytical engine:

| Component         | Use                                                                              |
| ----------------- | -------------------------------------------------------------------------------- |
| MetricCard        | Exact KPI, period, comparison baseline, and optional trend                       |
| Sparkline         | Equal-bucket trends in cards or report rows, including flat zeros and gaps       |
| BarList           | Category comparisons with a common zero baseline and visible exact values        |
| BulletChart       | One measure against a target on an explicit zero-based scale                     |
| CompactTimeSeries | Timestamped observations with shared domains, references, and exact data         |
| RangePlot         | Named observations and an optional supplied interval on an explicit signed scale |

The PR preview leads with the lightweight gallery and retains all 24 analytical recipes, including the original nine examples below it. `?portfolio=lightweight` exercises a page without analytical imports or engine requests. Applications should choose the smallest component that answers the question; `Chart` remains available for richer axes, layouts, interactions, and signed data.

The recorded baseline Vite measurement (`scripts/preview-metrics/measure-bundles.mjs`) retains all exported components, includes their transitive Easy UI primitives, and excludes React, global styles, token definitions, fonts, and application fixtures. The original MetricCard/Sparkline pair measured **13.8 KB gzip JavaScript / 2.5 KB gzip component CSS**; all four lightweight components measured **14.5 KB / 2.8 KB**. The expansion adds approximately **0.7 KB JavaScript / 0.35 KB CSS gzip** in this measurement. Actual consumer output depends on shared imports and bundler settings.

## Integration choice and tradeoffs

Use one maintained analytical engine rather than implementing axes, layouts, tooltips, and Sankey geometry within Easy UI. Apache ECharts supports the standard and specialist families in the requested scope. The adapter deliberately exposes its typed `EChartsOption` API; applications can compose series and use the engine's other built-in charts without waiting for another Easy UI wrapper. Easy UI owns the surrounding presentation, lifecycle, and data access. Applications own data queries, aggregation, definitions, scales, coverage, formatting, and persisted filter state.

ECharts is an optional peer (`^6.1.0`) and a pinned development dependency. The package marks it external and dynamically imports it when a ready chart mounts. This preserves ordinary Easy UI imports and CommonJS/ESM compatibility without requiring the engine for KPI cards. The recorded full-engine baseline measured about 1.14 MB minified / 382 KB gzip in the isolated Vite production preview. This is a conscious bundle-cost tradeoff for broad chart support; analytical routes should remain lazy-loaded. This transfer size is reasonable for a dedicated analytical screen, but does not measure parsing, layout, data transfer, or time to interaction on a user device. Those should be profiled with representative application data before setting a performance budget.

The combined PR retains an assessment of ECharts' [modular imports](https://echarts.apache.org/handbook/en/basics/import/), including an explicit eight-series application preset and separate full/modular preview builds. The public Chart entry continues to use the complete lazy engine so its native option types represent available capabilities. The private modular preset is not a silent replacement for that contract and does not add a second analytical engine. [SVG/canvas guidance](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/) informs the SVG default and optional canvas renderer.

## Shared presentation and interaction

- Independently optional visible headings, application actions and coverage notices, responsive width, and configurable height. Applications can use the complete components or separately place the surface and companions.
- Role-based typography and resolved theme colors, including components introduced by Chart media and timeline options. Explicit native text styles and palettes retain precedence. Automatic engine palettes are positional, so applications should assign colors by stable series ID when filtering or sorting.
- Loading, successful-empty, application-error/retry, and partial-data presentation. The composed Chart suppresses its plot and table for non-ready application states. Engine failures call `onRenderError`, retain exact data, and offer an actual engine retry; application `onRetry` remains responsible for application data errors.
- Hover/touch tooltips, graphical legend controls, Sankey flow highlighting, and pointer selection from ECharts. Series/datum information reaches `onSelect`; controlled zoom and legend callbacks support coordinated reports.
- Exact-value HTML data views, stable row IDs, and keyboard drill-down through `onRowSelect`. Keyboard zoom operates on effective engine options, including `baseOption`, and respects the requested component/group scope. Applications composing a bare surface supply and associate their equivalent data and keyboard interactions.
- Reduced-motion handling, parent and font resize updates, engine disposal, and cancellation when a surface unmounts during an import. Theme changes retain the chart instance; renderer changes preserve supported local interaction state when a new instance is required.

Native graphical legends and individual marks are not keyboard-focusable. Reports needing keyboard filtering should provide application controls connected to `legendState` and `onLegendChange`; the equivalent data view provides exact values and drill-down. This is an explicit accessibility boundary, not a claim that an engine ARIA switch alone establishes compliance. See [ECharts accessibility guidance](https://echarts.apache.org/handbook/en/best-practices/aria/).

## Validation and contribution

Require the repository build, lint, tests, and Storybook gates. Additional checks exercise CommonJS/ESM imports and server rendering, engine lifecycle and failures, state suppression, keyboard controls, reduced motion, theme changes, real SVG rendering for each example, and flow conservation. Required browser acceptance covers desktop and mobile layouts, actual pointer selection, keyboard selection and zoom, external companions, larger text, and absence of horizontal overflow or browser errors. See [VisualizationAcceptance.md](VisualizationAcceptance.md) for coverage and the [combined PR](https://github.com/lanej/easy-ui/pull/1) for the source revision and execution results. Incomplete automated accessibility checks must remain visible in the evidence.

The Chart examples workflow publishes the runnable gallery and screenshots. Refresh the PR's embedded examples after component or fixture changes. `scripts/preview-metrics/README.md` documents regeneration; `easy-ui-react/src/Chart/Chart.mdx` documents the consumer API.

## Additive expansion

The existing galleries remain available. Sparklines default to endpoint markers so the boundaries of missing-data gaps are visible; applications can opt out with `markers="none"`. New `CompactTimeSeries` and `RangePlot` native components close the gap between a summary sparkline and a full analytical chart. CompactTimeSeries supports one to three timestamped series, explicit shared domains, sparse axes, line/step interpolation, a labeled reference, markers, and exact accessible observations. RangePlot aligns named benchmarks and an optional supplied interval, including negative domains and equal-bound intervals.

Sparkline adds opt-in observation, segment-endpoint, and global-extrema markers. Nine additional Chart examples demonstrate direct bar labels; target/threshold/event annotations; numeric scenario response; a histogram and cumulative distribution sharing source counts; descriptive box summaries; an explicitly supplied prediction interval; a reconciled contribution waterfall; and weekday/hour rates with counts and insufficient-sample blanks. These fixtures are public and synthetic.

The native examples include report cells and small multiples with shared date and value scales. Reference lines, allowed intervals, percentile ranges, and prediction intervals keep separate labels and meanings. Applications own statistical calculation and coverage; examples do not imply business outcomes or causal effects.

At the recorded expanded baseline, the six-component native portfolio measured approximately **16.9 KB gzip JavaScript / 3.5 KB component CSS**, including transitive Easy UI primitives and excluding React/global styles/fonts. Relative to the previous four-component baseline (14.5 KB / 2.8 KB), the two new components plus marker support add approximately **2.4 KB JS / 0.6 KB CSS gzip**. At that baseline, the optional ECharts engine chunk remained about **382 KB gzip**. These figures are retained as historical measurements; use source-pinned workflow artifacts for measurements of the current implementation.

The combined implementation includes geography through NetworkMap and controlled cross-chart zoom/legend coordination. Applications can compose the public surfaces, controls, exact data views, and metric content in their own layouts. Domain datasets, geographic sources, statistical models, and application-specific engine interactions remain consumer responsibilities.

## Logistics intelligence and parcel tracking recipes

Six additional analytical recipes extend the portfolio to 24: fixed-cohort delivery reliability, matched rate competitiveness, price/volume/contribution scenarios, capacity planning, one-parcel event intervals, and multi-warehouse parcel progress. Native BulletChart stories also show observed capacity and forecast overload. These are additive compositions of the existing components, with synthetic records and exact tables.

NetworkMap is part of the same combined Lane J PR and covers geographic navigation, parcel/network flow, facility risk, weather, delivery surfaces, and audience-specific compositions. The six non-geographic logistics recipes and the existing eight-series modular assessment remain available independently of the map engine.

The [logistics Storybook documentation](../../easy-ui-react/src/Chart/Chart.logistics.mdx) defines cohort denominators, sample suppression, forecast boundaries, scan freshness, fee/cost assumptions, shared timestamps. Unknown positions and missing scan intervals must never become interpolated observed locations or implied delivery events.
