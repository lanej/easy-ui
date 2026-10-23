# Notification evidence for issue 66

Source revision: adaff5e4221c6a5347e9722507c8578cdcf04347
PR: https://github.com/lanej/easy-ui/pull/69
Successful browser run: https://github.com/lanej/easy-ui/actions/runs/40004286741
Artifact: https://github.com/lanej/easy-ui/actions/runs/40004286741/artifacts/12522898796

These 24 synthetic Storybook captures cover light/dark themes at 1280x720 and 320x720: mixed stack, oversized message, overflow, default placement, 80px offsets, and an absolute custom container. The matrix passed timer, pause/resume, individual dismissal, focus, viewport containment, oversized fallback, overflow presentation, and status-icon geometry checks.

Independent screenshot review accepted the corrected status-icon proportions, wrapping, close-control separation, spacing and both themes. Screenshot review is not manual interaction or human approval.

Overflow is intentionally scrollable and boundary cropping is expected. Placement captures can differ in scroll position: dark-320-stacked-default-placement.png shows items 7–2 rather than final item 0. Do not treat every placement screenshot as visual proof of the final endpoint.

PNG blob SHAs were verified against the downloaded CI files before publication. Consumer application adoption was not run.
