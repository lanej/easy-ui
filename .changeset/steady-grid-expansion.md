---
"@easypost/easy-ui": minor
---

Support `expandedKey={null}` as controlled closed state and emit the next expanded key (including `null` on close) from `onExpandedChange`. Consumers that previously treated the callback argument as the clicked row key should store the next state instead.

Add `grouping.getGroupLabel` for human-readable subtotal and disclosure labels independent of opaque group keys. Preserve subtotal control state and focus when consumer keys collide with internal keys, restore focus from collapsed expanded details to the group disclosure, and skip hidden cell/action renderers while retaining complete selection and subtotal semantics.
