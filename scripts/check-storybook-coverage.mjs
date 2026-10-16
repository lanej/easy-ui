import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// Check the built index: a source story excluded by Storybook's configuration
// does not make a component discoverable in the published catalog.
export async function checkStorybookCoverage(indexPath) {
  const source = resolve(root, "easy-ui-react/src");
  const modules = (await readdir(source, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isDirectory() &&
        /^[A-Z]/.test(entry.name) &&
        existsSync(resolve(source, entry.name, "index.ts")),
    )
    .map((entry) => entry.name)
    .sort();
  const { entries } = JSON.parse(await readFile(indexPath, "utf8"));
  const reference = await readFile(
    resolve(root, "easy-ui-react/skills/easy-ui/references/components.md"),
    "utf8",
  );
  const missing = [];
  for (const name of modules) {
    if (!reference.includes(`\`${name}\``)) {
      missing.push(`${name}: missing skill reference entry`);
    }
    const prefix = `easy-ui-react/src/${name}/`;
    const componentEntries = Object.values(entries).filter((entry) =>
      entry.importPath
        ?.replaceAll("\\", "/")
        .replace(/^\.\//, "")
        .startsWith(prefix),
    );
    for (const type of ["story", "docs"]) {
      if (!componentEntries.some((entry) => entry.type === type)) {
        missing.push(`${name}: missing ${type} entry`);
      }
    }
  }
  const links = [...reference.matchAll(/\?path=\/(story|docs)\/([\w-]+)/g)];
  for (const [, type, id] of links) {
    if (entries[id]?.type !== type) {
      missing.push(`${id}: missing ${type} linked from the skill reference`);
    }
  }
  assert.equal(
    missing.length,
    0,
    `Incomplete Storybook catalog:\n${missing.join("\n")}`,
  );
  console.log(
    `Storybook coverage: ${modules.length}/${modules.length} component modules have stories, docs, and skill entries; ${links.length} skill links resolve.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await checkStorybookCoverage(
    resolve(process.argv[2] ?? "storybook-static/index.json"),
  );
}
