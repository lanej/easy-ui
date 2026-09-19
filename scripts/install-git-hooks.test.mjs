import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fixture(t, { initialize = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "easy-ui-git-hooks-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".githooks"));
  mkdirSync(join(root, "scripts"));
  for (const path of [
    ".githooks/pre-commit",
    "scripts/install-git-hooks.mjs",
  ]) {
    copyFileSync(join(source, path), join(root, path));
  }
  const run = (command, args, env = {}) =>
    spawnSync(command, args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: join(root, "no-global-config"),
        ...env,
      },
    });
  const git = (...args) => run("git", args);
  const install = (env) =>
    run(process.execPath, ["scripts/install-git-hooks.mjs"], env);
  if (initialize) {
    assert.equal(git("init", "-q").status, 0);
    git("config", "user.name", "Hook test");
    git("config", "user.email", "hook-test@example.invalid");
  }
  const hook = join(root, ".git/hooks/pre-commit");
  return { root, hook, run, git, install };
}

test("blocks commits on lint failure and preserves staged and unstaged files", (t) => {
  const { root, git, install } = fixture(t);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ scripts: { lint: "node lint.cjs" } }),
  );
  writeFileSync(
    join(root, "lint.cjs"),
    'const fs = require("node:fs"); fs.writeFileSync("lint-ran", process.cwd()); process.exit(Number(fs.readFileSync("lint-status", "utf8")));',
  );
  writeFileSync(join(root, "lint-status"), "1");
  writeFileSync(join(root, "README.md"), "staged documentation\n");
  assert.equal(git("add", "README.md").status, 0);
  writeFileSync(join(root, "README.md"), "unstaged documentation\n");
  assert.equal(install().status, 0);

  const rejected = git("commit", "-m", "Must fail lint");
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stdout + rejected.stderr, /npm run lint|node lint.cjs/);
  assert.equal(git("rev-parse", "--verify", "HEAD").status, 128);
  assert.equal(git("show", ":README.md").stdout, "staged documentation\n");
  assert.equal(
    readFileSync(join(root, "README.md"), "utf8"),
    "unstaged documentation\n",
  );
  assert.equal(readFileSync(join(root, "lint-ran"), "utf8"), root);

  writeFileSync(join(root, "lint-status"), "0");
  const accepted = git("commit", "-m", "Lint passes");
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  assert.equal(git("show", "HEAD:README.md").stdout, "staged documentation\n");
  assert.equal(
    readFileSync(join(root, "README.md"), "utf8"),
    "unstaged documentation\n",
  );
});

test("installs an executable hook and refreshes only its own managed hook", (t) => {
  const { hook, install } = fixture(t);
  assert.equal(install().status, 0);
  const expected = readFileSync(join(source, ".githooks/pre-commit"), "utf8");
  assert.equal(readFileSync(hook, "utf8"), expected);
  if (process.platform !== "win32") assert.ok(statSync(hook).mode & 0o111);
  writeFileSync(hook, expected + "# previous managed version\n");
  assert.equal(install().status, 0);
  assert.equal(readFileSync(hook, "utf8"), expected);
});

test("preserves an existing custom pre-commit hook", (t) => {
  const { hook, install } = fixture(t);
  const custom = "#!/bin/sh\necho custom-hook\n";
  writeFileSync(hook, custom);
  const result = install();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /keeping your existing pre-commit hook/);
  assert.equal(readFileSync(hook, "utf8"), custom);
});

test("respects a configured hooks directory", (t) => {
  const { root, hook, git, install } = fixture(t);
  git("config", "core.hooksPath", "custom-hooks");
  const result = install();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /keeping your configured core.hooksPath/);
  assert.equal(existsSync(hook), false);
  assert.equal(existsSync(join(root, "custom-hooks")), false);
});

test("skips installation in CI and source archives without Git metadata", (t) => {
  const repo = fixture(t);
  assert.equal(repo.install({ CI: "true" }).status, 0);
  assert.equal(existsSync(repo.hook), false);
  const archive = fixture(t, { initialize: false });
  assert.equal(archive.install().status, 0);
  assert.equal(existsSync(join(archive.root, ".git")), false);
});

test("installs in the shared hooks directory from a linked worktree", (t) => {
  const { root, hook, git, run } = fixture(t);
  git("add", ".githooks", "scripts");
  assert.equal(git("commit", "-m", "Fixture").status, 0);
  const worktree = join(root, "linked-worktree");
  assert.equal(git("worktree", "add", "-b", "linked", worktree).status, 0);
  const result = run(process.execPath, [
    join(worktree, "scripts/install-git-hooks.mjs"),
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(hook, "utf8"),
    readFileSync(join(source, ".githooks/pre-commit"), "utf8"),
  );
});
