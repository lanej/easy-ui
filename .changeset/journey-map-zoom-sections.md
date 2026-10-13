---
"@easypost/easy-ui": minor
---

Add on-demand close-up insets for crowded journey nodes, with viewport-dependent availability, shared selection and independent cameras.

Keep incoming and outgoing journey connections in the requested close-up, with links to the off-inset facilities that preserve both cameras.

Keep flow widths on the overview cohort's scale and cap custom inset heights to the available geographic frame.

Keep the selected delivery-surface metric, its colors and inspection details synchronized between the overview and close-up.

Compact journey headings, shipment context, and filters; align map controls with tighter padding while retaining readable text, accessible names, and responsive wrapping. Geographic journey previews load their basemap by default, with tile-free fixtures reserved for explicit browser tests.

Place application filters and map actions in one wrapping toolbar with `toolbarContent`, use a compact surface-metric Select by default, and support title-only, description-only, and controls-only journey layouts without empty heading space. Inline metric radios remain available through an explicit toolbar configuration.

Keep the UnstyledButton reset below component styles in the CSS cascade so Select triggers retain their borders, padding, and text size when map styles load.
