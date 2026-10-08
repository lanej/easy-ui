import "./console.mjs";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "../../.storybook/public/poppins.css";
import "../../easy-ui-react/src/styles/global.scss";
import "./preview.css";
import {
  NetworkMapProvider,
  NetworkMapSurface,
  NetworkMapControlPanel,
  NetworkMapHeading,
  NetworkMapSelectionDetails,
  NetworkMapLegend,
  NetworkMapDataView,
} from "../../easy-ui-react/src/NetworkMap";
import type {
  MapFacility,
  MapSegment,
  MapSurface,
} from "../../easy-ui-react/src/NetworkMap";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";

const style: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f4f6f8" },
    },
  ],
};
const facilities: MapFacility[] = [
  {
    id: "a",
    label: "West island distribution centre with a long location name",
    coordinates: [179, 10],
    kind: "warehouse",
    detail:
      "A long facility description remains fully readable outside the map at increased text sizes.",
  },
  {
    id: "b",
    label: "East island regional hub",
    coordinates: [-179, 10],
    kind: "hub",
  },
];
const evidence = ["transfer", "measured", "planned", "inferred"] as const;
const segments: MapSegment[] = evidence.map((kind, index) => ({
  id: kind,
  label: `${kind} dateline connection`,
  evidence: kind,
  from: "a",
  to: "b",
  color: "#ae3161",
  coordinates: [
    [179, 10 + index * 0.15],
    [-179, 10 + index * 0.15],
  ],
}));
const surface: MapSurface = {
  source: "Synthetic delivery model",
  asOf: "2026-09-20T00:00:00Z",
  cells: [
    {
      lonMin: 179.2,
      lonMax: 179.4,
      latMin: 10.6,
      latMax: 10.8,
      medianMinutes: null,
      iqrMinutes: null,
      n: 0,
    },
    {
      lonMin: 179.5,
      lonMax: 179.7,
      latMin: 10.6,
      latMax: 10.8,
      medianMinutes: 0,
      iqrMinutes: 2,
      n: 10,
    },
  ],
};
declare global {
  interface Window {
    __mapComposition?: MapInstance;
  }
}
function App() {
  const [selected, setSelected] = useState("a"),
    [segment, setSegment] = useState("planned");
  const [large, setLarge] = useState(
      new URLSearchParams(window.location.search).has("large"),
    ),
    [interactive, setInteractive] = useState(true),
    [layerOnly, setLayerOnly] = useState(false);
  return (
    <ThemeProvider>
      <main className="composition-page">
        <h1>Composable map review</h1>
        <p>
          The map, controls, selected record, and exact data are separately
          placed components. All values are synthetic.
        </p>
        <div className="regression-actions">
          <button onClick={() => setLarge(!large)}>Toggle large text</button>
          <button onClick={() => setInteractive(!interactive)}>
            Toggle marker interaction
          </button>
          <button onClick={() => setLayerOnly(!layerOnly)}>
            Toggle surface-only mode
          </button>
          {evidence.map((kind) => (
            <button key={kind} onClick={() => setSegment(kind)}>
              Select {kind} route
            </button>
          ))}
        </div>
        <h2 id="external-map-heading">
          Island connections and delivery estimates
        </h2>
        <NetworkMapProvider
          mapStyle={style}
          workerUrl={workerUrl}
          aria-labelledby="external-map-heading"
          aria-describedby="external-map-data"
          description="Title and description can be supplied independently."
          facilities={layerOnly ? undefined : facilities}
          segments={layerOnly ? undefined : segments}
          surface={surface}
          selectedFacilityId={selected}
          selectedSegmentId={segment}
          onFacilitySelect={interactive ? setSelected : undefined}
          layerVisibility={{ deliverySurface: true }}
          height={300}
          initialView={{ center: [180, 10.3], zoom: 6 }}
          typography={
            large
              ? {
                  title: 28,
                  description: 24,
                  label: 24,
                  control: 24,
                  legend: 24,
                  detail: 24,
                }
              : undefined
          }
          onMapReady={(map) => {
            window.__mapComposition = map;
            map.setPaintProperty("easy-ui-observed", "line-color", "#ff0099");
          }}
        >
          <NetworkMapHeading />
          <aside className="composition-controls">
            <NetworkMapControlPanel />
          </aside>
          <NetworkMapSurface />
          <div id="external-selection">
            <NetworkMapSelectionDetails />
          </div>
          <NetworkMapLegend />
          <NetworkMapDataView id="external-map-data" expanded />
        </NetworkMapProvider>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
