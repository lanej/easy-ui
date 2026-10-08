---
"@easypost/easy-ui": minor
---

Support grouped DataGrid rows with caller-defined subtotal aggregators, human-readable group labels, and optional collapse controls. Add per-column alignment, width and numeric layout options, uncapped rows, and an explicit maximum height. Preserve subtotal state, keyboard focus, selection, and expansion through grouping changes and consumer-key collisions. Skip hidden cell/action renderers while retaining complete selection and subtotal semantics.

Treat expandedKey={null} as controlled closed state and report the next key or null from onExpandedChange. Consumers that treated its argument as the clicked row key should store the next state instead. Suspend expanded details safely during loading and restore them when loading finishes.
