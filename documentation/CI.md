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

## Cache downloads; always run component checks

npm's lockfile-keyed download cache avoids repeated package downloads. All five
component browser suites still execute on every CI run, including screenshot-only
changes. No path filters or prior-success bypass can skip them.

Component result reuse was investigated but is not enabled. Storybook writes a
build timestamp, and its TypeScript docgen metadata can change ordering for
identical source. Reusing those results safely needs deterministic builds and live
validation first. The workflow does not weaken asset hashes or guess a component's
transitive dependency closure to force a cache hit.

The existing map and chart preview workflows retain their narrower evidence reuse.
Those proofs include fresh built assets, test/configuration inputs, Node and runner
image, the immutable browser container, and the actual Chrome version where used.
Only recent completed successful runs on the same workflow and PR/ref qualify.
Fork pull requests, manual runs, reruns, missing evidence and lookup failures run
fresh. Evidence expires after seven days; reuse does not extend its expiry.

The map workflow's unchanged-evidence path has been observed skipping Chrome,
Firefox and Safari captures while retaining its layout checks. Package tests, lint,
fresh builds and the required component CI gate remain independent of that reuse.

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
