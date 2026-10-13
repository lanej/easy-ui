# Local Easy UI workflow

Updated October 13, 2026.

The active source is this checkout, on `main` tracking `lanej/main`.
Use normal Git operations here; the feature-stack coordinator is retired.

## Packages

[`../easy-ui-pins/current.json`](../easy-ui-pins/current.json) selects the verified package through `latest` → `pins[latest]`.
Use its exact filename and recorded companion icons package.
Follow the [pin README](../easy-ui-pins/README.md) when building replacements from verified canonical main.
Advance the catalog after packed-package verification; retain the recorded rollback package.
Verify consumer upgrades separately in each application.

## Local files

Track repository guidance in `AGENTS.md` and this file.
Keep local drafts under ignored `.local-artifacts/`.
The unrelated review draft is preserved at `.local-artifacts/untracked-2026-10-13/code-review-guidelines.md`.
Generated browser reports remain under ignored `scripts/preview-maps/screenshots/`.

## Historical workspace

The verified `../easy-ui-archive-2026-10-08.tar.zst` preserves the retired workspace.
It excludes Git bundles and rebuildable `node_modules` installations.
Historical branches and the shared Git object store remain in this repository.
Small artifacts and text references remain expanded under `../easy-ui-archive/2026-10-08/workspace`.
Follow the [archive README](../easy-ui-archive/2026-10-08/README.md) to restore files into a separate scratch directory.

Original package sidecars retain their recorded evidence paths. Resolve the
old `/Users/joshlane/src/easy-ui-worktrees/` prefix through
[`../easy-ui-pins/evidence-relocations.json`](../easy-ui-pins/evidence-relocations.json).
