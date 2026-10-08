import "./console.mjs";
import React, { useMemo, useState } from "react";
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
  NetworkMapInspectionTrigger,
} from "../../easy-ui-react/src/NetworkMap";
import type { MapOverlay } from "../../easy-ui-react/src/NetworkMap";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import { PillButton } from "../../easy-ui-react/src/Pill";
import { Button } from "../../easy-ui-react/src/Button";
import { Text } from "../../easy-ui-react/src/Text";
const style: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#c8d8e7" },
    },
  ],
};
declare global {
  interface Window {
    __richInspectionMap?: MapInstance;
  }
}
const params = new URLSearchParams(location.search);
const dark = params.get("theme") === "dark";
const stableFacilityDetails = (
  <div style={{ padding: 12 }}>
    <Text variant="body2">
      Shared facility · synthetic reference coordinates
    </Text>
    <p>Membership: Route A · Route B</p>
    <label>
      Detail view{" "}
      <select aria-label="Detail view">
        <option>Summary</option>
        <option>Exact values</option>
      </select>
    </label>
  </div>
);
function Fixture() {
  const [colorScheme, setColorScheme] = useState<"light" | "dark">(
    dark ? "dark" : "light",
  );
  const [presses, setPresses] = useState(0);
  const [revision, setRevision] = useState(0),
    [hidden, setHidden] = useState(false),
    [generation, setGeneration] = useState(0);
  const overlays = useMemo<MapOverlay[]>(
    () =>
      ["a", "b"].map((id, index) => ({
        id,
        label: `Route ${id.toUpperCase()}`,
        visible: !hidden,
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id,
              properties: { label: `Route ${id.toUpperCase()}`, generation },
              geometry: {
                type: "LineString",
                coordinates: [
                  [-3, 0],
                  [3, 0],
                ],
              },
            },
          ],
        },
        layers: [
          {
            id: "casing",
            type: "line",
            paint: { "line-color": "#ffffff", "line-width": 14 },
          },
          {
            id: "line",
            type: "line",
            paint: {
              "line-color": index ? "#5b2ec2" : "#0055ff",
              "line-width": 6,
            },
          },
        ],
      })),
    [hidden, generation],
  );
  return (
    <ThemeProvider colorScheme="light">
      <main style={{ padding: 16, maxWidth: 1000, margin: "auto" }}>
        <ThemeProvider colorScheme={colorScheme}>
          <section
            style={{
              padding: 16,
              background: "var(--ezui-color-neutral-000)",
              color: "var(--ezui-color-neutral-900)",
            }}
          >
            <h1>Rich network inspection</h1>
            <p>
              Synthetic facility and overlapping routes. No external map
              services.
            </p>
            <NetworkMapProvider
              aria-label="Rich inspection network"
              mapStyle={style}
              workerUrl={workerUrl}
              overlays={overlays}
              inspectionRevision={revision}
              facilities={[
                {
                  id: "hub",
                  label: "Shared facility",
                  kind: "hub",
                  coordinates: [0, 1],
                },
              ]}
              initialView={{ center: [0, 0], zoom: 5 }}
              height={360}
              controls={{ scale: false }}
              onMapReady={(map) => {
                window.__richInspectionMap = map;
              }}
              renderFacilityDetails={() => stableFacilityDetails}
              renderOverlayHoverDetails={({ selections }) => (
                <div style={{ padding: 12 }}>
                  {selections.map(({ overlay, feature }) => (
                    <article key={overlay.id}>
                      <h2>{overlay.label}</h2>
                      <p>
                        Generation {String(feature.properties?.generation)} ·
                        supplied route geometry
                      </p>
                    </article>
                  ))}
                  <p>
                    Routes share this connection. These are synthetic records.
                  </p>
                  {Array.from({ length: 4 }, (_, i) => (
                    <p key={i}>
                      Exact sequence and source metadata remain available within
                      the viewport.
                    </p>
                  ))}
                </div>
              )}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <NetworkMapInspectionTrigger target={{ facilityId: "hub" }}>
                  <PillButton onPress={() => setPresses((n) => n + 1)}>
                    Inspect shared facility
                  </PillButton>
                </NetworkMapInspectionTrigger>
                <NetworkMapInspectionTrigger target={{ facilityId: "hub" }}>
                  <button>Inspect lifecycle</button>
                </NetworkMapInspectionTrigger>
                <NetworkMapInspectionTrigger target={{ overlayId: "a" }}>
                  <Button>Inspect route A</Button>
                </NetworkMapInspectionTrigger>
              </div>
              <output data-inspection-presses>{presses}</output>
              <NetworkMapSurface />
            </NetworkMapProvider>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexDirection: "column",
                alignItems: "flex-start",
                marginTop: 12,
              }}
            >
              <Button
                onPress={() =>
                  setColorScheme((value) =>
                    value === "light" ? "dark" : "light",
                  )
                }
              >
                Toggle theme
              </Button>
              <Button onPress={() => setRevision((n) => n + 1)}>
                Next context
              </Button>
              <Button onPress={() => setHidden((v) => !v)}>
                Toggle routes
              </Button>
              <Button onPress={() => setGeneration((n) => n + 1)}>
                Refresh records
              </Button>
            </div>
          </section>
        </ThemeProvider>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
