---
name: pr-screenshots
description: Prepare or revise Easy UI pull requests with current, verified screenshots embedded in their descriptions. Use for every PR creation, resubmission, or description update in this repository, including package, build, documentation, and tooling changes.
---

# PR screenshots

Include at least one actual screenshot in every PR description. Apply this
requirement when updating an existing PR as well as opening a new one.

1. Read the final diff and identify the rendered result a reviewer needs to see.
   Capture the affected component states in a real browser. Include relevant
   themes and narrow layouts when those change. For package/build fixes, render
   a synthetic consumer of the actual packed npm artifact rather than source
   imports. For documentation or tooling, show the relevant rendered document
   or workflow. Explain what a screenshot cannot establish and retain behavioral
   checks as the evidence for nonvisual contracts.
2. Capture the current implementation using synthetic data. Exclude consuming
   application/repository identities, credentials, and personal records. Do not
   substitute generated imagery, mockups, terminal text presented as a UI, or
   captures from a different implementation.
3. Inspect every image at readable resolution. Check loading, layout, clipping,
   and the relevant state. Record the source revision, artifact integrity when
   applicable, capture command, viewport, theme, and browser in a provenance
   manifest beside the images. Never label an image as captured from a revision
   that was not actually rendered.
4. Retain images under `.ui-review/pr-<number>/<source-revision>/` or an existing
   feature evidence directory. Commit them to this repository and use immutable
   raw image URLs containing the evidence commit SHA. Verify every URL returns
   the expected image before including it in the description; local paths,
   Actions ZIP downloads, and invented attachment URLs are insufficient.
5. Give the required separate PR writer the final diff, verification evidence,
   inspected screenshot URLs, and descriptive captions. Embed images directly
   in the body with `![description](https://raw.githubusercontent.com/...)`;
   put additional captures in a details block when useful. Keep the prose concise.
6. Inspect the published description and fetch its image URLs again. On later
   revisions, recapture if the rendered result or its input artifact changes.
   A documentation-only follow-up may retain an earlier capture when the
   manifest names its original revision and the rendered inputs are unchanged.

Do not silently omit screenshots. If a real capture or durable image upload is
blocked, complete the independent work, state the concrete blocker, and ask for
the missing access or an explicit waiver before declaring the PR resubmitted.
