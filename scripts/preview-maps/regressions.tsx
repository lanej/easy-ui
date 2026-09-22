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
import {
  CellChartExample,
  inspectionObservations,
  inspectionSurface,
} from "../../easy-ui-react/src/NetworkMap/NetworkMapInspection.examples";

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
const inspectionMode = new URLSearchParams(window.location.search).has(
  "inspection",
);
const chartsMode =
  inspectionMode && new URLSearchParams(window.location.search).has("charts");
const surface: MapSurface = {
  asOf: "2026-09-20T12:00:00Z",
  source: "Synthetic browser regression records",
  cells: inspectionMode
    ? inspectionSurface.cells
    : estimates.map((estimate, index) => ({
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
    cells: inspectionMode
      ? surface.cells.map((cell, index) => ({
          name: index === 0 ? "supplied distribution" : "summary only",
          center: [
            (cell.lonMin + cell.lonMax) / 2,
            (cell.latMin + cell.latMax) / 2,
          ] as [number, number],
        }))
      : estimates.map((estimate, index) => ({
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
  const [large, setLarge] = useState(false);
  const typography = large
    ? { title: 22, description: 18, label: 16, detail: 16, control: 18 }
    : undefined;
  const observations = useMemo(
    () => [...inspectionObservations, ...Array<number>(revision).fill(45)],
    [revision],
  );
  const displayedSurface = useMemo(
    () =>
      inspectionMode
        ? {
            ...surface,
            cells: surface.cells.map((cell) => ({
              ...cell,
              n: cell.n + revision,
            })),
          }
        : surface,
    [revision],
  );
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
    <main className={chartsMode ? "control inspection-preview" : "control"}>
      <h1>
        {inspectionMode
          ? "Inspect delivery-time distributions"
          : "Map rendering regressions"}
      </h1>
      <p>
        {inspectionMode
          ? "Hover a cell, or click or tap to keep its detail open. The left cell has a supplied distribution; the right cell has summary values only. All records are synthetic."
          : "Synthetic records check custom route styling and unsupported delivery-time estimates."}
      </p>
      {inspectionMode && (
        <p>
          <a href={chartsMode ? "?inspection=1" : "?inspection=1&charts=1"}>
            {chartsMode
              ? "Review the default range summary"
              : "Explore histogram, density, and history inside the inspector"}
          </a>
          {chartsMode &&
            " · Pin a cell, then change Chart view. The same charts are available in Inspect cell below the map."}
        </p>
      )}
      <div className="regression-actions" aria-label="Regression actions">
        <button type="button" onClick={() => select("ab")}>
          Select first connection
        </button>
        <button type="button" onClick={() => select("bc")}>
          Select second connection
        </button>
        <button type="button" onClick={() => update((value) => value + 1)}>
          {inspectionMode ? "Refresh cell records" : "Update connection data"}
        </button>
        {inspectionMode && (
          <button type="button" onClick={() => setLarge(!large)}>
            Toggle large text
          </button>
        )}
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
        description={
          inspectionMode
            ? "Inspect the median, spread, observation count, and source."
            : "Only the final delivery cell has a supported zero-minute estimate. Its fill should be blue."
        }
        mapStyle={mapStyle}
        workerUrl={workerUrl}
        facilities={facilities}
        segments={segments}
        surface={displayedSurface}
        selectedSegmentId={selectedSegmentId}
        initialView={{ center: [0, 0], zoom: 6 }}
        layerVisibility={{ deliverySurface: visible }}
        controls={false}
        showSelectionDetails={false}
        height={inspectionMode ? 560 : 420}
        typography={typography}
        renderCellDetails={
          chartsMode
            ? (context) => (
                <CellChartExample
                  {...context}
                  observations={
                    context.cell.lonMin === -1 ? observations : undefined
                  }
                  typography={typography}
                />
              )
            : undefined
        }
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
