# PR 59 exact-head browser evidence

Source commit: 913829fb43cb66f4669b799e65b7212970d87c8f.

Successful run: https://github.com/lanej/easy-ui/actions/runs/39000204323
Artifact: https://github.com/lanej/easy-ui/actions/runs/39000204323/artifacts/12088728106

The suite passed light/dark, wide/narrow, keyboard navigation, previous/next/clear, rich-content disclosure, no-map, axe, and responsive-focus checks. Both focused Show and Hide details controls restore focus to the persistent inspector on widening. Zero runtime errors or accessibility violations. The narrow dark capture is byte-identical to the previous capture. These generated assets are retained separately from the implementation PR.
