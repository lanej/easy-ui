import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
const keyFor = (suffix) => {
  const key = Object.keys(manifest).find((key) => key.endsWith(suffix));
  assert.ok(key, `Missing manifest entry: ${suffix}`);
  return key;
};
function assets(roots) {
  const visited = new Set(),
    files = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const item = manifest[key];
    files.add(item.file);
    for (const css of item.css ?? []) files.add(css);
    for (const imported of item.imports ?? []) visit(imported);
  }
  roots.forEach(visit);
  return [...files].sort();
}
const base = [keyFor("comparison.html")];
const shared = new Set(assets(base));
const results = [];
for (const [renderer, roots] of [
  [
    "ECharts 6.1.0",
    [
      keyFor("comparison/EChartsExample.tsx"),
      keyFor("node_modules/echarts/index.js"),
    ],
  ],
  [
    "Recharts 3.10.1 + native matrix",
    [keyFor("comparison/RechartsExample.tsx")],
  ],
]) {
  const files = await Promise.all(
    assets([...base, ...roots]).map(async (file) => {
      const bytes = await readFile(`dist/${file}`);
      return {
        file,
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes).length,
        shared: shared.has(file),
      };
    }),
  );
  const sum = (predicate) =>
    files.filter(predicate).reduce((total, file) => total + file.gzipBytes, 0);
  results.push({
    renderer,
    javascriptGzipBytes: sum((file) => file.file.endsWith(".js")),
    cssGzipBytes: sum((file) => file.file.endsWith(".css")),
    additionalJavascriptGzipBytes: sum(
      (file) => file.file.endsWith(".js") && !file.shared,
    ),
    files,
  });
}
const report = {
  method:
    "Production Vite manifest dependency closures for comparison.html?engine=echarts and ?engine=recharts, all 18 examples. Includes React, shared frame, fixture data, renderer, and integration. Gzip per emitted asset; no double-counted shared chunks. CSS reported separately; fonts excluded. Additional JS is relative to the common comparison shell. This measures transfer size, not runtime performance.",
  results,
};
await writeFile(
  "dist/comparison-bundles.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
