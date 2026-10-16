import React, { useMemo, useState } from "react";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { NetworkMap } from "./NetworkMap";
import { Select } from "../Select";
import { Button } from "../Button";
import { Checkbox } from "../Checkbox";
import { exampleBasemap, parcelFacilities } from "./NetworkMap.fixtures";
import type {
  MapFacility,
  MapSegment,
  MapSurface,
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
    description: "Oakland handoffs",
    facilityIds: ["oak", "acceptance", "origin-sort"],
  },
  {
    id: "destination",
    title: "Destination",
    description: "Dearborn handoffs",
    facilityIds: ["dtw", "dbn", "dst"],
  },
];

const journeySurface: MapSurface = {
  asOf: "2026-10-13T00:00:00Z",
  source: "Synthetic journey estimates",
  cells: [
    {
      lonMin: -122.25,
      lonMax: -122.23,
      latMin: 37.74,
      latMax: 37.79,
      medianMinutes: 30,
      iqrMinutes: 10,
      n: 100,
    },
    {
      lonMin: -122.23,
      lonMax: -122.2,
      latMin: 37.74,
      latMax: 37.79,
      medianMinutes: 60,
      iqrMinutes: 25,
      n: 500,
    },
  ],
  metrics: [
    { key: "median", label: "Median delivery time", field: "medianMinutes" },
    {
      key: "spread",
      label: "Delivery-time spread",
      field: "iqrMinutes",
      colorScale: [
        { value: 0, color: "#eff3ff" },
        { value: 30, color: "#54278f" },
      ],
    },
    {
      key: "count",
      label: "Observations",
      field: "n",
      colorScale: [
        { value: 0, color: "#eff3ff" },
        { value: 1000, color: "#08519c" },
      ],
    },
  ],
};

export function JourneyZoomExample({
  title = "Oakland → Dearborn",
  description = "EP-104 · Ground · Synthetic journey",
  narrow = false,
  largeText = false,
  localBasemap = false,
  emptySection = false,
  clustered = false,
  sectionHeight,
  height,
  parentHeight,
  weighted = false,
  surfaceMetrics = false,
}: {
  title?: string | null;
  description?: string | null;
  narrow?: boolean;
  largeText?: boolean;
  localBasemap?: boolean;
  emptySection?: boolean;
  clustered?: boolean;
  sectionHeight?: number;
  height?: NetworkMapProps["height"];
  parentHeight?: number;
  weighted?: boolean;
  surfaceMetrics?: boolean;
}) {
  const [selected, setSelected] = useState("dbn");
  const [revision, setRevision] = useState(0);
  const [risk, setRisk] = useState(false);
  const segments = useMemo(
    () =>
      weighted
        ? zoomJourneySegments.map((segment, index) => ({
            ...segment,
            volume:
              index === 3 ? 10000 * (revision + 1) : index === 1 ? 20 : 10,
          }))
        : zoomJourneySegments,
    [weighted, revision],
  );
  const surface = useMemo(
    () =>
      surfaceMetrics
        ? {
            ...journeySurface,
            cells: journeySurface.cells.map((cell) => ({
              ...cell,
              n: cell.n + revision,
            })),
            metrics: journeySurface.metrics!.map((metric) => ({
              ...metric,
              colorScale: metric.colorScale?.map((stop) => ({ ...stop })),
            })),
          }
        : undefined,
    [surfaceMetrics, revision],
  );
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
      style={{
        maxWidth: narrow ? 540 : 1120,
        height: parentHeight,
        display: parentHeight ? "flex" : undefined,
        flexDirection: parentHeight ? "column" : undefined,
      }}
    >
      {(title || description) && (
        <div className={styles.exampleHeader} data-journey-heading>
          {title && <h1 className={styles.exampleHeading}>{title}</h1>}
          {description && <p className={styles.exampleHint}>{description}</p>}
        </div>
      )}
      <NetworkMap
        toolbarContent={
          <>
            <div className={styles.exampleFilters}>
              <div className={styles.exampleLocation}>
                <Select
                  aria-label="Selected location"
                  selectedKey={selected}
                  onSelectionChange={(id) => setSelected(String(id))}
                  size="sm"
                >
                  {zoomJourneyFacilities.map((facility) => (
                    <Select.Option key={facility.id}>
                      {facility.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <Button
                size="sm"
                variant="outlined"
                onPress={() => setRevision((value) => value + 1)}
              >
                Refresh records
              </Button>
            </div>
            <Checkbox isSelected={risk} onChange={setRisk}>
              <span className={styles.controlLabel}>Facility risk</span>
            </Checkbox>
          </>
        }
        aria-label="Oakland → Dearborn"
        mapStyle={localBasemap ? emptyBasemap : exampleBasemap}
        workerUrl={workerUrl}
        facilities={revision ? refreshed : zoomJourneyFacilities}
        segments={segments}
        zoomSections={sections.map((section) => ({
          ...section,
          height: sectionHeight,
          onMapReady: localBasemap
            ? (map) => recordMap(section.id, map)
            : undefined,
        }))}
        selectedFacilityId={selected}
        onFacilitySelect={setSelected}
        latestFacilityId="dbn"
        primaryFacilityIds={["oak", "slc", "chi", "dtw"]}
        clusterFacilities={clustered ? { radius: 50, maxZoom: 8 } : undefined}
        height={height ?? (largeText ? 780 : 700)}
        controls={{ risk: false, latestEvent: false, selectedSegment: false }}
        controlLabels={{
          fitAll: "Entire journey",
          deliverySurface: "Surface",
        }}
        layerVisibility={{ risk }}
        surface={surface}
        defaultLayerVisibility={{ deliverySurface: surfaceMetrics }}
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

export function JourneySizingExample() {
  const [size, setSize] = useState("300");
  return (
    <>
      <div className={styles.example} style={{ maxWidth: 360 }}>
        <Select
          label="Map height"
          selectedKey={size}
          onSelectionChange={(key) => setSize(String(key))}
        >
          <Select.Option key="300">300px</Select.Option>
          <Select.Option key="500">500px</Select.Option>
          <Select.Option key="700">700px</Select.Option>
          <Select.Option key="fill">Fill a 600px parent</Select.Option>
        </Select>
      </div>
      <JourneyZoomExample
        height={size === "fill" ? "fill" : Number(size)}
        parentHeight={size === "fill" ? 600 : undefined}
      />
    </>
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
  map.once("remove", () => {
    if (fixture.journeyMaps?.[id] === map) delete fixture.journeyMaps[id];
  });
}
