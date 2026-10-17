# Warning contrast and complete timestamp evidence

Native Storybook components captured by Chromium in [successful CI](https://github.com/lanej/easy-ui/actions/runs/38997296204) for source commit `5d839f1c175d47ad2892f23028da2ff69c8cad5d` (draft PR #60). Screenshots are unmodified CI artifact bytes; this evidence-only branch does not change the PR source head.

The browser check verifies 390px and 1200px in light and dark themes. Warning signal and contribution text measures **7.5355:1 in light** and **7.7988:1 in dark**. Complete occurrence and receipt labels remain **12px**, with whole date, clock, and UTC tokens fitting their text boxes. The timestamp column is **96px**. Detailed, inline detailed, and compact-with-trailing layouts pass without horizontal overflow; ArrowDown, End, and Home preserve keyboard selection.

`checks.json` retains the rendered measurements; `provenance.json` records the source run, artifact, and file hashes. Run `node scripts/check-evidence-typography.mjs` with `STORYBOOK_URL` pointing to the built Storybook and `PLAYWRIGHT_MODULE` pointing to the locked browser dependencies.

| Viewport | Warning labels | Complete timestamps |
| --- | --- | --- |
| Light 390px | [Capture](score-light-390.png) | [Detailed](full-timestamps-light-390.png), [Inline](full-timestamps-inline-light-390.png), [Compact](full-timestamps-compact-light-390.png) |
| Dark 390px | [Capture](score-dark-390.png) | [Detailed](full-timestamps-dark-390.png), [Inline](full-timestamps-inline-dark-390.png), [Compact](full-timestamps-compact-dark-390.png) |
| Light 1200px | [Capture](score-light-1200.png) | [Detailed](full-timestamps-light-1200.png), [Inline](full-timestamps-inline-light-1200.png), [Compact](full-timestamps-compact-light-1200.png) |
| Dark 1200px | [Capture](score-dark-1200.png) | [Detailed](full-timestamps-dark-1200.png), [Inline](full-timestamps-inline-dark-1200.png), [Compact](full-timestamps-compact-dark-1200.png) |
