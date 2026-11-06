# Continuous integration

## Faster feedback, the same required check

The main CI workflow keeps the required check named **build**. Package contracts,
lint, and unit tests run alongside a single Storybook build. Five independent
browser jobs consume that build and its compiled workspace packages:

- **Graphs:** DependencyGraph and its nested interaction and layout checks.
- **Charts:** waffle charts, map insets, and the chart catalog.
- **Metrics:** metric cards, facility summaries, proportion bars, and comparisons.
- **Catalog:** graph details, dependency trees, documentation, tokens, and typography.
- **Overlays:** notifications, theme switching, and drawer placement.

All 17 original browser entrypoints remain covered. Each script logs its elapsed
time. The final **build** check requires package, Storybook, and every browser job
to succeed. Failed, cancelled, and unexpectedly skipped jobs cannot turn it green.
Superseded pull-request runs are cancelled; main and manual runs remain independent.

## Skip unchanged browser work safely

Each browser job compares its inputs with a recent successful run of the same
workflow and pull request/ref. Fork pull requests always run fresh. The fingerprint includes:

- Fresh Storybook assets and all three compiled workspace package trees.
- Browser scripts and helpers, authored MDX, and Storybook configuration.
- Package manifests and lockfiles, the workflow, proof action, and Node/runner image.
- The immutable browser container and, for map Chrome checks, the installed Chrome version.

If these inputs match, the job links to the successful evidence and skips dependency
installation, browser tests, and duplicate screenshots. The pinned container already
contains the matching Chromium binaries, system libraries, and fonts.
Screenshot-only commits can therefore reuse successful browser results. The producing run’s immutable Git tree must also match the current source, apart from narrowly recognized review images, logs, and report/provenance files. Artifact names alone cannot authorize reuse. Changes to
shared components, themes, tokens, icons, or dependencies still invalidate the
results when their source or built output changes. Other source changes conservatively run fresh, even when their browser impact is unclear.

If the PR branch is behind its base, differing merge and head trees may conservatively force fresh checks. The same base revision is required for reuse.

This is deliberately more conservative than a component-folder allowlist: a changed
Storybook asset invalidates all five browser suites. It does not assume that only
the latest commit matters or that a source file affects only its own component.

Evidence expires after seven days. Failed, incomplete, expired, inaccessible, or
missing evidence runs fresh. Manual runs and reruns always run fresh. Reusing a
result does not extend its original expiry. Package tests, lint, and the fresh
builds still run; the workflow is never skipped with path filters.

## Avoid repeated browser system setup

Linux component browser jobs and the Chrome/Firefox map jobs use the official
Playwright 1.63.0 Noble image, pinned by SHA-256 digest. A guard checks both preview
manifest and lockfile versions against the image. Updating Playwright requires
updating the image and digest together. This retains the browser fonts and system
libraries while avoiding repeated OS package downloads from Ubuntu mirrors.

The first live map run spent 8m30s downloading 21.9 MB of font packages, while its
actual Vite build took 13 seconds. The prepared image targets that setup bottleneck;
image pulls still have a cost and must be measured in Actions.

Map Chrome remains branded Google Chrome, installed separately without Playwright's
OS-dependency installation. Its actual version is fingerprinted before evidence
lookup. Firefox retains Xvfb and software rendering. Safari still runs on macOS.
The Storybook server uses the already-installed Vite package, not Python.

## Cache and artifact boundaries

npm's download cache is keyed by lockfiles. Browser consumers skip workspace
prepare scripts because the same run supplies already-built packages. Build
outputs are transferred only within that workflow run; no downloaded artifacts
from other PRs are executed. The token has read-only contents and Actions access.

Persisted Turbo build caching is intentionally not enabled: the React build also
produces compatibility entrypoints outside its currently declared cache outputs.
Parallel jobs trade additional runner setup for shorter elapsed time. Measure the
new workflow before treating any timing estimate as a demonstrated improvement.
