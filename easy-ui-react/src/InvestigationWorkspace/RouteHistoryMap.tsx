import React, { useMemo } from "react";
import { useId } from "react-aria";
import { NetworkMap, NetworkMapSurface } from "../NetworkMap";
import type { NetworkMapProps } from "../NetworkMap";
import { geographicBounds } from "../NetworkMap/geometry";
import { UnstyledButton } from "../UnstyledButton";
import type { InvestigationWorkbenchProps } from "./InvestigationWorkbench";
import type { InvestigationRecords } from "./selection";
import { dashedRoute } from "./routeHistoryStyle";
import { workbenchMapData } from "./workbenchMap";
import styles from "./RouteHistoryMap.module.scss";

export type RouteHistoryMapOptions = InvestigationWorkbenchProps["map"] & {
  /** Show a small, independently fitted all-location map alongside a regional main view. */
  showOverviewInset?: boolean;
};

type RouteHistoryMapProps = {
  records: Required<InvestigationRecords>;
  map: RouteHistoryMapOptions;
  focusedPathId: string | null;
  selectedLocationId?: string;
  selectedAnnotation?: string;
  onInspectLocation: (id: string) => void;
  onFocusPath: (id: string) => void;
};

export function RouteHistoryMap({
  records,
  map,
  focusedPathId,
  selectedLocationId,
  selectedAnnotation,
  onInspectLocation,
  onFocusPath,
}: RouteHistoryMapProps) {
  const prefix = useId();
  const { showOverviewInset, ...options } = map;
  const geography = useMemo(
    () =>
      workbenchMapData(
        records,
        {
          mode: focusedPathId ? "focused" : "overview",
          focusedPathId,
          enabledPredictionIds: [],
          comparisonPredictionId: null,
        },
        [],
        prefix,
        "route-history",
      ),
    [records, focusedPathId, prefix],
  );
  const facilities = useMemo(
    () =>
      geography.facilities.map((location) =>
        location.id === selectedLocationId && selectedAnnotation
          ? { ...location, annotation: selectedAnnotation }
          : location,
      ),
    [geography.facilities, selectedLocationId, selectedAnnotation],
  );
  const primaryFacilityIds = useMemo(
    () =>
      focusedPathId
        ? [
            ...new Set(
              records.events.flatMap((event) =>
                event.locationId && event.pathIds?.includes(focusedPathId)
                  ? [event.locationId]
                  : [],
              ),
            ),
          ]
        : undefined,
    [records, focusedPathId],
  );
  const overlays = useMemo(
    () => [...(map.overlays ?? []), ...geography.overlays],
    [map.overlays, geography.overlays],
  );
  const selectOverlay: NetworkMapProps["onOverlaySelect"] = (hit) => {
    const pathId = hit.feature.properties?.candidateId;
    if (
      typeof pathId === "string" &&
      hit.overlayId === prefix + "-history-" + pathId
    ) {
      onFocusPath(pathId);
    } else {
      map.onOverlaySelect?.(hit);
    }
  };

  // A repeated observation at one location has no geographic direction of its own.
  // Assigned segments are drawn exclusively by the per-candidate overlays.
  const baseSegments = useMemo(() => {
    const assigned = new Set(records.paths.flatMap((path) => path.segmentIds));
    return records.segments.filter((segment) => !assigned.has(segment.id));
  }, [records]);
  const bounds = useMemo(
    () =>
      geographicBounds(
        records.locations.map((location) => location.coordinates),
      ),
    [records.locations],
  );
  const overviewFocus = useMemo(
    () =>
      bounds
        ? {
            revision: bounds.flat().join(","),
            facilityIds: [],
            bounds: {
              minLon: bounds[0][0],
              minLat: bounds[0][1],
              maxLon: bounds[1][0],
              maxLat: bounds[1][1],
            },
            maxZoom: 7,
          }
        : undefined,
    [bounds],
  );
  const selectProps = {
    selectedFacilityId: selectedLocationId,
    primaryFacilityIds,
    onFacilitySelect: onInspectLocation,
  };

  return (
    <section className={styles.root} aria-labelledby={prefix + "-title"}>
      <header className={styles.heading}>
        <h3 id={prefix + "-title"}>{map.title ?? "Candidate routes"}</h3>
        {map.description && <span>{map.description}</span>}
      </header>
      <div className={styles.geography}>
        <NetworkMap
          {...options}
          {...selectProps}
          title={null}
          description={null}
          aria-label={map["aria-label"] ?? "Candidate routes map"}
          facilities={facilities}
          segments={baseSegments}
          overlays={overlays}
          onOverlaySelect={selectOverlay}
          connectionStyle="subtle"
          height={map.height ?? 310}
          controls={map.controls ?? false}
          showDataTable={false}
          showViewScale={false}
          showLegend={false}
          showSelectionDetails={false}
        />
        {showOverviewInset && overviewFocus && (
          <aside
            className={styles.inset}
            aria-label="All locations overview"
            data-route-overview
          >
            <NetworkMapSurface
              mapStyle={map.mapStyle}
              workerUrl={map.workerUrl}
              aria-label="All locations map"
              facilities={facilities}
              overlays={geography.overlays}
              segments={baseSegments}
              {...selectProps}
              controls={false}
              height="fill"
              focus={overviewFocus}
              onOverlaySelect={selectOverlay}
              typography={{ label: 11, detail: 11 }}
            />
          </aside>
        )}
      </div>
      {records.paths.length > 0 && (
        <div
          className={styles.routes}
          role="group"
          aria-label="Focus a candidate route"
        >
          {records.paths.map((path, index) => (
            <UnstyledButton
              key={path.id}
              className={styles.route}
              data-route-focus={path.id}
              aria-pressed={focusedPathId === path.id}
              onPress={() => onFocusPath(path.id)}
            >
              <span
                className={styles.swatch}
                aria-hidden="true"
                style={{ color: path.color }}
                data-dashed={dashedRoute(index) || undefined}
              />
              <strong>{path.label}</strong>
              {path.description && <span>{path.description}</span>}
            </UnstyledButton>
          ))}
        </div>
      )}
    </section>
  );
}
