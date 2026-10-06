import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToString } from "react-dom/server";

const require = createRequire(import.meta.url);
const publishedPackage = require("../easy-ui-react/dist/package.json");
assert.equal(publishedPackage.dependencies["maplibre-gl"], "^6.9.0");
assert.equal(publishedPackage.engines.node, ">=22.12.0");
assert.equal(publishedPackage.peerDependencies?.["maplibre-gl"], undefined);
assert.equal(publishedPackage.peerDependenciesMeta?.["maplibre-gl"], undefined);
for (const asset of ["maplibre-gl.css", "maplibre-gl-worker.mjs"]) {
  assert.equal(
    publishedPackage.exports[`./NetworkMap/${asset}`],
    `./NetworkMap/${asset}`,
  );
  assert.match(
    readFileSync(
      new URL(`../easy-ui-react/dist/NetworkMap/${asset}`, import.meta.url),
      "utf8",
    ),
    new RegExp(`maplibre-gl/dist/${asset.replaceAll(".", "\\.")}`),
  );
}
assert.match(
  readFileSync(
    new URL(
      "../easy-ui-react/dist/NetworkMap/maplibre-gl-worker.mjs",
      import.meta.url,
    ),
    "utf8",
  ),
  /self\.worker \?\?= new MapLibreWorker\(self\)/,
);
const props = {
  title: "Server-rendered chart",
  description: "One observed shipment",
  option: { series: [{ type: "bar", data: [1] }] },
  dataTable: { columns: ["Parcels"], rows: [{ id: "one", values: [1] }] },
};
const commonjs = require("../easy-ui-react/dist/Chart/index.js");
const commonjsTheme = require("../easy-ui-react/dist/Theme/index.js");
const esm = await import("../easy-ui-react/dist/Chart/index.mjs");
const esmTheme = await import("../easy-ui-react/dist/Theme/index.mjs");
for (const [chart, theme] of [
  [commonjs, commonjsTheme],
  [esm, esmTheme],
]) {
  const html = renderToString(
    React.createElement(
      theme.ThemeProvider,
      null,
      React.createElement(chart.Chart, props),
    ),
  );
  assert.match(html, /Loading chart/);
  assert.match(html, /<table/);
  assert.match(html, /<td>1<\/td>/);
  const composed = renderToString(
    React.createElement(
      theme.ThemeProvider,
      null,
      React.createElement(
        chart.ChartProvider,
        null,
        React.createElement(chart.ChartHeading, {
          title: "External chart heading",
          titleId: "external-chart-heading",
        }),
        React.createElement(chart.ChartZoomControls),
        React.createElement(chart.ChartSurface, {
          option: props.option,
          "aria-labelledby": "external-chart-heading",
        }),
        React.createElement(chart.ChartDataView, {
          dataTable: props.dataTable,
          "aria-labelledby": "external-chart-heading",
        }),
      ),
    ),
  );
  assert.match(composed, /aria-labelledby="external-chart-heading"/);
  assert.match(composed, /Loading chart/);
  assert.match(composed, /<td>1<\/td>/);
}
for (const [name, nativeProps] of [
  [
    "CompactTimeSeries",
    {
      label: "Native time series",
      description: "Two observations",
      domain: [0, 10],
      formatTime: String,
      series: [
        {
          id: "one",
          label: "Volume",
          points: [
            { time: 0, value: 0 },
            { time: 10, value: 5 },
          ],
        },
      ],
    },
  ],
  [
    "RangePlot",
    {
      label: "Native range",
      description: "One benchmark",
      domain: [-5, 5],
      points: [{ id: "one", label: "Current", value: 0 }],
    },
  ],
]) {
  for (const extension of ["js", "mjs"]) {
    const entry =
      extension === "js"
        ? require(`../easy-ui-react/dist/${name}/index.js`)
        : await import(`../easy-ui-react/dist/${name}/index.mjs`);
    const html = renderToString(React.createElement(entry[name], nativeProps));
    assert.match(html, /<figure/);
    assert.match(html, /Native/);
  }
}
for (const extension of ["js", "mjs"]) {
  const entry =
    extension === "js"
      ? require("../easy-ui-react/dist/NetworkMap/index.js")
      : await import("../easy-ui-react/dist/NetworkMap/index.mjs");
  const html = renderToString(
    React.createElement(entry.NetworkMap, {
      title: "Server-rendered network",
      description: "One observed facility",
      mapStyle: { version: 8, sources: {}, layers: [] },
      workerUrl: "/map-worker.js",
      facilities: [
        {
          id: "one",
          label: "Oakland warehouse",
          kind: "warehouse",
          coordinates: [-122, 38],
        },
      ],
      segments: [],
    }),
  );
  assert.match(html, /Loading map/);
  assert.match(html, /<table/);
  assert.match(html, /Oakland warehouse/);
  const surfaceProps = {
    mapStyle: { version: 8, sources: {}, layers: [] },
    workerUrl: "/map-worker.js",
    "aria-label": "Weather exposure",
  };
  const surface = renderToString(
    React.createElement(entry.NetworkMapSurface, surfaceProps),
  );
  assert.match(surface, /Loading map/);
  assert.match(surface, /Weather exposure/);
  assert.doesNotMatch(surface, /<table|<h[1-6]|Facility risk/);
  const composed = renderToString(
    React.createElement(
      entry.NetworkMapProvider,
      { ...surfaceProps, "aria-labelledby": "external-map-heading" },
      React.createElement("h2", { id: "external-map-heading" }, "Weather"),
      React.createElement(entry.NetworkMapHeading),
      React.createElement(entry.NetworkMapControlPanel),
      React.createElement(entry.NetworkMapSurface),
      React.createElement(entry.NetworkMapSelectionDetails),
      React.createElement(entry.NetworkMapLegend),
      React.createElement(entry.NetworkMapDataView, { expanded: true }),
    ),
  );
  assert.match(composed, /aria-labelledby="external-map-heading"/);
  assert.match(composed, /Loading map/);
  assert.doesNotMatch(composed, /Oakland warehouse|Facility risk/);
}
assert.equal(
  Object.keys(require.cache).some((path) =>
    /node_modules\/maplibre-gl\//.test(path),
  ),
  false,
  "NetworkMap imports and SSR must not eagerly load MapLibre",
);
assert.equal(
  Object.keys(require.cache).some((path) =>
    /node_modules\/(echarts|zrender)\//.test(path),
  ),
  false,
  "Importing/SSR rendering Chart must not eagerly load ECharts",
);
console.log(
  "Chart and NetworkMap packages: CommonJS and ESM imports/SSR passed; engines stay lazy.",
);
