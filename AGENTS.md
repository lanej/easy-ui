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
Expanded drawers add information. Do not repeat the identity, status pills,
icons, identifiers, or summary metrics already visible in the originating row
as a second header or summary block inside its drawer. Preserve information
that the row does not display.

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

## Storybook and the installable skill

Keep public APIs, Storybook, and the installable skill current in the same change.
The skill source is `easy-ui-react/skills/easy-ui/SKILL.md`; its component catalog
is `easy-ui-react/skills/easy-ui/references/components.md`. Keep the skill's main
instructions concise and put component selection, composition, and example links
in the reference. Check exported types before documenting an import or prop.

For added or changed public behavior, update the component's MDX and relevant
stories under `easy-ui-react/src/<Name>/`. Include the smallest useful example
and affected states or interactions. Preserve the standard Usage, Props, and
Examples sections. Update removed APIs and migration guidance in the reference;
do not leave removed components listed as available.

Build Storybook and run `npm run check:storybook` (pass an alternate built
`index.json` after `--` when needed). This checks every public component module
for stories, docs, and a skill entry, and resolves the reference's Storybook links.
Review behavioral coverage as well: module presence alone does not demonstrate
a new prop or interaction. Skill-only changes must also pass this check.

After changing the skill, rebuild the React package and run
`node scripts/check-style-package.mjs`. It checks the actual packed skill and
reference against source, package exports, and installation behavior. Edit the
source skill rather than generated package copies or installed symlinks, and
retain the changes in Git. When checking published examples, compare
`https://lanej.io/easy-ui/revision.txt` with the intended source revision.

## Automatic PR writing and code review

For every PR creation, resubmission, or description update, load and follow the
project [pr-screenshots skill](.agents/skills/pr-screenshots/SKILL.md).
Embed current, inspected screenshots in the PR body, including for package,
build, documentation, and tooling changes. This requirement also applies when
the behavior under review needs nonvisual test evidence.

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
Include actual current screenshots using immutable image URLs and verify that
they render on GitHub. Follow the project skill for capture provenance and
nonvisual changes; do not silently omit screenshots.

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
