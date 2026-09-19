import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const marker = "# Managed by easy-ui: full repository lint before committing.";
const log = (message) => console.log(`Git hooks: ${message}`);

function install() {
  // Package consumers and CI should not have their Git configuration changed.
  if (process.env.CI || !existsSync(resolve(root, ".git"))) return;

  const git = (...args) =>
    spawnSync("git", args, { cwd: root, encoding: "utf8" });
  const customPath = git("config", "--get", "core.hooksPath");
  if (customPath.status === 0) {
    log(
      "keeping your configured core.hooksPath; add npm run lint to that hook.",
    );
    return;
  }
  if (customPath.status !== 1) {
    throw new Error("Unable to inspect Git hook configuration.");
  }

  // Git resolves the shared hooks directory for linked worktrees as well.
  const result = git("rev-parse", "--git-path", "hooks/pre-commit");
  if (result.status !== 0) {
    throw new Error("Unable to locate this repository's Git hooks directory.");
  }
  const destination = resolve(root, result.stdout.trim());
  let existing;
  try {
    existing = lstatSync(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (
    existing &&
    (!existing.isFile() ||
      readFileSync(destination, "utf8").split("\n")[1] !== marker)
  ) {
    log(
      "keeping your existing pre-commit hook; add npm run lint to that hook.",
    );
    return;
  }

  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    readFileSync(resolve(root, ".githooks/pre-commit")),
    { flag: existing ? "w" : "wx", mode: 0o755 },
  );
  chmodSync(destination, 0o755);
  log("installed full repository lint for every commit.");
}

install();
