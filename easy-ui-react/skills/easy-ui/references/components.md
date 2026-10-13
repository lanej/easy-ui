# Component reference

Choose a component by responsibility, then read its installed declarations and
the matching revision's Storybook API and examples for exact props. This index
describes the components shipped alongside this skill; installed types are the
authority when working with another package version.

Import each named entry from `@easypost/easy-ui/<Name>`:

```tsx
import { Button } from "@easypost/easy-ui/Button";
import { DataGrid } from "@easypost/easy-ui/DataGrid";
import { LineChart } from "@easypost/easy-ui/LineChart";
```

The installed package's `<Name>/index.d.ts` forwards to its public declarations.
In a source checkout, read `easy-ui-react/src/<Name>/index.ts` and the adjacent
`<Name>.mdx` and stories. Read compound-component APIs before assembling children;
do not assume every child has an independent import subpath.

## Application components

| Responsibility                      | Public entries                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme and design-token layout       | `Provider`, `Theme`, `Box`, `HorizontalGrid`, `HorizontalStack`, `VerticalStack`, `FormLayout`                                                                                    |
| Text, symbols, and formatted values | `Text`, `Icon`, `SignedValue`, `DurationValue`, `CodeSnippet`, `CodeBlock`                                                                                                        |
| Actions and action menus            | `Button`, `UnstyledButton`, `IconButton`, `DropdownButton`, `KebabButton`, `Menu`                                                                                                 |
| Text and selection inputs           | `InputField`, `TextField`, `Textarea`, `Select`, `MultiSelect`, `Checkbox`, `RadioGroup`, `RadioButtonGroup`, `Toggle`, `ColorPicker`, `PriceRangeSlider`, `SelectorErrorTooltip` |
| Date inputs and calendars           | `DatePicker`, `DateRangePicker`, `Calendar`, `RangeCalendar`                                                                                                                      |
| Navigation and pagination           | `Tabs`, `TabNav`, `TabPanels`, `VerticalNav`, `SearchNav`, `Stepper`, `Pagination`                                                                                                |
| Page structures                     | `ProductLayout`, `FocusedProductLayout`, `CustomerPortalLayout`, `ForgeLayout`, `NexusLayout`, `MultipageSection`, `WorkspaceHeader`                                              |
| Cards and selection shells          | `Card`, `SectionCard`, `PlanCard`, `EmptyStateCard`, `CardListItem`, `CheckableCard`, `ToggleCard`, `SplitToggleCard`                                                             |
| Disclosure and overlays             | `Disclosure`, `Drawer`, `Modal`, `Popover`, `Tooltip`                                                                                                                             |
| Feedback and status labels          | `Banner`, `Notification`, `Spinner`, `Badge`, `AlertBadge`, `Pill`, `PillGroup`, `StatusDot`                                                                                      |
| Exact metrics and tabular data      | `MetricCard`, `KpiTile`, `DataGrid`, `DrawerTable`                                                                                                                                |
| Supplied health observations        | `HealthIndicator`, `HealthAssessment`, `ObservationFreshness`, `DurationDistribution`, `RiskScore`, `FacilitySummary`, `EventMetrics`                                             |
| Event and path investigations       | `EventDetails`, `EventTimeline`, `InvestigationWorkspace`, `PathComparison`                                                                                                       |
| Score explanations                  | `ScoreComposition`                                                                                                                                                                |

Use `DataGrid` for table semantics, columns, selection, and sorting. Use
`DrawerTable` for a list of summary rows with independently rendered inline
details; `DrawerRow` is exported from the same `DrawerTable` entry.

Use `MetricCard` for exact values and comparisons. Compose a chart alongside it
when a trend is needed. Applications supply health assessments, freshness,
thresholds, units, scores, and event relationships; these components display
those facts without deciding their meaning.

## Analytical charts

All entries below share Chart's frame, theme, status, selection, and optional
exact-data disclosure. Install the optional `echarts` peer when using them.
Native-series components accept `series` without an engine `type`, and `option`
for native configuration. Applications own aggregation and statistical inputs.

Use `showDataTable={false}` on any analytical chart to hide exact-data disclosure.
Interval, prediction-band, and waterfall charts generate rows when `dataTable`
is omitted. Use `option.color` for automatic categorical palettes; prediction
shading follows the predicted line unless `bandItemStyle` overrides it, and
waterfall increase, decrease, and total series use palette slots 0, 1, and 2.
For HeatmapChart, supply the quantitative ramp through `visualMap.inRange.color`.

| Public entry                  | Choose it for                            | Supplied input                                                                 |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `LineChart`                   | Trends and numeric response curves       | Line series; null observations retain gaps                                     |
| `AreaChart`                   | Filled trends and additive stacks        | Line series with optional explicit stacks                                      |
| `BarChart`                    | Category comparisons                     | Bar series, either axis orientation                                            |
| `StackedBarChart`             | Additive parts of category totals        | Bar series; normalize percentages in the application                           |
| `ScatterChart`                | Paired numeric observations              | Scatter series                                                                 |
| `BubbleChart`                 | Paired observations with magnitude       | Scatter series with an explicit `symbolSize` mapping                           |
| `SankeyChart`                 | Directed weighted flows                  | Nodes and links in Sankey series                                               |
| `HeatmapChart`                | Matrices and periodic comparisons        | Heatmap series plus required coordinate-system and color-scale `option`        |
| `DonutChart`                  | Parts of a stated whole                  | Pie series with overridable inner/outer radii                                  |
| `TreemapChart`                | Hierarchical magnitudes                  | Hierarchical treemap series                                                    |
| `GraphChart`                  | Abstract node-link relationships         | Graph nodes, links, and layout settings                                        |
| `BoxPlotChart`                | Five-number summaries                    | Min, P25, median, P75, max values                                              |
| `HistogramChart`              | Counts in equal-width buckets            | Already-binned bar series                                                      |
| `CumulativeDistributionChart` | Cumulative observations                  | Supplied cumulative line points                                                |
| `IntervalChart`               | Start/end spans on named lanes           | `intervals` records with `id`, `row`, `label`, `start`, and `end`              |
| `PredictionBandChart`         | Observations and predictions with bounds | `points` records with `id`, `x`, `observed`, `predicted`, `lower`, and `upper` |
| `WaterfallChart`              | Signed changes and running balances      | `steps` records with `id`, `label`, and `change`; optional initial balance     |

Use generic `Chart` for mixed series or custom engine compositions. For
independently placed elements, import `ChartSurface`, `ChartProvider`,
`ChartHeading`, `ChartLegend`, `ChartZoomControls`, and `ChartDataView` from
`@easypost/easy-ui/Chart`.

Category/value axes are the native Cartesian defaults except scatter and bubble,
which use two value axes. Set value/time axes explicitly when spacing carries
numeric meaning. Consult Storybook's **Choosing a chart** page and each chart's
examples for configuration and missing-data behavior.

## Compact plots and geographical views

| Public entry           | Choose it for                                                                    |
| ---------------------- | -------------------------------------------------------------------------------- |
| `MeterBar`             | Visual-only bounded track/fill atom; its owner supplies labels, states, and accessible meter semantics |
| `ProportionBar`        | Accessible part-to-whole molecule with percentage, numerator/denominator, label, and explicit data states |
| `BarList`              | Compact category comparisons with HTML/CSS                                       |
| `BulletChart`          | A supplied measure and target on an explicit zero-based scale                    |
| `CompactTimeSeries`    | A compact native SVG trend and optional reference                                |
| `RangePlot`            | Named points and an optional interval on a shared scale                          |
| `DurationDistribution` | Elapsed duration against supplied bins, density, cumulative points, or quantiles |
| `NetworkMap`           | Geographical layers and inspection using MapLibre                                |

For proportions, import from `@easypost/easy-ui/ProportionBar`; for a custom metric's visual fill, import from `@easypost/easy-ui/MeterBar`. Read the installed `ProportionBar/index.d.ts` or `MeterBar/index.d.ts` declarations. In a source checkout, their implementations, `<Name>.mdx` API documentation, and stories live in `easy-ui-react/src/<Name>/`. `RiskScore` and `ProportionBar` both compose `MeterBar`; do not nest accessible meters or turn a bounded score into a percentage.

For map composition, import `NetworkMapSurface`, `NetworkMapProvider`,
`NetworkMapHeading`, `NetworkMapControlPanel`, `NetworkMapLegend`,
`NetworkMapSelectionDetails`, `NetworkMapDataView`, `NetworkMapCellDetails`, and
`NetworkMapInspectionTrigger` from `@easypost/easy-ui/NetworkMap`.
Follow the package README for MapLibre stylesheet and worker setup. Use
`GraphChart` for abstract relationships without geographical coordinates.

## Dependency investigation

Import `DependencyGraph` and `DependencyGraphDetails` from
`@easypost/easy-ui/DependencyGraph`. Supply stable node/edge IDs; arrows run
from dependency to dependent. The organism owns directed layout, bounded
neighborhoods, group collapse, search, and linked selection. Applications own
relationship discovery, evidence, change kinds, and risk. Read its Storybook
examples and types before using the independently controlled view and selection.

Each DependencyGraph resource can supply `changeSummary` and typed `changes` for a summary or red/green field diff. Resource cards expand aligned Before/After columns for their attribute differences; use `expandedChangeNodeIds` to control expansion independently of selection. Use `DependencyGraphChanges` from the same subpath for an application-owned resource inspector. Supply explicit unknown/redacted values and compute the actual diff in the application.


### Disclosure atoms and dependency density

`ExpandButton` and `CollapseButton` provide reusable positive (+) and negative (−) disclosure controls. Supply `accessibilityLabel`, `aria-controls`, and `onPress`; control `expanded` to retain focus while changing the symbol. `DependencyGraph` uses these for inline attributes, groups, and dependent branches. `collapsedNodeIds`/`onCollapsedNodeIdsChange` fold branches independently of `collapsedGroupIds`. Shared resources remain visible through other open paths. Nodes accept the standard `IconSymbol` as `icon` and a caller-owned `iconLabel`. Zoom changes cards from overview (<70%) to summary (<100%) to detail; expanding attributes restores at least 100%.

Supply `edge.change` (`add`, `remove`, `unchanged`, or `unknown`) independently of resource operations. Include removed links in the supplied graph. Added/removed links keep separate routes even with collapsed groups, use green/red arrows plus +/− labels, and remain individually selectable in relationship details. Changes scope includes their endpoints.
