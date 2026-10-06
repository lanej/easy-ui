import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const preview = process.cwd();
const output = join(preview, ".preview-tokens");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(repository, "easy-ui-tokens/src"), join(output, "src"), {
  recursive: true,
});
await cp(
  join(repository, "easy-ui-tokens/config.mjs"),
  join(output, "config.mjs"),
);
const result = spawnSync(
  process.execPath,
  [
    join(preview, "node_modules/style-dictionary/bin/style-dictionary.js"),
    "build",
    "-c",
    "./config.mjs",
  ],
  { cwd: output, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const tokens = JSON.parse(
  await readFile(join(output, "dist/json/tokens.json"), "utf8"),
);
if (!tokens["theme.dark.color.neutral.000"]) {
  throw new Error("Preview tokens must include the current dark theme");
}
