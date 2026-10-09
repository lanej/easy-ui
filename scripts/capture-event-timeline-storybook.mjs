// The on-branch Storybook proof has already generated the committed screenshots.
// Re-run the already-available branch-checkout workflow to verify the current
// source while GitHub is not creating new pull_request check runs for this SHA.
import { execFileSync } from "node:child_process";

const tasks = [
  ["npm", ["run", "build"]],
  ["node", ["scripts/check-chart-package.mjs"]],
  ["node", ["scripts/check-style-package.mjs"]],
  ["node", ["--test", "scripts/generateCompatibilityEntries.test.mjs"]],
  ["node", ["--test", "scripts/browser-proof.test.mjs"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "build:docs"]],
  ["node", ["scripts/check-docs-site.mjs"]],
];

for (const [command, args] of tasks) {
  process.stdout.write(`\nVerifying current branch: ${command} ${args.join(" ")}\n`);
  execFileSync(command, args, {
    cwd: new URL("../", import.meta.url),
    stdio: "inherit",
    env: process.env,
  });
}
