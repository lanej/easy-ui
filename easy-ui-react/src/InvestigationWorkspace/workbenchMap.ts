import type { FeatureCollection } from "geojson";
import type { MapOverlay, MapFacility } from "../NetworkMap";
import { segmentData, splitAntimeridian } from "../NetworkMap/geometry";
import type { InvestigationRecords } from "./selection";
import type { InvestigationPrediction } from "./workbenchModel";
import type { InvestigationWorkbenchState } from "./workbenchState";

function connectionGeometry(
  records: Required<InvestigationRecords>,
): FeatureCollection {
  const segments = new Map(
    records.segments.map((segment) => [segment.id, segment]),
  );
  const geometry = segmentData(records.locations, records.segments);
  return {
    ...geometry,
    features: geometry.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        label: segments.get(String(feature.id))?.label,
      },
    })),
  };
}

/** Keep membership offsets stable when focus or the selected subset changes. */
function segmentMemberships(records: Required<InvestigationRecords>) {
  return new Map(
    records.segments.map((segment) => [
      segment.id,
      records.paths
        .filter((path) => path.segmentIds.includes(segment.id))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ]),
  );
}

function historyFeatures(
  geometry: FeatureCollection,
  segmentIds: ReadonlySet<string>,
  pathId: string,
  membersBySegment: ReturnType<typeof segmentMemberships>,
) {
  return geometry.features
    .filter((feature) => segmentIds.has(String(feature.id)))
    .map((feature) => {
      const members = membersBySegment.get(String(feature.id)) ?? [];
      return {
        ...feature,
        properties: {
          ...feature.properties,
          candidateId: pathId,
          segmentId: String(feature.id),
          offset:
            (members.findIndex((member) => member.id === pathId) -
              (members.length - 1) / 2) *
            4,
        },
      };
    });
}

/** Selection changes emphasis only, never a connection's evidence class. */
function connectionLayers(
  color: string,
  observedWidth: number,
  candidateWidth: number,
  observedOpacity: number,
  candidateOpacity = observedOpacity,
): MapOverlay["layers"] {
  return [
    {
      id: "observed",
      type: "line",
      filter: [
        "!",
        ["in", ["get", "evidence"], ["literal", ["inferred", "planned"]]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": observedWidth,
        "line-opacity": observedOpacity,
        "line-offset": ["get", "offset"],
      },
    },
    {
      id: "candidate",
      type: "line",
      filter: ["in", ["get", "evidence"], ["literal", ["inferred", "planned"]]],
      paint: {
        "line-color": color,
        "line-width": candidateWidth,
        "line-opacity": candidateOpacity,
        "line-offset": ["get", "offset"],
        "line-dasharray": [2, 2],
      },
    },
  ];
}

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
  const geometry = connectionGeometry(records);
  const bySegment = segmentMemberships(records);
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
        features: historyFeatures(
          geometry,
          new Set(path.segmentIds),
          path.id,
          bySegment,
        ),
      } as FeatureCollection,
      layers: connectionLayers(
        path.color ?? "#8794a6",
        focused === path.id ? 3.5 : 2.5,
        focused === path.id ? 3 : 2,
        active ? 0.95 : 0.55,
        active ? 0.9 : 0.55,
      ),
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
  const segments = connectionGeometry(records)
    .features.filter((feature) => selectedSegmentIds.has(String(feature.id)))
    .map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        segmentId: String(feature.id),
        offset: 0,
      },
    }));
  const bySegment = segmentMemberships(records);
  const selectedGeometry: FeatureCollection = {
    type: "FeatureCollection",
    features: segments,
  };
  const overlays: MapOverlay[] = records.paths.flatMap((path) => {
    const pathSegments = new Set(
      selectedConnections
        .filter((connection) => connection.pathIds?.includes(path.id))
        .flatMap((connection) =>
          connection.segmentId ? [connection.segmentId] : [],
        ),
    );
    const features = historyFeatures(
      selectedGeometry,
      pathSegments,
      path.id,
      bySegment,
    );
    return features.length
      ? [
          {
            id: `${prefix}-selected-history-${path.id}`,
            label: `Selected connections · ${path.label}`,
            data: { type: "FeatureCollection" as const, features },
            layers: connectionLayers(path.color ?? "#2563eb", 5, 5, 1),
          },
        ]
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
      layers: connectionLayers("#64748b", 5, 5, 1),
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
      layers: [
        {
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
        },
      ],
    });
  return overlays;
}
