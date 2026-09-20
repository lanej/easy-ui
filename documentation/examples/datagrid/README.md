# DataGrid Service Split captures

These are browser screenshots of the `Components / DataGrid / Service Split Collapsible` story, captured from source commit `ca910b7f18ee34d2bd6c4a80d9baab016df47037` on September 18, 2026 (America/Los_Angeles).

The example uses synthetic carrier/service data. Subtotals sum every supplied row in each carrier group. Collapsing a carrier hides its service rows while retaining its subtotal and disclosure control.

- [All groups expanded](service-split-expanded.jpg): USPS 2,000 packages / $14,400; UPS 800 / $10,976; FedEx 500 / $7,278.
- [USPS collapsed](service-split-collapsed.jpg): the USPS subtotal remains visible; UPS and FedEx stay expanded.

Run `npm run start:storybook` from the repository root and open `/iframe.html?id=components-datagrid--service-split-collapsible&viewMode=story`. Use the chevron beside USPS subtotal to reproduce the second state.

Captured in the Codex in-app Chromium browser with the default 1280 × 720 CSS-pixel viewport, light theme, and `md` row density. The images are cropped to the table and its surrounding padding. Browser capture output is 640 × 257 pixels expanded and 640 × 209 pixels collapsed. They are actual component renders, with no image retouching.
