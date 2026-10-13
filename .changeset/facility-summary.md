---
"@easypost/easy-ui": minor
---

Add FacilitySummary as an organism composing facility identity and independent HealthAssessment observations, with optional duration references, compact/table and detailed forms, localized absence/loading states, and no inferred facility health policy.

Support a HealthIndicator dot variant and HealthAssessment label placement so compact facility observations show the label, status dot, and duration on one row.

Keep optional freshness in separate context from health, and support inline percentile metrics above reference graphics. ObservationFreshness supports optional visible fresh-state labels; FacilitySummary shows them by default and honors an explicit `showStateLabel: false`. HealthAssessment supports context placement for freshness.

Use a consistent observation row above full-width references in facility summaries, with secondary identity metadata and inline percentile comparisons.

Keep label-placed assessments visible at narrow responsive widths, including dot assessments.
