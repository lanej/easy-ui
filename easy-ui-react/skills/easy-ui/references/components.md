# Component reference

Choose a component by responsibility, then read its installed declarations and
the matching revision's Storybook API and examples for exact props. This index
describes the components shipped alongside this skill; installed types are the
authority when working with another package version.

Use documented public package subpaths:

```tsx
import { Button } from "@easypost/easy-ui/Button";
import { DataGrid } from "@easypost/easy-ui/DataGrid";
import { LineChart } from "@easypost/easy-ui/LineChart";
```

The installed package's `<Name>/index.d.ts` forwards to its public declarations.
In a source checkout, read `easy-ui-react/src/<Name>/index.ts` and the adjacent
`<Name>.mdx` and stories. Read compound-component APIs before assembling children;
do not assume every child has an independent import subpath.

Browse the [published Storybook](https://lanej.io/easy-ui/storybook/). Its adjacent
[`revision.txt`](https://lanej.io/easy-ui/revision.txt) identifies the source
revision; use the installed declarations when the application pins another version.

- [Application components](#application-components)
- [Metrics and comparisons](#metrics-and-comparisons)
- [Analytical charts](#analytical-charts)
- [Compact plots and geographical views](#compact-plots-and-geographical-views)
- [Event and path investigations](#event-and-path-investigations)
- [Dependency investigation](#dependency-investigation)

## Application components

| Responsibility                      | Public entries                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme and design-token layout       | `Provider`, `Theme`, `ThemeToggle`, `Box`, `HorizontalGrid`, `HorizontalStack`, `VerticalStack`, `FormLayout`                                                                     |
| Text, symbols, and formatted values | `Text`, `Icon`, `SignedValue`, `DurationValue`, `CodeSnippet`, `CodeBlock`                                                                                                        |
| Actions and action menus            | `Button`, `UnstyledButton`, `IconButton`, `DropdownButton`, `KebabButton`, `Menu`, `ExpandButton`, `CollapseButton`                                                               |
| Text and selection inputs           | `InputField`, `TextField`, `Textarea`, `Select`, `MultiSelect`, `Checkbox`, `RadioGroup`, `RadioButtonGroup`, `Toggle`, `ColorPicker`, `PriceRangeSlider`, `SelectorErrorTooltip` |
| Date inputs and calendars           | `DatePicker`, `DateRangePicker`, `Calendar`, `RangeCalendar`                                                                                                                      |
| Navigation and pagination           | `Tabs`, `TabNav`, `TabPanels`, `WorkspaceTabs`, `VerticalNav`, `SearchNav`, `Stepper`, `Pagination`                                                                                                |
| Page structures                     | `ProductLayout`, `FocusedProductLayout`, `CustomerPortalLayout`, `ForgeLayout`, `NexusLayout`, `MultipageSection`, `WorkspaceHeader`                                              |
| Cards and selection shells          | `Card`, `SectionCard`, `PlanCard`, `EmptyStateCard`, `CardListItem`, `CheckableCard`, `ToggleCard`, `SplitToggleCard`                                                             |
| Disclosure and overlays             | `Disclosure`, `Drawer`, `Modal`, `Popover`, `Tooltip`                                                                                                                             |
| Feedback and status labels          | `Banner`, `Notification`, `Spinner`, `Badge`, `AlertBadge`, `Pill`, `PillGroup`, `StatusDot`                                                                                      |
| Exact metrics and tabular data      | `MetricCard`, `DataGrid`, `DrawerTable`                                                                                                                                           |
| Supplied health observations        | `HealthIndicator`, `HealthAssessment`, `ObservationFreshness`, `DurationDistribution`, `RiskScore`, `FacilitySummary`, `EventMetrics`                                             |
| Event and path investigations       | `EventDetails`, `EventTimeline`, `InvestigationWorkspace`, `InvestigationDetails`, `PathComparison`                                                                               |
| Resource dependency investigation   | `DependencyGraph`                                                                                                                                                                 |
| Score explanations                  | `ScoreComposition`                                                                                                                                                                |

Use `DataGrid` for table semantics, columns, selection, and sorting. Use
`DrawerTable` for a list of summary rows with independently rendered inline
details; `DrawerRow` is exported from the same `DrawerTable` entry.

Use `Drawer.Trigger` or controlled `Drawer.Container` (`DrawerContainer` remains
available) with `placement="left" | "right"` and a CSS `width` (numbers are pixels).
Right placement and the 608px default are unchanged; caller widths are constrained
to the viewport. Give `Drawer` an `aria-label` or `aria-labelledby` without a
`Drawer.Title`. For `Drawer.Container`, render the child only while open and remove
it in `onDismiss`; the application owns routing. Preserve modal focus and dismissal
rather than implementing a parallel navigation overlay. See [controlled left navigation](https://lanej.io/easy-ui/storybook/?path=/story/components-drawer--left-navigation)
and [right navigation](https://lanej.io/easy-ui/storybook/?path=/story/components-drawer--right-navigation).

Use `WorkspaceHeader` for a page title, caller-composed `navigation`, and actions;
the surrounding page layout remains independent. See [page navigation](https://lanej.io/easy-ui/storybook/?path=/story/organisms-navigation-workspaceheader--with-navigation).

Use `WorkspaceTabs` for application-owned workspace views with `pinnedTabs`,
`openTabs`, controlled `selectedKey` / `onSelectionChange`, and separate `onClose`
actions. Tabs use manual keyboard activation. A focused tab or close control takes
reveal priority over external selection changes; outside the bar, the new selection
is revealed. Actual layout/tab-order changes use the same priority. Unrelated parent
updates preserve deliberate
scrolling while focus is outside the bar. Call `useWorkspaceTabIds` once per
workspace, pass its `ids` object to the bar, and use `ids.tabId(key)` /
`ids.panelId(key)` for external panels; never sanitize opaque keys yourself.
The hook supports React 16.14/17 as well as 18/19. For React 16/17 server rendering,
wrap both server and client application roots in one `SSRProvider` from
`react-aria`, using the same module format as Easy UI and one dependency version.
React 18+ needs no SSR wrapper. Separate hook instances isolate repeated keys;
see [independent workspaces](https://lanej.io/easy-ui/storybook/?path=/story/organisms-navigation-workspacetabs--isolated-workspaces).
`panelId` supports one shared panel instead. Applications choose the next
selection after removal. Pinned and disabled tabs cannot close; zero counts
remain accessible. Choose `variant="secondary"` for subordinate views and keep
`trailing` actions compact. In a CSS Grid host, use a shrinkable track such as
`minmax(0, 1fr)` so the bar and application-owned panels fit the available width.
See [workspace interactions](https://lanej.io/easy-ui/storybook/?path=/story/organisms-navigation-workspacetabs--default),
[narrow overflow](https://lanej.io/easy-ui/storybook/?path=/story/organisms-navigation-workspacetabs--narrow),
and [width transitions](https://lanej.io/easy-ui/storybook/?path=/story/organisms-navigation-workspacetabs--width-transition).

Control `ThemeToggle` with `mode` and `onModeChange`, and pass the same mode to
`ThemeProvider`'s `colorScheme`. The application owns system-preference resolution
and persistence. See [theme selection](https://lanej.io/easy-ui/storybook/?path=/docs/atoms-actions-themetoggle--docs)
and the rendered [design tokens](https://lanej.io/easy-ui/storybook/?path=/docs/foundations-design-tokens--docs).

Applications supply assessments, freshness, thresholds, units, and scores.
Use `HealthAssessment` to compose a supplied observation with its assessment and
optional `DurationDistribution` reference. Use `FacilitySummary` for facility
identity and independent observations; freshness and health remain separate.
See [assessment forms](https://lanej.io/easy-ui/storybook/?path=/story/organisms-feedback-healthassessment--presentation-forms)
and [facility summaries](https://lanej.io/easy-ui/storybook/?path=/docs/organisms-facilities-facilitysummary--docs).

## Metrics and comparisons

Import `MetricCard`, `MetricContent`, `MetricGroup`, and
`MetricComparisonContent` from `@easypost/easy-ui/MetricCard`. Use `MetricCard`
for standalone framing; use `MetricContent` inside a caller-owned section.
`KpiTile` has been removed. Compose a chart separately when a trend is needed.

Choose `layout="summary"` for a label above its reading, or `layout="row"` for
label/value/comparison columns. Direct `MetricContent` children of
`MetricGroup layout="row"` share aligned columns. Narrow rows give labels their
own line, including standalone metrics and row overrides within summary groups.
Choose `size="sm" | "md" | "lg"` independently of layout; `unit` is a secondary
suffix and `valueSize` / `typography` override text roles.

Supply comparison `label` and exactly one of `baseline` or `baselineId`.
Use a unique `baselineId` referencing visible shared context to avoid repeating
the period on every metric. Set `direction` independently of `sentiment`; lower
cost can be positive. `accessibilityLabel` supplies a localized change description.
Use `null` for missing data and `isLoading` for loading; both suppress comparisons
and units, while the formatted string `"0"` remains an observed value.
Passive `Pill` supports `size="xs"`; `PillButton` retains `sm` and `md`.

See [shared summaries](https://lanej.io/easy-ui/storybook/?path=/story/components-metriccard--shipping-overview),
[aligned rows](https://lanej.io/easy-ui/storybook/?path=/story/components-metriccard--shipping-rows),
and [independent row layouts](https://lanej.io/easy-ui/storybook/?path=/story/components-metriccard--mixed-layouts).

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
numeric meaning. Consult [Choosing a chart](https://lanej.io/easy-ui/storybook/?path=/docs/organisms-charts-choosing-a-chart--docs) and each chart's
examples for configuration and missing-data behavior.

## Compact plots and geographical views

| Public entry           | Choose it for                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `MeterBar`             | Visual-only single fill, or labeled measurements with accessible meters on one explicit shared scale      |
| `ProportionBar`        | Accessible part-to-whole molecule with percentage, numerator/denominator, label, and explicit data states |
| `BarList`              | Compact category comparisons with HTML/CSS                                                                |
| `BulletChart`          | A supplied measure and target on an explicit zero-based scale                                             |
| `CompactTimeSeries`    | A compact native SVG trend and optional reference                                                         |
| `RangePlot`            | Named points and an optional interval on a shared scale                                                   |
| `DurationDistribution` | Elapsed duration against supplied bins, density, cumulative points, or quantiles                          |
| `WaffleChart`          | One cell per supplied discrete item, passive linked summaries, and inspectable grouped pools              |
| `NetworkMap`           | Geographical layers and inspection using MapLibre                                                         |

Import `WaffleChart` and its public item, item-order, category, group, selection,
inspection, highlight, and anchor types from `@easypost/easy-ui/WaffleChart`. Supply stable
item IDs, exact labels, explicit category-to-theme-token colors, and optional
`item.groupId` membership. Each supplied item appears once; counts are never
normalized to 100 or percentages. Applications own relationships, allocation,
and the meaning of missing data. Keep shared resources once in `items` even when
their group connects to several targets. Unmatched memberships stay visible in
the neutral `ungroupedLabel` bucket; unlinked items do not establish capacity.
Unknown categories use a neutral dashed marker and exact unknown-category label.

Use `variant="compact"` inside a row link for a passive grid with an adjacent
count and visible draft marker. It has no nested controls, legend, or details.
The default presentation supports group captions, exact-count legends, keyboard
and touch inspection, and caller-rendered `renderDetails`. Control `selection`
with `onSelectionChange`; `defaultSelection` initializes local state. Item/group
hover, focus, and activation callbacks coordinate related views. Arrow keys and
Home/End move cell focus, Enter/Space or a tap pins inspection, and Escape clears
it. Hover details remain available across the chart/details area for pointer
inspection and text selection. Focus can traverse the interactive legend, detail
actions, and their caller-owned Select/Modal portals without pinning; that target
stays available until focus leaves the combined chart region or inspection is
dismissed. Pointer exit does not remove focused controls. Escape returns focus to
the inspected origin.
Supply controlled `selectedCategoryId` / `onCategorySelectionChange` or
`highlight` item/group/category IDs to emphasize related records without filtering
the pool or changing totals. Draft, muted, and selected states remain distinct.

Use `onGroupAnchorsChange` for a caller-owned connection layer. Each explicit
group supplies a stable `groupId`, supported endpoint `element`, and viewport
CSS-pixel `bounds`; one anchor can feed several edges. Convert to your overlay's
coordinate system. Measurements update after data, arrangement, count visibility
or count-label changes, resize, wrapping, and scroll; cleanup supplies `[]`.
Change `layoutRevision` for external layout
moves that do not resize the chart. Compact mode does not expose group anchors.
Use `itemOrder="input"` (default) to retain supplied cell order or
`itemOrder="category"` to cluster by category ID in supplied `categories` order,
with stable input order within each category. Unknown IDs follow in first-seen
ID order; categories sharing a color remain separate. Clustering stays within
each explicit group and remainder bucket; compact uses its flat item grid.
Arrangement leaves membership, IDs, exact counts, and category-token mappings
unchanged. `WaffleChartItemOrder` exports the two order choices. Combine
`maxColumns`, `cellSize`, and `gap` with caller-owned `Select` controls for column
limits and density; interactive cells retain at least a 24px pointer target.
Keep controls outside a compact summary's link. Inspect Light and Dark with the theme toolbar.
See [smallest input and API](https://lanej.io/easy-ui/storybook/?path=/docs/components-wafflechart--docs),
[passive linked summaries](https://lanej.io/easy-ui/storybook/?path=/story/components-wafflechart--compact-linked-summary),
[shared group connections](https://lanej.io/easy-ui/storybook/?path=/story/components-wafflechart--linked-groups),
[controlled order and arrangement](https://lanej.io/easy-ui/storybook/?path=/story/components-wafflechart--arrangement-controls),
[controlled inspection](https://lanej.io/easy-ui/storybook/?path=/story/components-wafflechart--controlled-inspection),
[unknown and empty data](https://lanej.io/easy-ui/storybook/?path=/story/components-wafflechart--unknown-and-empty),
[Dark theme](https://lanej.io/easy-ui/storybook/?path=/story/components-wafflechart--dark),
[narrow layouts](https://lanej.io/easy-ui/storybook/?path=/story/components-wafflechart--narrow-layout),
and [arbitrary item counts](https://lanej.io/easy-ui/storybook/?path=/story/components-wafflechart--many-items).

NetworkMap close-ups use a compact drill-in at container widths up to 480px: Back to overview or Escape restores the unchanged overview. Wider cards retain a floating inset. Only the visible map exposes controls and keyboard targets.

Use the unframed `ProportionBar` for part-to-whole meaning.
`presentation="compact" | "expanded" | "bar"` controls layout; the application
supplies any surrounding card. Keep zero, missing data, an empty
population, and invalid observations distinct. See [proportion presentations](https://lanej.io/easy-ui/storybook/?path=/story/components-proportionbar--presentations).

Use `MeterBar value={...} max={...}` for a visual-only fill whose owner supplies
labels and accessible semantics. Use `data` for labeled comparison rows on the
same explicit positive `max` and units; valid rows expose their own meters.
`formatValue` formats text without changing geometry. `color` selects the
primary/secondary/tertiary series palette; `tone` expresses caller-supplied meaning.
Missing, nonfinite, negative, and out-of-range values are unavailable, not zero.
`RiskScore` and `ProportionBar` compose the visual-only form: do not nest meters
or turn a bounded risk score into a percentage.
See [shared-scale comparisons](https://lanej.io/easy-ui/storybook/?path=/story/components-meterbar--comparison)
and [zero and missing values](https://lanej.io/easy-ui/storybook/?path=/story/components-meterbar--comparison-states).

For map composition, import `NetworkMapSurface`, `NetworkMapProvider`,
`NetworkMapHeading`, `NetworkMapControlPanel`, `NetworkMapLegend`,
`NetworkMapSelectionDetails`, `NetworkMapDataView`, `NetworkMapCellDetails`, and
`NetworkMapInspectionTrigger` from `@easypost/easy-ui/NetworkMap`.
Follow the package README for MapLibre stylesheet and worker setup. Use
`GraphChart` for abstract relationships without geographical coordinates.

Use `zoomSections` for caller-defined journey groups with crowded stops. Selecting
an overlapping group opens one close-up; **Zoom to area** moves the main map there.
Insets share selection and metrics and omit inspection cards. Use
`NetworkMapViewport` and `NetworkMapZoomSections` from the same subpath for custom
compositions. See [journey close-ups](https://lanej.io/easy-ui/storybook/?path=/story/components-networkmap--zoomed-journey).

Map width follows its container. Set numeric `height` for the geographic surface,
or `height="fill"` inside a parent with a defined height; both keep a 220px surface
minimum, including with `zoomSections`. Close-ups fit the available space and
show a compact selectable stop list when an inset map cannot fit. **Zoom to area**
remains available unless `controls={false}`. See [journey sizing](https://lanej.io/easy-ui/storybook/?path=/story/components-networkmap--journey-sizing).

Use `primaryFacilityIds` to prioritize route labels and style rendered marker
buttons through `data-primary="true|false"`. Included IDs are primary even when
shared by routes; an empty array marks all false, while omitting or clearing
the prop removes the attribute. Insets inherit this membership independently of
which stops they display, including live updates, empty arrays, and clearing.
See [primary-route close-ups](https://lanej.io/easy-ui/storybook/?path=/story/components-networkmap--primary-route-insets).
Keep `data-selected` and `data-latest` emphasis
independent. Scope label styles to a wrapper and `[data-map-label]`; do not
replace MapLibre positioning classes. See [primary-route marker styling](https://lanej.io/easy-ui/storybook/?path=/story/components-networkmap--primary-route-markers).

Use `renderCellDetails` to replace cell inspection content, or children of
`NetworkMapCellDetails` to replace its plot while retaining summary and provenance.
The same content is available in keyboard-accessible exact-data details. Supply
actual distributions or history; median and IQR do not define a histogram.
See [rich cell inspection](https://lanej.io/easy-ui/storybook/?path=/story/components-networkmap--rich-cell-inspection).

## Event and path investigations

Use `EventTimeline` for ordered observations and `EventMetrics` for independent
measurements. Compose `renderMetrics` with `variant="minimal" | "compact" | "expanded"`.
Minimal metrics use `metricsPlacement="inline"` and compact event size; other
metrics sit below identity. Metrics remain outside the event-selection button.
Keep event selection, each metric's assessment, and receipt time distinct.
Supply complete date/time and timezone labels when needed; native timestamps
stay at least 12px and wrap at spaces in a readable column.
See [full timestamps](https://lanej.io/easy-ui/storybook/?path=/story/organisms-data-display-eventtimeline--full-timestamps).
See [timeline presentations](https://lanej.io/easy-ui/storybook/?path=/story/organisms-data-display-eventtimeline--presentation-modes).

Use `InvestigationWorkspace` to coordinate timeline, map, and persistent details
through one controlled `InvestigationSelection`. Supply stable event, location,
path, and segment IDs with explicit memberships. Scoped event stepping preserves
the selected path/location/connection; selection does not automatically move the
camera. Narrow layouts retain the same mounted views behind Events / Map tabs.
Use `PathComparison` with the same selection for caller-aligned candidate rows.
The application supplies ordering, alignment, and confidence; neither component
chooses a true history or repairs timestamps.
See [linked investigation](https://lanej.io/easy-ui/storybook/?path=/docs/organisms-investigation-investigationworkspace--docs)
and [candidate comparison](https://lanej.io/easy-ui/storybook/?path=/docs/organisms-investigation-pathcomparison--docs).

For account activity or other map-free observations, compose `EventTimeline` with
`InvestigationDetails`. Import the inspector, `resolveSelection`, `selectEvent`,
`InvestigationDetailsProps`, `InvestigationDetailsLabels`, `InvestigationRecords`,
`InvestigationDetailsContext`, and `InvestigationSelection` from
`@easypost/easy-ui/InvestigationWorkspace`. Resolve `{ events }` with controlled
selection, pass `context.event?.id ?? null` to the timeline, and route timeline
selection and inspector `chooseEvent(id)` through `selectEvent(context, id)`.
Inspector `clear()` requests `null`; `renderDetails(context)` supplies rich content.
Geometry records are optional. The standalone inspector detects its own narrow
container and keeps content mounted behind Show details; `isNarrow` is an optional
parent-layout override. Widening a focused detail disclosure returns focus to the
inspector region. Labels accept partial overrides.
See [map-free composition](https://lanej.io/easy-ui/storybook/?path=/story/organisms-investigation-investigationworkspace--map-free)
and [narrow inspector](https://lanej.io/easy-ui/storybook/?path=/story/organisms-investigation-investigationworkspace--map-free-narrow).

## Dependency investigation

Import `DependencyGraph`, `DependencyGraphDetails`, and `DependencyGraphChanges` from
`@easypost/easy-ui/DependencyGraph`. Supply stable node/edge IDs; arrows run
from dependency to dependent. The organism owns directed layout, bounded
neighborhoods, group collapse, search, and linked selection. Applications own
relationship discovery, evidence, change kinds, and risk. Read its Storybook
examples and types before using the independently controlled view and selection.

Omit `title` and `description` when embedding; use `accessibilityLabel` for its
accessible name. Keep `label`, `typeLabel`, and complete `address` distinct.
Supply `categories` as labeled objects with optional theme `variant`; categories
and resource operations are independent. Omitted `change`, explicit `unknown`,
and explicit `unchanged` have distinct meanings. Use `groups` and node `groupId`
for explicit, optionally nested boundaries and `collapsedGroupIds` for their state.
See [source identity and categories](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--source-only-evidence)
and [nested subgraphs](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--nested-subgraphs).

### Graph and tree presentations

Use `presentation="tree"` / `onPresentationChange`, or
`defaultPresentation="tree"`, for the compact foldable outline of the same graph.
`treeHierarchy` chooses explicit group containment or dependency nesting; automatic
selection prefers groups when supplied. Shared paths become reference rows and
back edges become cycle references, linked to each resource's primary row.
The tree is a navigation projection of supplied relationships.

Tree drawers add details without repeating row identity and status. Use
`showDetails={false}` for an external inspector, or `renderDetails` to append
application evidence. Set `renderDetailsMode="replace"` to own the detail body
while retaining native close controls. Standalone `DependencyGraphDetails`
accepts the same renderer and mode. `detailsExpanded` controls the built-in
inspector's expansion. See [compact tree](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--compact-tree)
and [custom drawer content](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--custom-tree-details).

### Resource differences and risk

Supply `changeSummary` and typed `changes`; control expanded differences through
`expandedChangeNodeIds`, independently of selection. Comparisons stack on narrow
containers and align side by side when space allows. Added attributes and explicit
native `null` to non-null changes show only the new value with a blue plus.
The literal string `"null"`, empty strings, unknown values, and redacted values do
not imply an absent prior value. The application computes diffs and formats values.
See [newly set values](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--newly-set-values)
and [responsive comparisons](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--responsive-attribute-differences).

Use `renderNodeAnnotation` for resource findings and `renderAttributeAnnotation`
for findings on a supplied `change.path`. Set `node.appearance.background` and
`node.appearance.borderColor` with theme tokens to emphasize either a graph card
or tree row; pair meaningful colors with text. Selection and focus retain their
indicators. Applications own assessment, thresholds, and promotion of attribute
findings to resources; omitted findings do not establish safety.
See [risk annotations and resource colors](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--risk-annotations).

### Layout and inspection

Use the built-in full-screen control to expand the whole graph and inspector;
embedded iframes must permit the Fullscreen API. Enable **Edit layout** to move
or resize resource cards. Persist `cardLayouts` / `onCardLayoutsChange`, keyed
by original resource ID with optional `x`, `y`, `width`, and `height` in graph
units. `defaultCardLayouts` provides local initial state; `allowLayoutEditing={false}`
hides editing controls while retaining saved geometry. Automatic layouts preserve
relative resource order as content expands; `layoutRevision` explicitly recomputes
that order. Manual cards can overlap. See [full-screen inspection](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--fullscreen-inspection)
and [editable resource cards](https://lanej.io/easy-ui/storybook/?path=/story/components-dependencygraph--editable-resource-cards).

### Disclosure atoms and dependency density

`ExpandButton` and `CollapseButton` provide reusable positive (+) and negative (−) disclosure controls. Supply `accessibilityLabel`, `aria-controls`, and `onPress`; control `expanded` to retain focus while changing the symbol. `DependencyGraph` uses these for inline attributes, groups, and dependent branches. `collapsedNodeIds`/`onCollapsedNodeIdsChange` fold branches independently of `collapsedGroupIds`. Shared resources remain visible through other open paths. Nodes accept the standard `IconSymbol` as `icon` and a caller-owned `iconLabel`. Zoom changes cards from overview (<70%) to summary (<100%) to detail; expanding attributes restores at least 100%.

Resource cards use a compact identity/status row and tight attribute spacing without reducing value text size. Disclosure targets remain usable while zooming; measured content drives layout and attribute anchors.

Supply `edge.change` (`add`, `remove`, `update`, `unchanged`, or `unknown`) independently of resource operations. Include removed links in the supplied graph. A caller-matched `update` renders one yellow modified link. Reference value changes alone do not imply relationship changes. Omit both attribute paths for explicit block-level `depends_on`. Added/removed links keep separate routes even with collapsed groups, use green/red arrows without status symbols, and remain individually selectable in relationship details. Changes scope includes their endpoints.

Edges may specify `sourceAttributePath` / `targetAttributePath` to connect visible expanded field rows. Hidden/missing fields fall back to card endpoints; supplied paths remain in relationship details. Routing uses rounded orthogonal lanes around cards and group headings.

## Concurrent notifications

Use `useNotification` from `@easypost/easy-ui/Notification` inside `Provider`.
Set `notificationOptions={{ stacking: true, timeout: 5000, isDismissable: true }}`
on `Provider` for concurrent individually closable five-second toasts, and use
`notificationPlacement={{ offset: { bottom: "16px", right: "16px" } }}` for
bottom-right placement. See [stacked notifications](https://lanej.io/easy-ui/storybook/?path=/story/components-notification--stacked-notifications).

Show methods return unique keys; `closeNotification(key)` dismisses one item.
Per-message `timeout` and `isDismissable` override defaults; zero disables expiry.
Alerts remain persistent/dismissible unless explicitly overridden on that alert.
Hover/focus pauses all retained timers with their remaining durations. Clipped
scroll-overflow items only accumulate expiration time while fully presented.
Oversized timed items gain a reachable close control that remains after resizing
or reflow, preserving keyboard focus. Stack sizing treats explicit `auto` offsets
as unspecified edges, with the same 16px opposite-edge reading margin. See
[auto-edge placement](https://lanej.io/easy-ui/storybook/?path=/story/components-notification--stacked-auto-placement).
Duration and close-control defaults apply to future calls; presentation tracking
follows the effective stacked layout, including older messages. Disabling stacking
replaces retained items on the next call. Unmount clears timers.
Omitted configuration retains replacement,
4000ms non-dismissible toasts, and persistent dismissible alerts.
