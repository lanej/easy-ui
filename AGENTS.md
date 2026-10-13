# Easy UI

## Canonical checkout

Work in `/Users/joshlane/src/easy-ui` on local `main`, tracking `lanej/main`.
`lanej/main` is the canonical branch for updated work. `origin` is EasyPost's
repository; `lanej` is Lane J's fork. Verify the branch, upstream, dirty files,
and live remote state before editing. Update with fast-forward operations;
preserve concurrent edits and unpublished commits.

The separate feature workspaces and their stack coordinator are retired.
Historical files and evidence are archived under
`/Users/joshlane/src/easy-ui-archive/2026-10-08/`. Preserve the shared `.git`
directory, historical refs, untracked files, and referenced package archives.
Do not create a new branch, worktree, or feature stack unless requested.

See [LOCAL-WORKFLOW.md](LOCAL-WORKFLOW.md) for local package and archive details.
The workstream and branch descriptions in `documentation/DEVELOPMENT.md`
are historical; its component and verification guidance still applies.

## Components and verification

Follow the existing React Aria, Sass tokens, TypeScript, Vite, and Vitest patterns.
Read component types and documentation before extending APIs. Applications own
aggregation, units, forecasts, records, and domain interpretation.
Verify affected behavior with the existing checks. Interactive changes need
real browser checks, including relevant themes, narrow layouts, and keyboard
behavior. Package verification uses actual `npm pack` artifacts and
`scripts/check-style-package.mjs`; distinguish package verification from
consumer adoption.

`../easy-ui-pins` stores immutable verified package artifacts. New packages
come from canonical `lanej/main`; follow its README. Preserve the current
verified package until a replacement passes verification. Changing an
application's dependency, lockfile, installation, and receipt is coordinated
with that application's work.

## Automatic PR writing and code review

For every proposed PR creation or revision, invoke `pull-request-writer`
as a separate subagent with the final diff, motivation, repository
requirements, and relevant validation evidence. Wait for its draft,
resolve blockers, and use its title and description.

Invoke `code-reviewer` separately for complex changes: interacting components,
nontrivial algorithms or state transitions, concurrency, migrations,
security-sensitive logic, or uncertainty about correctness. Give it the
changed files and relevant context; keep unrelated work out of scope.
Address actionable findings and have material fixes rechecked before finishing.
Simple, mechanically verifiable changes do not require this review.
These subagents must not invoke further writers or reviewers.

If named custom agents are unavailable, use a generic subagent with instructions
from `~/.codex/agents/<agent-name>.toml` for read-only drafting or review.
Report a delegation gap if neither route is available.

Keep PR descriptions concise: explain the final change, why, and useful result.
Do not duplicate automated checks, test inventories, or implementation history.
Include actual current screenshots only when they help assess a visual change;
use durable image URLs and verify that they render on GitHub.

## Git worktree cleanup

Cleanup of task-owned temporary worktrees, including subagent worktrees, is part
of completion. Record their paths and the starting checkout. Before finishing,
remove each one whose work is safely retained and which no active session,
process, or pending task needs. An open PR alone does not require a checkout.
Preserve detached commits on a named branch or verified remote ref first.

Check `git status --short --untracked-files=all` and valuable ignored files.
Retain worktrees with uncommitted work or needed artifacts unless those files
have been preserved elsewhere. Leave pre-existing, permanent, user-owned, and
other agents' active worktrees alone; age does not prove inactivity.

Move outside the worktree and use `git worktree remove <path>` from a surviving
checkout. Do not force removal or delete branches as a cleanup side effect.
For registrations whose directories are gone, inspect
`git worktree prune --dry-run --verbose` before pruning. Verify with
`git worktree list`. Perform routine authorized cleanup without asking again;
report the path and concrete reason if a task-owned worktree must remain.
