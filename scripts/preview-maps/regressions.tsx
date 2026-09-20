import "./console.mjs";
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "../../.storybook/public/poppins.css";
import "../../easy-ui-react/src/styles/global.scss";
import "./preview.css";
import { NetworkMap } from "../../easy-ui-react/src/NetworkMap";
import type {
  MapFacility,
  MapSurface,
} from "../../easy-ui-react/src/NetworkMap";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";

// This local style needs no tiles, credentials, glyph service, or external data.
const mapStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#fff" },
    },
  ],
};
const facilities: MapFacility[] = [
  { id: "a", label: "Origin", coordinates: [-3, -1], kind: "warehouse" },
  { id: "b", label: "Hub", coordinates: [0, -1], kind: "hub" },
  { id: "c", label: "Destination", coordinates: [3, -1], kind: "destination" },
];
const estimates = [
  { name: "missing", medianMinutes: undefined, n: 10 },
  { name: "null", medianMinutes: null, n: 10 },
  { name: "NaN", medianMinutes: Number.NaN, n: 10 },
  { name: "infinite", medianMinutes: Number.POSITIVE_INFINITY, n: 10 },
  { name: "negative", medianMinutes: -10, n: 10 },
  { name: "no observations", medianMinutes: 30, n: 0 },
  { name: "zero minutes", medianMinutes: 0, n: 10 },
] as const;
const surface: MapSurface = {
  asOf: "2026-09-20T12:00:00Z",
  source: "Synthetic browser regression records",
  cells: estimates.map((estimate, index) => ({
    latMin: 0.2,
    latMax: 0.8,
    lonMin: -4 + index * 1.2,
    lonMax: -3.2 + index * 1.2,
    // Deliberately exercise malformed runtime input from an untyped data feed.
    medianMinutes: estimate.medianMinutes as number | null,
    iqrMinutes: null,
    n: estimate.n,
  })),
};
type RegressionState = {
  map: MapInstance;
  cells: { name: string; center: [number, number] }[];
  zeroPixel?: number[];
  renders: number;
};
declare global {
  interface Window {
    __mapRegression?: RegressionState;
  }
}
function ready(map: MapInstance) {
  const state: RegressionState = {
    map,
    cells: estimates.map((estimate, index) => ({
      name: estimate.name,
      center: [-3.6 + index * 1.2, 0.5],
    })),
    renders: 0,
  };
  window.__mapRegression = state;
  map.setPaintProperty("easy-ui-observed", "line-color", "#ff0099");
  // Read while the drawing buffer is valid. No preserveDrawingBuffer production
  // option is needed, and a pixel inside the cell avoids polygon antialiasing.
  map.on("render", () => {
    state.renders++;
    const canvas = map.getCanvas();
    const gl = canvas.getContext("webgl2");
    if (!gl) return;
    const point = map.project(state.cells[state.cells.length - 1].center);
    const pixel = new Uint8Array(4);
    gl.readPixels(
      Math.floor((point.x * canvas.width) / canvas.clientWidth),
      canvas.height -
        Math.floor((point.y * canvas.height) / canvas.clientHeight) -
        1,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );
    state.zeroPixel = Array.from(pixel);
  });
}
function App() {
  const [selectedSegmentId, select] = useState<string>();
  const [revision, update] = useState(0);
  const [visible, show] = useState(true);
  const segments = useMemo(
    () => [
      {
        id: "ab",
        from: "a",
        to: "b",
        label: `First transfer ${revision}`,
        evidence: "transfer" as const,
        volume: 10 + revision,
      },
      {
        id: "bc",
        from: "b",
        to: "c",
        label: "Second transfer",
        evidence: "transfer" as const,
        volume: 20,
      },
    ],
    [revision],
  );
  return (
    <main className="control">
      <h1>Map rendering regressions</h1>
      <p>
        Synthetic records check custom route styling and unsupported
        delivery-time estimates.
      </p>
      <div className="regression-actions" aria-label="Regression actions">
        <button type="button" onClick={() => select("ab")}>
          Select first connection
        </button>
        <button type="button" onClick={() => select("bc")}>
          Select second connection
        </button>
        <button type="button" onClick={() => update((value) => value + 1)}>
          Update connection data
        </button>
        <button type="button" onClick={() => show((value) => !value)}>
          Toggle surface visibility
        </button>
        <button
          type="button"
          onClick={() => {
            window.__mapRegression?.map.setPaintProperty(
              "easy-ui-observed",
              "line-color",
              null,
            );
            select("bc");
          }}
        >
          Restore automatic route styling
        </button>
      </div>
      <h2>Delivery estimates and route styling</h2>
      <NetworkMap
        title="Rendering test map"
        description="Only the final delivery cell has a supported zero-minute estimate. Its fill should be blue."
        mapStyle={mapStyle}
        workerUrl={workerUrl}
        facilities={facilities}
        segments={segments}
        surface={surface}
        selectedSegmentId={selectedSegmentId}
        initialView={{ center: [0, 0], zoom: 6 }}
        layerVisibility={{ deliverySurface: visible }}
        controls={false}
        showSelectionDetails={false}
        height={420}
        onMapReady={ready}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <ThemeProvider colorScheme="light">
    <App />
  </ThemeProvider>,
);
