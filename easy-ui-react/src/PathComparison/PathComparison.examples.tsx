import React, { useMemo, useState } from "react";
import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "../NetworkMap/maplibre-gl.css";
import { NetworkMap, type MapOverlay } from "../NetworkMap";
import { EventDetails } from "../EventDetails";
import { useColorScheme } from "../Theme";
import { investigationRecords } from "../InvestigationWorkspace/InvestigationWorkspace.fixtures";
import type { InvestigationSelection } from "../InvestigationWorkspace";
import {
  resolveSelection,
  type InvestigationRecords,
} from "../InvestigationWorkspace/selection";
import { PathComparison } from "./PathComparison";
import type { PathComparisonRow } from "./PathComparison";
import { comparisonRows } from "./PathComparison.fixtures";
import styles from "./PathComparison.examples.module.scss";

declare global {
  interface Window {
    toolkitMap?: MapInstance;
  }
}

export type ComparisonExampleData = {
  records: InvestigationRecords;
  rows: readonly PathComparisonRow[];
  initialSelection: InvestigationSelection;
  sourceLabel?: string;
};

const exampleData: ComparisonExampleData = {
  records: investigationRecords,
  rows: comparisonRows,
  initialSelection: { type: "path", pathId: "north", eventId: "north-scan" },
  sourceLabel: "Tracking feed",
};

export function ComparisonExample({
  withMap = false,
  narrow = false,
  data = exampleData,
}: {
  withMap?: boolean;
  narrow?: boolean;
  data?: ComparisonExampleData;
}) {
  const { records, rows, initialSelection, sourceLabel } = data;
  const [selection, setSelection] =
    useState<InvestigationSelection>(initialSelection);
  const { resolvedColorScheme } = useColorScheme();
  const { event, location, path } = resolveSelection(records, selection);
  const mapStyle = useMemo<StyleSpecification>(
    () => ({
      version: 8,
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color":
              resolvedColorScheme === "dark" ? "#19212c" : "#e9edf1",
          },
        },
      ],
    }),
    [resolvedColorScheme],
  );
  const selectedSegments = new Set(path?.segmentIds ?? []);
  const overlay: MapOverlay = {
    id: "comparison-selection",
    label: "Selected candidate",
    data: {
      type: "FeatureCollection",
      features: records.segments
        .filter((segment) => selectedSegments.has(segment.id))
        .map((segment) => ({
          type: "Feature",
          id: segment.id,
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [
                ...records.locations.find((item) => item.id === segment.from)!
                  .coordinates,
              ],
              [
                ...records.locations.find((item) => item.id === segment.to)!
                  .coordinates,
              ],
            ],
          },
        })),
    },
    layers: [
      {
        id: "selected-path",
        type: "line",
        paint: {
          "line-color": "#608cff",
          "line-width": 9,
          "line-opacity": 0.4,
        },
      },
    ],
  };
  return (
    <div
      className={styles.example}
      style={{ maxWidth: narrow ? 390 : undefined }}
    >
      <div className={withMap ? styles.split : styles.single}>
        <PathComparison
          paths={records.paths}
          events={records.events}
          rows={rows}
          selection={selection}
          onSelectionChange={setSelection}
        />
        <div className={styles.context} data-with-map={withMap || undefined}>
          {withMap && (
            <NetworkMap
              aria-label="Candidate locations"
              facilities={records.locations}
              segments={records.segments}
              selectedFacilityId={location?.id}
              onFacilitySelect={(locationId) =>
                setSelection({ type: "location", locationId })
              }
              overlays={[overlay]}
              mapStyle={mapStyle}
              workerUrl={workerUrl}
              height={280}
              controlPlacement="map"
              showDataTable={false}
              showLegend={false}
              showSelectionDetails={false}
              onMapReady={(map) => {
                window.toolkitMap = map;
              }}
            />
          )}
          <section
            className={styles.inspector}
            aria-label="Selected observation"
          >
            <h3>
              {event?.label ??
                path?.label ??
                location?.label ??
                "Select an observation"}
            </h3>
            {path && <p className={styles.scope}>{path.label}</p>}
            {event ? (
              <EventDetails
                event={event}
                sourceLabel={sourceLabel}
                locationLabel={location?.label}
                showEventId
                layout="stacked"
              />
            ) : (
              <p>
                {path?.description ??
                  location?.detail ??
                  "Select a candidate or observation to inspect its supplied context."}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
