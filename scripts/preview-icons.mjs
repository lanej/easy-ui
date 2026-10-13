import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Build new catalog symbols for the independent preview before an icon release.
const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const preview = process.cwd();
const require = createRequire(join(preview, "package.json"));
const { transform } = require("@svgr/core");
const jsx = require("@svgr/plugin-jsx");
const output = join(preview, ".preview-icons");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ["Database", "Storage", "Hub", "Remove"]) {
  const config = JSON.parse(
    await readFile(
      join(repository, "easy-ui-icons/src", `${name}.json`),
      "utf8",
    ),
  );
  const svg = await readFile(
    require.resolve(`${config.source}/${config.style}/${config.name}.svg`),
    "utf8",
  );
  const component = await transform(
    svg,
    { plugins: [jsx], dimensions: false, titleProp: true },
    { componentName: name },
  );
  await writeFile(join(output, `${name}.jsx`), component);
}
