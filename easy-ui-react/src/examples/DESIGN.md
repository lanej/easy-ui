# Workflow examples

## Network investigation

The Network Investigation story inherits the active Easy UI theme rather than
forcing light mode. Its local geography has matching light and dark styles;
trajectory and flow marks and labels use the corresponding palette. The toolbar
uses Easy UI Select for hub and presentation choices, with the arrow contained
inside the trigger at narrow widths. Storybook navigation stays in Storybook:
the example does not add an Examples navigation or a custom breadcrumb.
Network story interactions cover hub selection and trigger/arrow containment;
unit tests cover theme inheritance, linked evidence, and presentation switching.
`NetworkInvestigationMap` owns the investigation's geographic presentation,
theme-aware local basemap, and selected outgoing cohort. The workspace composes
it rather than configuring the map inline. Its standalone Storybook stories
cover default and alternate hub selection and optional raw-data tables.
The standalone map does not require a heading, subtitle, or view-scale badge.
Fit-all and layer toggles can be hidden independently, or all built-in controls
can be omitted. The Bare Map story shows only geography and provider
attribution. Rich Overlays demonstrates caller-supplied points, multi-points,
an area and a route, using theme colors and data-driven point sizes. These
GeoJSON overlays are independent of the facility-risk and weather toggles.
The Configurable Layers story supplies the complete toolbar definition: camera
action, arbitrary overlay checkboxes, and a caller-owned button. Control labels,
order, inclusion, and layer bindings come from those definitions, not fixed
Facility risk or Weather text. The separate Configured Builtin Controls story
demonstrates renaming the legacy layer toggles. Checkbox interactions check
native layer visibility, callback IDs, and preserved map instance and camera.
Selection stays controlled by the caller so the map and other evidence remain
linked. The generic, public `NetworkMap` remains the underlying reusable map.
The pressure heatmap uses an 8px horizontal frame and label-aware plot bounds
instead of fixed axis gutters. Its 360px minimum preserves readable cells on
small screens without forcing horizontal scrolling in normal docs columns;
story interactions check all hub and hour labels stay inside the plot.

## Pricing comparisons

The Storybook pattern is a synthetic review queue, not a live pricing tool. Its
primary task is comparing proposed rates, modeled contribution bounds, latest
daily demand, and constraints before queuing a review or holding a proposal.

Each proposal has a compact identity/action strip followed by aligned, labelled
price, contribution, demand, and constraint fields. Controls stay beside the
identity instead of reserving a mostly empty row below the metrics. The
component's available width determines whether four fields sit alongside one
another or wrap to two columns. Narrow screens stack investigations without
horizontal page scrolling. Annotations retain a
12px floor; proposal identities, monetary values, and headings retain 14px.
The queue shows demand as a numeric value, without inline sparklines.
The separate Graphical Review Queue story adds three Apache ECharts comparisons:
zero-based current/proposed price bars, contribution scenario intervals with a
zero reference, and overlaid daily demand histories on a shared scale. Charts
follow the queue filter, retain fixed axes across selections, and include exact
data disclosures. Contribution intervals are modeled bounds, not confidence
intervals. The original numeric review queue remains unchanged.
Each comparison is an independent pricing-pattern component:
`PriceComparisonChart`, `ContributionComparisonChart`, and `DemandComparisonChart`.
Each owns its ECharts configuration and exact-data table, accepts the selected
proposals, and has standalone default and filtered Storybook stories.
`PricingReviewCharts` only arranges those components; `PricingReviewChartFrame`
centralizes their shared geometry, typography, and data-disclosure composition.
Comparison charts have equal widths and heights, not just identical outer SVG
heights: a shared Cartesian grid reserves the same axis space for
every plot. Static series keys live beside the exact-data disclosure instead of
reserving a legend band inside every plot. The 200px surface now gives the drawing
area 152px rather than 120px; footers follow within 8px. Pricing comparison frames
do not support a caveat/notice slot. Titles and subtitles share a baseline when they fit, wrapping
naturally at narrow widths. There are no fixed header or empty note rows.
Side-by-side comparisons use shared grid rows to align their plots and data
disclosures to the actual content. Below 1000px of available width, all three
charts stack at the same width with content-sized headings and footers.
Independently opened data tables can grow naturally without changing plot sizes.
Story geometry checks enforce equal panel widths, aligned side-by-side plots,
and 200px rendering surfaces, while unit tests enforce identical drawing-area
margins, external series keys, and the absence of caveats. Standalone stories check
the footer gap. The price story additionally checks
inline subtitles and a compact collapsed height at wide widths.
Headings, series keys, and disclosures grow when text is enlarged rather than overlapping plots. Story
checks double heading, description, legend, and disclosure text and assert separation from
plots and data disclosures, then restore normal typography.
Investigations use compact Apache ECharts line charts through Easy UI's `Chart`
wrapper. They share the same 0–200 parcels/day scale, follow the active theme,
and expose exact UTC daily observations in an independent data disclosure.

From the repository root, with Storybook running on port 9013:

```sh
ui-review check --project "$PWD/easy-ui-react/src/examples" --url http://localhost:9013
```

The scoped checks cover the numeric and graphical review queues, expanded
investigation, and multiple investigations at 1440px, 768px, and 320px. Story interactions assert that controls
sit above the metrics, fields share rows at the appropriate component width,
and no field escapes the summary. `PricingReview.test.tsx` covers decisions, filters, empty states,
focus retention, independently retained notes, and instance-scoped relationships.
The Multiple Investigations story also exercises note retention in the browser.
The Graphical Review Queue story waits for all three ECharts surfaces and checks
that comparison panels stay within the workspace.
