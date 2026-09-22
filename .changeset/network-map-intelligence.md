---
"@easypost/easy-ui": minor
---

Add NetworkMap with an optional, lazy MapLibre peer, zoom-aware facilities, observed/planned connections, risk, weather, delivery surfaces, and accessible exact data. MapLibre CSS and the matching worker are supplied by map consumers.

Compose the map surface independently from optional headings, controls, legends, selection details, and equivalent data. Hide inapplicable controls; support caller labels, layer visibility, facility colors, and explicit camera requests. Retain initial fitting and camera commands across Strict Mode replay and reloads. Typography and measured labels adapt to the available space, with a 220px height floor and readable legend/scale defaults.

Preserve source values, missing observations, provenance and uncertainty for weather and surface data. Keep dateline routes short, consumer paint overrides intact, and selection visible across evidence types. Update marker callbacks without rebuilding the map, and avoid unchanged source uploads during interaction updates.

Inspect delivery cells on hover or click/tap, with a contained, dismissible detail card and equivalent keyboard-accessible details. Supplied quartiles and bounds render an engine-free range plot; missing distributions retain honest summaries. Reuse `NetworkMapCellDetails`, supply a custom chart, or hide the card while retaining original-record callbacks. Configure delivery color scales and switch named metrics without rebuilding the map.
