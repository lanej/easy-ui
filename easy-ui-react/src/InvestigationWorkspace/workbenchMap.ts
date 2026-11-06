import type { FeatureCollection } from "geojson";
import type { MapOverlay, MapFacility } from "../NetworkMap";
import { segmentData, splitAntimeridian } from "../NetworkMap/geometry";
import type { InvestigationRecords } from "./selection";
import type { InvestigationPrediction } from "./workbenchModel";
import type { InvestigationWorkbenchState } from "./workbenchState";

/** Stable geometry, membership and offsets. Focus changes paint, never camera or topology. */
export function workbenchMapData(
  records: Required<InvestigationRecords>,
  state: Pick<
    InvestigationWorkbenchState,
    "mode" | "focusedPathId" | "enabledPredictionIds" | "comparisonPredictionId"
  >,
  predictions: readonly InvestigationPrediction[],
  prefix: string,
) {
  const focused =
    state.mode !== "overview" &&
    records.paths.some((path) => path.id === state.focusedPathId)
      ? state.focusedPathId
      : null;
  const geometry = segmentData(records.locations, records.segments);
  const bySegment = new Map(
    records.segments.map((segment) => [
      segment.id,
      records.paths
        .filter((path) => path.segmentIds.includes(segment.id))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ]),
  );
  const memberships = new Map<string, Set<string>>();
  for (const event of records.events) {
    if (!event.locationId) continue;
    const ids = memberships.get(event.locationId) ?? new Set<string>();
    event.pathIds?.forEach((id) => ids.add(id));
    memberships.set(event.locationId, ids);
  }
  const facilities: MapFacility[] = records.locations.map((location) => {
    const ids = [...(memberships.get(location.id) ?? [])];
    return {
      ...location,
      labelMinZoom: location.labelMinZoom ?? 24,
      color:
        location.color ??
        (ids.length === 1
          ? records.paths.find((path) => path.id === ids[0])?.color
          : undefined) ??
        "#8794a6",
    };
  });
  const overlays: MapOverlay[] = records.paths.map((path) => {
    const active = !focused || focused === path.id;
    return {
      id: `${prefix}-history-${path.id}`,
      label: `History ${path.label}`,
      data: {
        type: "FeatureCollection",
        features: geometry.features
          .filter((feature) => path.segmentIds.includes(String(feature.id)))
          .map((feature) => {
            const members = bySegment.get(String(feature.id)) ?? [];
            return {
              ...feature,
              properties: {
                ...feature.properties,
                candidateId: path.id,
                segmentId: String(feature.id),
                offset:
                  (members.findIndex((member) => member.id === path.id) -
                    (members.length - 1) / 2) *
                  4,
                label: records.segments.find(
                  (segment) => segment.id === String(feature.id),
                )?.label,
              },
            };
          }),
      } as FeatureCollection,
      layers: [
        {
          id: "observed",
          type: "line",
          filter: [
            "!",
            ["in", ["get", "evidence"], ["literal", ["inferred", "planned"]]],
          ],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": path.color ?? "#8794a6",
            "line-width": focused === path.id ? 3.5 : 2.5,
            "line-opacity": active ? 0.95 : 0.55,
            "line-offset": ["get", "offset"],
          },
        },
        {
          id: "candidate",
          type: "line",
          filter: [
            "in",
            ["get", "evidence"],
            ["literal", ["inferred", "planned"]],
          ],
          paint: {
            "line-color": path.color ?? "#8794a6",
            "line-width": focused === path.id ? 3 : 2,
            "line-opacity": active ? 0.9 : 0.55,
            "line-offset": ["get", "offset"],
            "line-dasharray": [2, 2],
          },
        },
      ],
    };
  });
  if (focused) {
    for (const prediction of predictions) {
      if (
        prediction.pathId !== focused ||
        !state.enabledPredictionIds.includes(prediction.id)
      )
        continue;
      overlays.push({
        id: `${prefix}-forecast-${prediction.id}`,
        label: `Forecast · ${prediction.label}`,
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id: prediction.id,
              properties: {
                predictionId: prediction.id,
                label: prediction.label,
                source: prediction.source,
                asOf: prediction.asOf,
              },
              geometry: {
                type: "MultiLineString",
                coordinates: prediction.lines.flatMap((line) =>
                  splitAntimeridian(line),
                ),
              },
            },
          ],
        },
        layers: [
          {
            id: "forecast",
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": prediction.color,
              "line-width":
                state.comparisonPredictionId === prediction.id &&
                state.mode === "deviation"
                  ? 3
                  : 2,
              "line-opacity": 0.8,
              "line-dasharray": [...(prediction.dash ?? [6, 3])],
            },
          },
        ],
      });
    }
  }
  return {
    facilities,
    segments: records.segments.map((segment) =>
      bySegment.get(segment.id)?.length
        ? { ...segment, color: "transparent" }
        : segment,
    ),
    overlays,
  };
}

/**
 * Highlight only supplied observation locations and explicitly connected edges.
 * A selected set never creates a synthetic travel link between its members.
 */
export function selectedObservationOverlays(
  records: Required<InvestigationRecords>,
  selectedEventIds: readonly string[],
  prefix: string,
): MapOverlay[] {
  if (!selectedEventIds.length) return [];
  const ids = new Set(selectedEventIds);
  const locationIds = new Set(
    records.events
      .filter((event) => ids.has(event.id) && event.locationId)
      .map((event) => event.locationId!),
  );
  const selectedConnections = records.connections.filter(
    (connection) =>
      ids.has(connection.fromEventId) && ids.has(connection.toEventId),
  );
  const selectedSegmentIds = new Set(
    selectedConnections.flatMap((connection) =>
      connection.segmentId ? [connection.segmentId] : [],
    ),
  );
  const segments = segmentData(records.locations, records.segments).features
    .filter((feature) => selectedSegmentIds.has(String(feature.id)))
    .map((feature) => ({
      ...feature,
      properties: { ...feature.properties, segmentId: String(feature.id) },
    }));
  const overlays: MapOverlay[] = records.paths.flatMap((path) => {
    const pathSegments = new Set(
      selectedConnections
        .filter((connection) => connection.pathIds?.includes(path.id))
        .flatMap((connection) =>
          connection.segmentId ? [connection.segmentId] : [],
        ),
    );
    const features = segments.filter((feature) =>
      pathSegments.has(String(feature.id)),
    );
    return features.length
      ? [{
          id: `${prefix}-selected-history-${path.id}`,
          label: `Selected connections · ${path.label}`,
          data: { type: "FeatureCollection" as const, features },
          layers: [{
            id: "selection",
            type: "line" as const,
            layout: { "line-cap": "round" as const, "line-join": "round" as const },
            paint: {
              "line-color": path.color ?? "#2563eb",
              "line-width": 5,
              "line-opacity": 1,
            },
          }],
        }]
      : [];
  });
  const assigned = new Set(
    records.paths.flatMap((path) =>
      selectedConnections
        .filter((connection) => connection.pathIds?.includes(path.id))
        .flatMap((connection) =>
          connection.segmentId ? [connection.segmentId] : [],
        ),
    ),
  );
  const unassigned = segments.filter(
    (feature) => !assigned.has(String(feature.id)),
  );
  if (unassigned.length)
    overlays.push({
      id: `${prefix}-selected-unassigned`,
      label: "Selected unassigned connections",
      data: { type: "FeatureCollection", features: unassigned },
      layers: [{
        id: "selection",
        type: "line",
        paint: {
          "line-color": "#64748b",
          "line-width": 5,
          "line-opacity": 1,
          "line-dasharray": [2, 2],
        },
      }],
    });
  const locations = records.locations.filter((location) =>
    locationIds.has(location.id),
  );
  if (locations.length)
    overlays.push({
      id: `${prefix}-selected-points`,
      label: "Selected observations",
      data: {
        type: "FeatureCollection",
        features: locations.map((location) => ({
          type: "Feature" as const,
          id: location.id,
          properties: { locationId: location.id, label: location.label },
          geometry: {
            type: "Point" as const,
            coordinates: [...location.coordinates],
          },
        })),
      },
      layers: [{
        id: "selection",
        type: "circle",
        paint: {
          "circle-radius": 10,
          "circle-color": "#ffffff",
          "circle-opacity": 0.12,
          "circle-stroke-color": "#1e293b",
          "circle-stroke-width": 2.5,
          "circle-stroke-opacity": 0.95,
        },
      }],
    });
  return overlays;
}
