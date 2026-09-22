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
const componentNames = (
  await Promise.all(
    (await readdir(join(source, "src"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(async ({ name }) => {
        try {
          await readFile(join(source, "src", name, "index.ts"));
          return name;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          return null;
        }
      }),
  )
)
  .filter(Boolean)
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

const typeSource = `
import { Chart, ChartLegend } from "@easypost/easy-ui/Chart";
import { NetworkMapCellDetails } from "@easypost/easy-ui/NetworkMap";
import { MetricCard } from "@easypost/easy-ui/MetricCard";
import { ScoreComposition, ScoreSignal, ScoreContribution, ScoreConnector, ScoreResult, type ScoreCompositionProps } from "@easypost/easy-ui/ScoreComposition";
import { Button } from "@easypost/easy-ui/Button";
import { DataGrid } from "@easypost/easy-ui/DataGrid";
import { Select } from "@easypost/easy-ui/Select";
import { SelectField, type BaseSelectFieldProps, type SelectFieldSize } from "@easypost/easy-ui/Select/SelectField";
import type { KeyedSortDescriptor, MenuRowAction } from "@easypost/easy-ui/DataGrid/types";
import type { Heading, IconSymbol } from "@easypost/easy-ui/types";
import { classNames, type ResponsiveProp } from "@easypost/easy-ui/utilities/css";
${componentNames
  .map(
    (name, index) =>
      `import * as Component${index} from "@easypost/easy-ui/${name}";\nvoid Component${index};`,
  )
  .join("\n")}

const sort: KeyedSortDescriptor<"cost"> = { column: "cost", direction: "ascending" };
// @ts-expect-error Generic column keys must retain their declared constraint.
const invalidSort: KeyedSortDescriptor<"cost"> = { column: "missing", direction: "ascending" };
const menu: MenuRowAction = { type: "menu", renderMenuOverlay: () => null };
const size: SelectFieldSize = "md";
const field: BaseSelectFieldProps = { size, validationState: "valid" };
const heading: Heading = "h2";
const icon: IconSymbol = () => null;
const responsive: ResponsiveProp<string> = { sm: "1rem" };
const className: string = classNames("packed", false);

export const example = <>
  <ScoreComposition signals={[{id: "a", label: "Observed", value: true}]} contributions={[{id: "b", label: "Contribution", score: 1, maxScore: 2, signals: ["a"]}]} result={{score: 1, disposition: "Review"}} />
  <ScoreSignal label="Observed" value={false} sentiment="positive" statusLabel="Clear" labels={{positiveSignal: "Favorable"}} />
  <ScoreContribution label="Contribution" score={0} maxScore={1} sentiment="warning" labels={{fullContribution: "Full"}} sourceLabels={["Observed"]} />
  <ScoreResult score={null} />
  <svg><ScoreConnector from={{x: 0, y: 0}} to={{x: 20, y: 10}} /></svg>
  <ChartLegend items={[{name: "Ground", color: "#007f86", selected: true, symbol: "bar"}]} onItemToggle={(name: string) => { void name; }} />
  <NetworkMapCellDetails cell={{latMin: 0, latMax: 1, lonMin: 0, lonMax: 1, medianMinutes: 20, iqrMinutes: 4, n: 80}} surface={{cells: [], source: "Packed sample", asOf: "2026-09-22T00:00:00Z"}}>
    <strong>Application chart</strong>
  </NetworkMapCellDetails>
  <Chart title="Packed chart" option={{ series: [{ type: "bar", data: [1] }] }} dataTable={{ columns: ["Count"], rows: [{ id: "one", values: [1] }], columnOptions: {0: {isNumeric: true, minWidth: 160, allowsSorting: true, getSortValue: (value) => value}}, maxHeight: "none", pinnedColumnCount: 1, stickyHeader: true, sortDescriptor: null, onSortChange: (next) => { const column: number | undefined = next?.column; void column; }, renderCell: (value, index, row) => typeof value === "number" ? <strong title={row.id + index}>{value.toFixed(2)}</strong> : null }} />
  <MetricCard label="Packed metric" value="1" />
  <Button onPress={() => undefined}>Packed button</Button>
  <DataGrid
    aria-label="Packed data"
    columns={[{ key: "cost", label: "Cost" }]}
    rows={[{ key: "one", cost: 1 }]}
    columnOptions={{ cost: { isNumeric: true, whiteSpace: "normal", minWidth: 100 } }}
    renderColumnCell={(column) => column.label}
    renderRowCell={(value) => String(value)}
  />
</>;
void [Select, SelectField, sort, invalidSort, menu, field, heading, icon, responsive, className];
const scoreProps: ScoreCompositionProps = {signals: [], contributions: [], result: {score: null}};
void scoreProps;
${["Chart", "MetricCard", "Button", "DataGrid"]
  .map(
    (name) =>
      `// @ts-expect-error ${name} exposes named exports, without a default export.\nComponent${componentNames.indexOf(name)}.default;`,
  )
  .join("\n")}
`;

// Write this runner inside each installed consumer: cwd alone does not isolate
// static imports or createRequire from the repository's dependencies.
const runner = String.raw`
import assert from "node:assert/strict";
import { readFileSync, realpathSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import * as sass from "sass";
import { build } from "vite";
import ts from "typescript";

const require = createRequire(import.meta.url);
const insideConsumer = (file) => {
  const path = realpathSync(file);
  assert.ok(!relative(process.cwd(), path).startsWith(".."), "Dependency escaped isolated consumer: " + path);
  return path;
};
for (const subpath of ["Chart", "Chart/index", "MetricCard", "Sparkline", "NetworkMap", "ScoreComposition", "utilities/css"]) {
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
  const { ScoreComposition } = await load("@easypost/easy-ui/ScoreComposition");
  const score = renderToString(React.createElement(ScoreComposition, {
    signals: [{id: "a", label: "Observed input", value: false}],
    contributions: [{id: "b", label: "Contribution", score: 1, maxScore: 2, signals: ["a"]}],
    result: {score: 9, disposition: "Application decision"}
  }));
  assert.match(score, /Observed input/);
  assert.match(score, /9.00/);
  assert.match(score, /Application decision/);
  // The outcome icon renders on the server; measured connectors do not.
  assert.equal((score.match(/<svg/g) || []).length, 1);
  assert.match(score, /<svg[^>]*aria-hidden="true"/);
  const { ThemeProvider } = await load("@easypost/easy-ui/Theme");
  const { Chart, ChartLegend } = await load("@easypost/easy-ui/Chart");
  const key = renderToString(React.createElement(ChartLegend, {
    items: [{ name: "Ground", color: "#007f86", selected: true }],
    onItemToggle: () => {},
  }));
  assert.match(key, /aria-pressed="true"/);
  assert.match(key, /Ground/);
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Chart, {
    title: "Packed chart", option: { series: [{ type: "bar", data: [1] }] },
    dataTable: { columns: ["Count"], rows: [{ id: "one", values: [1] }] }
  })));
  assert.match(html, /Packed chart/);
  assert.match(html, /<td>1<\/td>/);
  const { ChartDataView } = await load("@easypost/easy-ui/Chart");
  const richData = renderToString(React.createElement(ChartDataView, {
    dataTable: { columns: ["Count"], rows: [{ id: "ten", values: [10] }, { id: "one", values: [1] }],
      columnOptions: { 0: { allowsSorting: true } }, defaultSortDescriptor: { column: 0, direction: "ascending" },
      renderCell: (value) => React.createElement("strong", null, value.toFixed(2)) }
  }));
  assert.match(richData, /<strong>1.00<\/strong>/);
  assert.ok(richData.indexOf("<strong>1.00") < richData.indexOf("<strong>10.00"));
  assert.match(richData, /aria-sort="ascending"/);
  const { NetworkMapCellDetails } = await load("@easypost/easy-ui/NetworkMap");
  const inspector = renderToString(React.createElement(NetworkMapCellDetails, {
    cell: {latMin: 0, latMax: 1, lonMin: 0, lonMax: 1, medianMinutes: 20, iqrMinutes: 4, n: 80},
    surface: {cells: [], source: "Packed sample", asOf: "2026-09-22T00:00:00Z"}
  }, React.createElement("strong", null, "Application chart")));
  assert.match(inspector, /Application chart/);
  assert.match(inspector, /Packed sample/);
  assert.doesNotMatch(inspector, /Distribution not supplied/);
}
const expected = JSON.parse(readFileSync("expected-styles.json", "utf8"));
for (const subpath of ["style.css", ...expected.map((name) => "styles/" + name)]) {
  const specifier = "@easypost/easy-ui/" + subpath;
  assert.equal(insideConsumer(require.resolve(specifier)), insideConsumer(fileURLToPath(import.meta.resolve(specifier))));
}
const manifest = require("@easypost/easy-ui/package.json");
assert.ok(manifest.sideEffects.includes("**/*.scss"));
assert.ok(manifest.sideEffects.includes("**/*.css"));

const typeExpected = JSON.parse(readFileSync("expected-types.json", "utf8"));
const packageDirectory = dirname(insideConsumer(require.resolve("@easypost/easy-ui/package.json")));
const canonicalDirectory = typeExpected.mode === "source" ? join(packageDirectory, "dist") : packageDirectory;
const publicDeclarations = typeExpected.declarations.map((file) => insideConsumer(join(packageDirectory, file)));
assert.ok(publicDeclarations.length >= typeExpected.components.length, "Published declaration entry points are missing");
const typeResults = [];
for (const [name, moduleResolution, module] of [
  ["node", ts.ModuleResolutionKind.Node10, ts.ModuleKind.CommonJS],
  ["bundler", ts.ModuleResolutionKind.Bundler, ts.ModuleKind.ESNext],
]) {
  const options = { target: ts.ScriptTarget.ES2020, module, moduleResolution, jsx: ts.JsxEmit.ReactJSX, strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, types: ["react", "react-dom"] };
  const fixture = resolve("consumer-types.tsx");
  const resolvedEntry = (specifier, containingFile = fixture) => {
    const result = ts.resolveModuleName(specifier, containingFile, options, ts.sys).resolvedModule;
    assert.ok(result, name + " failed to resolve " + specifier + " from " + containingFile);
    return insideConsumer(result.resolvedFileName);
  };
  const resolvedRelative = (specifier, containingFile) => {
    // Sass/CSS side-effect imports remain in a few declarations. They are
    // assets for the bundler, not TypeScript modules, and must exist in-package.
    if (/\.(?:s[ac]ss|css)$/.test(specifier)) return insideConsumer(resolve(dirname(containingFile), specifier));
    return resolvedEntry(specifier, containingFile);
  };
  const canonicalEntries = typeExpected.components.map((component) => insideConsumer(join(canonicalDirectory, component, "index.d.ts")));
  const publicEntries = typeExpected.components.map((component) => resolvedEntry("@easypost/easy-ui/" + component));
  let relativeTargets = 0;
  for (const file of publicDeclarations) {
    const subpath = relative(packageDirectory, file).split("\\").join("/").replace(/\.d\.ts$/, "");
    resolvedEntry("@easypost/easy-ui/" + subpath);
    // Check every generated forwarding target without adding shipped story or
    // test declarations to the application's typechecked imports.
    for (const imported of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      if (!imported.fileName.startsWith(".")) continue;
      resolvedRelative(imported.fileName, file);
      relativeTargets++;
    }
  }
  const program = ts.createProgram([fixture, ...canonicalEntries], options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, name + " consumer typecheck failed:\n" + ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (file) => file, getNewLine: () => "\n" }));
  const checker = program.getTypeChecker();
  const exportedNames = (file) => {
    const declaration = program.getSourceFile(file);
    assert.ok(declaration, "TypeScript did not load " + file);
    const symbol = checker.getSymbolAtLocation(declaration);
    assert.ok(symbol, "Declaration is not an exported module: " + file);
    return checker.getExportsOfModule(symbol).map((entry) => entry.getName()).sort();
  };
  for (let index = 0; index < typeExpected.components.length; index++) {
    const expectedNames = exportedNames(canonicalEntries[index]);
    assert.ok(expectedNames.length > 0, "Empty component namespace: " + typeExpected.components[index]);
    assert.deepEqual(exportedNames(publicEntries[index]), expectedNames, name + " changed the exports of " + typeExpected.components[index]);
  }
  // skipLibCheck intentionally ignores third-party declaration diagnostics, so
  // separately resolve every relative edge of Easy UI's loaded declarations.
  for (const file of program.getSourceFiles()) {
    if (!file.isDeclarationFile || relative(packageDirectory, file.fileName).startsWith("..")) continue;
    insideConsumer(file.fileName);
    for (const imported of ts.preProcessFile(file.text, true, true).importedFiles) {
      if (!imported.fileName.startsWith(".")) continue;
      resolvedRelative(imported.fileName, file.fileName);
      relativeTargets++;
    }
  }
  assert.ok(relativeTargets > 0, "No declaration forwarding targets were checked");
  typeResults.push({ resolution: name, components: typeExpected.components.length, declarations: publicDeclarations.length, relativeTargets });
}

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
console.log(JSON.stringify({ sassFiles: expected.length, cssBytes: css.length, productionCssBytes: bundledCss.length, publicImports: "CJS + ESM + SSR passed", typescript: ts.version, typeConsumers: typeResults }));
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
    assert.equal(
      packed.files.some(({ path }) => path.startsWith("src/")),
      false,
      "Tarball unexpectedly includes repository source files",
    );
    const compatibility = JSON.parse(
      await readFile(join(source, ".compatibility-entries.json"), "utf8"),
    );
    assert.equal(compatibility.version, 1);
    for (const entry of compatibility.files) {
      assert.ok(entry.source.startsWith("dist/"));
      const expectedPaths =
        mode === "source"
          ? [entry.path, entry.source]
          : [entry.source.slice("dist/".length)];
      for (const path of expectedPaths)
        assert.ok(
          packed.files.some((file) => file.path === path),
          "Tarball missing compatibility entry: " + mode + "/" + path,
        );
    }
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
            react: "18.3.1",
            "react-dom": "18.3.1",
            "react-is": "18.3.1",
            "@types/react": "18.3.3",
            "@types/react-dom": "18.3.0",
            typescript: "5.7.3",
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
    await writeFile(join(consumer, "consumer-types.tsx"), typeSource);
    await writeFile(
      join(consumer, "expected-types.json"),
      JSON.stringify({
        mode,
        components: componentNames,
        declarations: compatibility.files
          .filter((entry) => entry.path.endsWith(".d.ts"))
          .map((entry) => entry.path),
      }),
    );
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
