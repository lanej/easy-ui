# Chart review contract

The initial run at `2cb1f2d` used Viewrule 0.3.1's unmodified baseline:
1,860 text-size errors across desktop (1440), mobile (320), and 4K (3840),
with no overflow or clipping findings. These are repeated text observations
across viewports, not 1,860 distinct layout defects. Evidence:
https://github.com/lanej/easy-ui/actions/runs/34761017304

## Explicit application calibration

The generic 14 px minimum is replaced by a 12 px floor for chart annotations,
legends, captions and exact tables, plus a separate 14 px floor for page prose
and headings. This matches the dense analytical roles in these examples;
it is not a human approval or a universal accessibility claim. Existing 9–11 px
ECharts annotations and preview table headers are increased to 12 px. Mobile
uses the same minimum. Before/after error counts therefore use different,
documented contracts and must not be presented as repairs alone.

Known native example headings and captions get maximum heights to detect
accidental flex stretching. This is a scoped spacing regression, not a global
empty-space score. Short range labels get bounded columns and reflow above
full-width tracks in narrow cards. Large screens show more charts within a
finite 2240 px content region, preserving comparison identities and type sizes.

Both chart and map CI now pin View Rule 0.7.0 at
`6d36031935a824c650e049a14aeb9770e042bb95`, replacing the historical pre-0.4
candidate. The tagged prerelease engine includes `within-bounds` (lanej/viewrule#10),
state checkpoints, component relationships and scoped evidence tracking.
Reviews explicitly use `check --full` after this upgrade; prior reports remain
historical evidence and no thresholds or approvals are weakened. Configuration
schema v1 is retained and CI uses Node 22.x (the engine requires 22.18+).
`no-clip` alone cannot detect SVG text beyond the SVG viewport. All ECharts SVG text
must fit its SVG; native HTML value/date labels must fit their declared axes
and remain non-overlapping. Canvas, masks, intermediate clipping ancestors,
occlusion, and semantic chart correctness still require separate review.

## Evidence and stress case

`layout.html` exposes 280/320/480/720 px cards with long service names, full CHF
amounts, complete dates, zero and missing observations, and expanded exact tables.
The existing Chrome/Firefox/Safari workflow checks a 280 px card and keyboard
horizontal scrolling in the intentional exact-table region. Viewrule measures
this route at desktop and 320 px, plus the complete gallery at desktop/mobile/4K.
The complete reports and native-scale detail captures are CI artifacts.

## Map composition contract

The map workflow uses `maps/config.json` and `maps/rules.json` for separate View Rule runs on the composed map at 1440px and 390px, with default and increased text roles. It uses the same 12px annotation/14px prose floors, real WebGL rendering with software Chromium, and measured visible-label bounds. The three-browser map harness additionally checks label collisions, external selection placement, source geometry, route selection, callback changes, and exact layer data. Rendered artifacts must be inspected; canvas/occlusion behavior is not established by DOM font checks alone.

The chart contract also reviews `chart-composition.html` and `native-regressions.html` at desktop and 320px, including increased typography in constrained 320px compositions. Three-browser checks record actual viewport and component widths; Safari may enforce a wider native window while the fixture remains constrained.

## Score composition contract

`score-composition.html` is included at desktop, 320px, and 4K in its default,
expanded/larger-text, and dark states. Scoped gates require all seven score nodes,
non-overlapping boxes within the layout, 14px primary text (including signal labels
and expanded explanations; 12px annotations retain the shared floor), and 44px
explanation controls. Clipping checks inspect the selected node boxes, primary
text containers, values, status labels, and result content. Intentionally hidden
source summaries are excluded; screenshots complement these scoped measurements.
The example retains an untriggered, explicitly clear weight-mismatch signal alongside flagged and elevated observations. The 4K layout preserves this finite comparison within a bounded reading width;
it does not stretch the cards or invent additional evidence (DR-007).

Bars encode fraction of each explicitly supplied cap, not absolute points across
cards; exact scores, denominators, and percentages stay adjacent (DR-001–003).
Sentiment is application-owned, and text labels distinguish meanings without
color (DR-005/016). Frames protect signal text from edges and group related
values; the result icon and accent identify the decision (DR-008/013).

The three-browser score audit separately measures every connector against visible
text and checks actual meter-boundary contrast in light and dark themes. The gold
warning interior uses a contrasting inset edge; View Rule's solid-background
`mark-contrast` check cannot measure that edge. Keyboard disclosure, refresh
continuity, RTL, and forced-colors evidence complement these layout gates.
These scoped measurements do not constitute full accessibility certification.
