import React, { useState } from "react";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { NetworkMap } from "./NetworkMap";
import { Select } from "../Select";
import { Button } from "../Button";
import { exampleBasemap, parcelFacilities } from "./NetworkMap.fixtures";
import type {
  MapFacility,
  MapSegment,
  NetworkMapProps,
  NetworkMapZoomSection,
} from "./types";
import styles from "./NetworkMapZoomSections.module.scss";

export const zoomJourneyFacilities: MapFacility[] = [
  parcelFacilities.find((facility) => facility.id === "oak")!,
  {
    id: "acceptance",
    label: "Oakland acceptance",
    kind: "hub",
    coordinates: [-122.222, 37.764],
    detail: "Accepted · Sep 10, 16:25 UTC",
  },
  {
    id: "origin-sort",
    label: "Oakland sort",
    kind: "hub",
    coordinates: [-122.212, 37.741],
    detail: "Departed origin sort · Sep 10, 18:10 UTC",
  },
  ...parcelFacilities.filter((facility) => facility.id !== "oak"),
];
export const zoomJourneySegments: MapSegment[] = zoomJourneyFacilities
  .slice(1)
  .map((facility, index) => ({
    id: `${zoomJourneyFacilities[index].id}-${facility.id}`,
    from: zoomJourneyFacilities[index].id,
    to: facility.id,
    evidence: facility.id === "dst" ? "planned" : "transfer",
    label: `${zoomJourneyFacilities[index].label} → ${facility.label}`,
  }));
export const journeyZoomSections: NetworkMapZoomSection[] = [
  {
    id: "origin",
    title: "Origin",
    description: "Oakland · Warehouse → acceptance → origin sort",
    facilityIds: ["oak", "acceptance", "origin-sort"],
  },
  {
    id: "destination",
    title: "Destination",
    description: "Dearborn · Regional sort → distribution → delivery area",
    facilityIds: ["dtw", "dbn", "dst"],
  },
];

export function JourneyZoomExample({
  narrow = false,
  largeText = false,
  localBasemap = false,
  emptySection = false,
}: {
  narrow?: boolean;
  largeText?: boolean;
  localBasemap?: boolean;
  emptySection?: boolean;
}) {
  const [selected, setSelected] = useState("dbn");
  const [revision, setRevision] = useState(0);
  const [focusRevision, setFocusRevision] = useState(0);
  const [risk, setRisk] = useState(false);
  const sections = emptySection
    ? [
        ...journeyZoomSections,
        { id: "missing", title: "Unmapped handoff", facilityIds: ["unknown"] },
      ]
    : journeyZoomSections;
  const refreshed = zoomJourneyFacilities.map((facility) => ({
    ...facility,
    detail: facility.detail
      ? `${facility.detail}${revision ? " · Updated" : ""}`
      : undefined,
  }));
  return (
    <div
      className={styles.example}
      data-journey-zoom-example
      style={{ maxWidth: narrow ? 540 : 1120 }}
    >
      <h1 className={styles.exampleHeading}>Tracking path</h1>
      <div className={styles.exampleControls}>
        <Select
          label="Selected location"
          selectedKey={selected}
          onSelectionChange={(id) => setSelected(String(id))}
          size="sm"
        >
          {zoomJourneyFacilities.map((facility) => (
            <Select.Option key={facility.id}>{facility.label}</Select.Option>
          ))}
        </Select>
        <Button size="sm" onPress={() => setRevision((value) => value + 1)}>
          Refresh records
        </Button>
        <Button
          size="sm"
          onPress={() => setFocusRevision((value) => value + 1)}
        >
          Refit insets
        </Button>
        <label>
          <input
            type="checkbox"
            checked={risk}
            onChange={(event) => setRisk(event.target.checked)}
          />{" "}
          Facility risk
        </label>
      </div>
      <h2 className={styles.exampleRoute}>Oakland → Dearborn</h2>
      <NetworkMap
        aria-label="Oakland → Dearborn"
        description="EP-104 · Ground · Synthetic journey"
        mapStyle={localBasemap ? emptyBasemap : exampleBasemap}
        workerUrl={workerUrl}
        facilities={revision ? refreshed : zoomJourneyFacilities}
        segments={zoomJourneySegments}
        zoomSections={sections.map((section) => ({
          ...section,
          focusRevision,
          onMapReady: localBasemap
            ? (map) => recordMap(section.id, map)
            : undefined,
        }))}
        selectedFacilityId={selected}
        onFacilitySelect={setSelected}
        latestFacilityId="dbn"
        primaryFacilityIds={["oak", "slc", "chi", "dtw"]}
        height={largeText ? 780 : 660}
        controls={{ risk: false, latestEvent: false, selectedSegment: false }}
        controlLabels={{ fitAll: "Entire journey" }}
        layerVisibility={{ risk }}
        showDataTable={false}
        typography={
          largeText
            ? {
                title: 22,
                description: 18,
                control: 18,
                label: 16,
                detail: 16,
                legend: 16,
              }
            : undefined
        }
        onMapReady={
          localBasemap ? (map) => recordMap("overview", map) : undefined
        }
      />
    </div>
  );
}

const emptyBasemap = { version: 8 as const, sources: {}, layers: [] };

// Map handles exist only in the acceptance fixture, never in the regular examples/component.
function recordMap(
  id: string,
  map: Parameters<NonNullable<NetworkMapProps["onMapReady"]>>[0],
) {
  const fixture = window as unknown as {
    journeyMaps?: Record<string, typeof map>;
  };
  (fixture.journeyMaps ??= {})[id] = map;
}
