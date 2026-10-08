import React, { useMemo } from "react";
import { NetworkMap, type NetworkMapProps } from "../NetworkMap";
import { useColorScheme } from "../Theme";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { facilities, segments, weather } from "./NetworkGuide.fixtures";
import { basemap, darkBasemap } from "./NetworkGuide.geography";

export type NetworkInvestigationMapProps = Partial<NetworkMapProps>;

export function NetworkInvestigationMap({
  selectedFacilityId = "dtw",
  showDataTable = true,
  height = 360,
  mapStyle,
  workerUrl: suppliedWorkerUrl = workerUrl,
  facilities: suppliedFacilities = facilities,
  areas = weather,
  segments: suppliedSegments,
  showSelectionDetails = false,
  onRenderError = (error) => console.error("Network investigation map:", error),
  ...presentation
}: NetworkInvestigationMapProps) {
  const { resolvedColorScheme } = useColorScheme();
  const outgoing = useMemo(
    () => segments.filter((segment) => segment.from === selectedFacilityId),
    [selectedFacilityId],
  );

  return (
    <NetworkMap
      {...presentation}
      aria-label={presentation["aria-label"] ?? "Transfer network"}
      mapStyle={
        mapStyle ?? (resolvedColorScheme === "dark" ? darkBasemap : basemap)
      }
      workerUrl={suppliedWorkerUrl}
      facilities={suppliedFacilities}
      segments={suppliedSegments ?? outgoing}
      areas={areas}
      selectedFacilityId={selectedFacilityId}
      primaryFacilityIds={
        presentation.primaryFacilityIds ??
        suppliedFacilities.map((facility) => facility.id)
      }
      height={height}
      showSelectionDetails={showSelectionDetails}
      showDataTable={showDataTable}
      onRenderError={onRenderError}
    />
  );
}
