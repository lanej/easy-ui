import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanPkgJsonForDist } from "./copyDistFiles.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(repository, "easy-ui-react");
const distribution = join(source, "dist");
const scratch = await mkdtemp(join(tmpdir(), "easy-ui-style-package-"));
const cache =
  process.env.npm_config_cache ?? join(tmpdir(), "easy-ui-npm-cache");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
const sassFiles = (await readdir(join(source, "src/styles")))
  .filter((file) => file.endsWith(".scss"))
  .sort();
await readFile(join(distribution, "style.css")); // Run the package build first.

// Other workspaces keep their existing distribution metadata behavior.
const metadata = JSON.stringify({
  name: "other-workspace",
  files: ["dist"],
  scripts: {},
  devDependencies: {},
  publishConfig: { directory: "dist" },
  exports: { "./*": "./dist/*" },
});
assert.deepEqual(JSON.parse(cleanPkgJsonForDist(metadata)), {
  name: "other-workspace",
});
assert.deepEqual(
  JSON.parse(cleanPkgJsonForDist(metadata, { preserveExports: true })).exports,
  { "./*": "./*" },
);

const sassSource = `
@use "pkg:@easypost/easy-ui/styles/common" as ui;
@use "pkg:@easypost/easy-ui/styles/global";
@use "pkg:@easypost/easy-ui/styles/unstyled";
.sass-smoke {
  color: ui.design-token("color.blue.800");
  @include ui.component-token("sass.smoke", "font_size", 1rem);
  @include ui.font-style("body1");
  @include ui.breakpoint-sm-up { display: grid; }
  @include ui.responsive-prop("sass-smoke", "padding", "padding");
}
.sass-hidden { @include ui.visually-hidden; }
.sass-button { @include unstyled.button; }
`;

// Write this runner inside each installed consumer: cwd alone does not isolate
// static imports or createRequire from the repository's dependencies.
const runner = String.raw`
import assert from "node:assert/strict";
import { readFileSync, realpathSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import * as sass from "sass";
import { build } from "vite";

const require = createRequire(import.meta.url);
const insideConsumer = (file) => {
  const path = realpathSync(file);
  assert.ok(!relative(process.cwd(), path).startsWith(".."), "Dependency escaped isolated consumer: " + path);
  return path;
};
for (const subpath of ["Chart", "Chart/index", "MetricCard", "Sparkline", "NetworkMap", "utilities/css"]) {
  const specifier = "@easypost/easy-ui/" + subpath;
  insideConsumer(require.resolve(specifier));
  insideConsumer(fileURLToPath(import.meta.resolve(specifier)));
  const cjs = require(specifier);
  const esm = await import(specifier);
  assert.ok(Object.keys(cjs).length > 0);
  assert.ok(Object.keys(esm).length > 0);
}
for (const subpath of ["Chart/index.js", "Chart/index.mjs", "utilities/css.js", "utilities/css.mjs"]) {
  insideConsumer(require.resolve("@easypost/easy-ui/" + subpath));
  await import("@easypost/easy-ui/" + subpath);
}
for (const load of [require, (specifier) => import(specifier)]) {
  const { ThemeProvider } = await load("@easypost/easy-ui/Theme");
  const { Chart } = await load("@easypost/easy-ui/Chart");
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Chart, {
    title: "Packed chart", option: { series: [{ type: "bar", data: [1] }] },
    dataTable: { columns: ["Count"], rows: [{ id: "one", values: [1] }] }
  })));
  assert.match(html, /Packed chart/);
  assert.match(html, /<td>1<\/td>/);
}
const expected = JSON.parse(readFileSync("expected-styles.json", "utf8"));
for (const subpath of ["style.css", ...expected.map((name) => "styles/" + name)]) {
  const specifier = "@easypost/easy-ui/" + subpath;
  assert.equal(insideConsumer(require.resolve(specifier)), insideConsumer(fileURLToPath(import.meta.resolve(specifier))));
}
const manifest = require("@easypost/easy-ui/package.json");
assert.ok(manifest.sideEffects.includes("**/*.scss"));
assert.ok(manifest.sideEffects.includes("**/*.css"));

const dependencyImporter = {
  findFileUrl(url) {
    if (url.startsWith(".") || url.includes(":")) return null;
    for (const suffix of ["", ".scss", ".sass", ".css"]) {
      try { return pathToFileURL(insideConsumer(require.resolve(url + suffix))); }
      catch (error) { if (error.code !== "MODULE_NOT_FOUND" && error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error; }
    }
    return null;
  }
};
const result = sass.compile("consumer.scss", {
  importers: [new sass.NodePackageImporter(process.cwd()), dependencyImporter]
});
const loaded = result.loadedUrls.map((url) => insideConsumer(fileURLToPath(url)));
for (const file of expected) assert.ok(loaded.some((path) => path.endsWith("/styles/" + file)), "Sass dependency not exercised: " + file);
const css = result.css;
assert.match(css, /\.sass-smoke\s*\{[^}]*color:\s*var\(--ezui-color-blue-800\)/);
assert.match(css, /--ezui-c-sass-smoke-font-size:\s*1rem/);
assert.match(css, /--ezui-c-sass-smoke-padding-xxl/);
assert.match(css, /\.sass-hidden\s*\{[^}]*position:\s*absolute/);
assert.match(css, /\.sass-button\s*\{[^}]*appearance:\s*none/);
assert.match(css, /Poppins Fallback/);
assert.match(css, /\[data-overlayscrollbars/);
assert.match(css, /\.os-scrollbar\.ezui-os-theme-overlay/);
assert.match(css, /--ezui-color-blue-800:\s*#061340/i);

// A real production bundler must retain side-effect-only SCSS imports. This
// entry deliberately never imports the compiled Easy UI style.css.
await build({ configFile: false, root: process.cwd(), logLevel: "error", build: { outDir: "consumer-build", lib: { entry: resolve("consumer.js"), formats: ["es"], fileName: "consumer", cssFileName: "consumer" } } });
const bundledCss = readFileSync("consumer-build/consumer.css", "utf8");
assert.match(bundledCss, /Poppins Fallback/);
assert.match(bundledCss, /--ezui-color-blue-800:\s*#061340/i);
assert.match(bundledCss, /\.os-scrollbar\.ezui-os-theme-overlay/);
assert.match(bundledCss, /\.bundled-sass-smoke\s*\{[^}]*color:var\(--ezui-color-blue-800\)/);
assert.ok(readdirSync("node_modules/@easypost/easy-ui").includes("package.json"));
console.log(JSON.stringify({ sassFiles: expected.length, cssBytes: css.length, productionCssBytes: bundledCss.length, publicImports: "CJS + ESM + SSR passed" }));
`;

try {
  for (const [mode, packageRoot] of [
    ["source", source],
    ["publish-directory", distribution],
  ]) {
    const folder = join(scratch, mode);
    const consumer = join(folder, "consumer");
    await mkdir(consumer, { recursive: true });
    const pack = spawnSync(
      npm,
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        folder,
        "--cache",
        cache,
      ],
      { cwd: packageRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    await writeFile(join(folder, "pack.stdout.log"), pack.stdout ?? "");
    await writeFile(join(folder, "pack.stderr.log"), pack.stderr ?? "");
    if (pack.error) throw pack.error;
    assert.equal(pack.status, 0, "npm pack failed; inspect logs in " + folder);
    // npm 10 may run prepare despite --ignore-scripts, writing lifecycle output
    // before its final JSON array. Keep those logs and parse the trailing result.
    const jsonStart = pack.stdout.lastIndexOf("\n[");
    const packed = JSON.parse(pack.stdout.slice(jsonStart + 1))[0];
    await writeFile(join(folder, "pack.json"), JSON.stringify(packed, null, 2));
    const prefix = mode === "source" ? "dist/" : "";
    for (const file of sassFiles)
      assert.ok(
        packed.files.some(({ path }) => path === prefix + "styles/" + file),
        "Tarball missing Sass: " + mode + "/" + file,
      );
    for (const file of [
      "style.css",
      "Chart/index.js",
      "Chart/index.mjs",
      "Chart/index.d.ts",
      "types.d.ts",
    ])
      assert.ok(
        packed.files.some(({ path }) => path === prefix + file),
        "Tarball missing built entry: " + file,
      );
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify(
        {
          private: true,
          type: "module",
          dependencies: {
            "@easypost/easy-ui": "file:" + join(folder, packed.filename),
            react: "19.0.0",
            "react-dom": "19.0.0",
            "react-is": "19.0.0",
            sass: "1.89.2",
            vite: "6.3.5",
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(consumer, "expected-styles.json"),
      JSON.stringify(sassFiles),
    );
    await writeFile(join(consumer, "consumer.scss"), sassSource);
    await writeFile(
      join(consumer, "consumer.js"),
      'import "@easypost/easy-ui/styles/global.scss"; import "./bundled.scss"; export const compiled = true;',
    );
    await writeFile(
      join(consumer, "bundled.scss"),
      '@use "@easypost/easy-ui/styles/common" as ui; @use "@easypost/easy-ui/styles/token-helpers" as tokens; .bundled-sass-smoke { color: tokens.design-token("color.blue.800"); @include ui.breakpoint-sm-up { display: grid; } }',
    );
    await writeFile(join(consumer, "check.mjs"), runner);
    await writeFile(
      join(folder, "install.log"),
      run(
        npm,
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--cache",
          cache,
        ],
        consumer,
      ),
    );
    const output = run(process.execPath, ["check.mjs"], consumer);
    await writeFile(join(folder, "result.log"), output);
    console.log(mode + ": " + output.trim());
  }
  console.log("Packed consumer evidence: " + scratch);
} catch (error) {
  console.error("Packed consumer failed; evidence retained at " + scratch);
  throw error;
}
