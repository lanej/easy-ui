# ScoreComposition

Native score explanations belong with the lightweight data visualizations, alongside MetricCard and BarList. This component has a constrained signals → contributions → result topology and no graph-engine dependency.

## Ownership

The application supplies stable IDs, observed values, weighted/capped scores, source relationships, final aggregation, outcome wording and sentiment, and provenance. Easy UI preserves array order and exact supplied values. It does not infer risk, thresholds, causality, statistical confidence, or flow conservation.

## Public components

- `ScoreComposition`: optional heading/context/frame, CSS Grid layout, named lists, and measured SVG connections.
- `ScoreSignal`: compact bordered observation box with internal text clearance, optional explicit sentiment/status, and true zero, false, missing and invalid states.
- `ScoreContribution`: exact signed score and supplied cap, valid-range meter, readable source names, and optional shared Disclosure.
- `ScoreResult`: emphasized supplied score, optional cap/outcome, and application context.
- `ScoreConnector`: one decorative Bézier path for a containing SVG.

All components and their documented types use the `@easypost/easy-ui/ScoreComposition` entry. Build discovery generates CJS/ESM, declarations, and legacy compatibility entries. The shared stylesheet contains their Sass-token-based presentation.

## Acceptance

Three columns at content widths of at least 48rem; stacked reading order in narrower containers. Exact data remains visible at both sizes. Source labels are visible when stacked and available to assistive technology in three columns. Independently placed contribution cards retain visible sources. No floating SVG text, chart engine, React Flow, drag handles, or zoom controls. Curves stay in gutters and follow resized nodes and opened explanations, including right-to-left layouts.

Meters require positive finite caps and scores within the zero-based range. Missing and invalid scores are labelled; negative and above-cap scores retain exact text with an outside-scale note and no filled meter. Result totals are never recomputed. Unknown sources remain visibly identifiable without fabricated edges. Repeated references are deduplicated.

Signal sentiment is application-supplied (`neutral`, `positive`, `warning`, or `negative`) and defaults to neutral. Boolean and numeric values never imply sentiment. Nonneutral values use a tinted value/status pill with a visible `statusLabel`, or a localizable “Positive”, “Caution”, or “Negative” fallback. Neutral values can also carry a status label. The exact observation and textual interpretation remain readable without color. Blank status labels use the fallback; missing and invalid observations suppress stale sentiment/status and retain neutral missing/invalid text. Applications update the value and its interpretation together.

Verify keyboard disclosure, stable state through record reordering, optional/external headings, shared signals, empty and missing data, explicit signal sentiment and localization, SSR, observer cleanup, container resizing, narrow widths, large text, theme changes, forced colors, browser console and accessibility scans. Signal tests must cover neutral numeric/boolean defaults, identical values with different supplied meanings, status updates, and unavailable/invalid values clearing stale interpretations. Browser checks must confirm signal borders and padding and sample every SVG curve against visible text rectangles to catch connector/text collisions. Verify the actual packed entry in both package layouts and both supported TypeScript resolution modes.

See [the API and stories](../../easy-ui-react/src/ScoreComposition/ScoreComposition.mdx) and [browser review instructions](../../scripts/preview-metrics/README.md).
