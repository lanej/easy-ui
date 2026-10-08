import type { Feature, FeatureCollection, Geometry } from "geojson";
import type {
  GeoJSONSource,
  Map as MapInstance,
  MapMouseEvent,
} from "maplibre-gl";
import type { MapCoordinate, MapOverlay, MapOverlaySelection } from "./types";
import { geographicBounds, validCoordinate } from "./geometry";

export function overlayCoordinates(
  overlays: readonly MapOverlay[] = [],
  includeHidden = false,
) {
  const points: MapCoordinate[] = [];
  const visitCoordinates = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      const position: MapCoordinate = [coordinates[0], coordinates[1]];
      if (validCoordinate(position)) points.push(position);
    } else {
      coordinates.forEach(visitCoordinates);
    }
  };
  const visitGeometry = (geometry: Geometry | null): void => {
    if (!geometry) return;
    if (geometry.type === "GeometryCollection")
      geometry.geometries.forEach(visitGeometry);
    else visitCoordinates(geometry.coordinates);
  };
  for (const overlay of overlays) {
    if (includeHidden || overlay.visible !== false) {
      for (const feature of overlay.data.features)
        visitGeometry(feature.geometry);
    }
  }
  return points;
}

export function overlayFitBounds(
  points: readonly MapCoordinate[],
  overlays: readonly MapOverlay[] = [],
): [[number, number], [number, number]] | null {
  const overlayPoints = overlayCoordinates(overlays);
  if (!overlayPoints.length) return geographicBounds(points);
  const valid = [...points.filter(validCoordinate), ...overlayPoints];
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  for (const [longitude, latitude] of valid) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return [
    [west, south],
    [east, north],
  ];
}

type OverlayEntry = {
  overlay: MapOverlay;
  sourceId: string;
  layerIds: string[];
  featureKey: string;
  features: Map<number, Feature>;
  propertyKeys: Set<string>;
};

export function createOverlayRenderer(
  map: MapInstance,
  onSelect: (selection: MapOverlaySelection) => void,
  inspection?: {
    inspect: (
      selections: readonly MapOverlaySelection[],
      coordinate: MapCoordinate,
      x: number,
      y: number,
      pinned?: boolean,
    ) => void;
    leave: (related?: EventTarget | null) => void;
  },
) {
  const owned = new Map<string, OverlayEntry>();
  const layerOwners = new Map<string, string>();
  const featureIds = new WeakMap<Feature, number>();
  let nextFeatureId = 0;
  const sourceData = (entry: OverlayEntry, data: FeatureCollection) => {
    for (const feature of data.features)
      for (const key of Object.keys(feature.properties ?? {}))
        entry.propertyKeys.add(key);
    let featureKey = entry.featureKey || "__easy_ui_overlay_feature";
    while (entry.propertyKeys.has(featureKey)) featureKey += "_";
    entry.featureKey = featureKey;
    entry.features.clear();
    return {
      ...data,
      features: data.features.map((feature) => {
        let id = featureIds.get(feature);
        if (id === undefined) {
          id = nextFeatureId++;
          featureIds.set(feature, id);
        }
        entry.features.set(id, feature);
        return {
          ...feature,
          properties: { ...feature.properties, [featureKey]: id },
        };
      }),
    };
  };
  let listening = false;
  const hits = (event: MapMouseEvent) => {
    const target = event.originalEvent?.target;
    if (
      target instanceof Element &&
      target.closest(".maplibregl-marker, .maplibregl-ctrl")
    )
      return null;
    const selections: MapOverlaySelection[] = [];
    for (const feature of map.queryRenderedFeatures(event.point, {
      layers: [...layerOwners.keys()],
    })) {
      const overlayId = layerOwners.get(feature.layer.id);
      const entry = overlayId && owned.get(overlayId);
      const original =
        entry && entry.features.get(feature.properties[entry.featureKey]);
      // A feature can appear through casing, line and tile/world copies. Keep one per overlay.
      if (overlayId && original && entry && entry.overlay.visible !== false) {
        const key = original;
        // The same object may intentionally belong to multiple overlays.
        if (
          selections.some((s) => s.overlayId === overlayId && s.feature === key)
        )
          continue;
        selections.push({
          overlayId,
          feature: original,
          coordinate: [event.lngLat.lng, event.lngLat.lat],
        });
      }
    }
    return selections;
  };
  const inspect = (event: MapMouseEvent, pinned: boolean) => {
    const selections = hits(event);
    if (!selections) return;
    if (!selections.length) {
      if (!pinned) inspection?.leave();
      return;
    }
    if (pinned) onSelect(selections[0]);
    if (!inspection) return;
    const bounds = map.getContainer().getBoundingClientRect();
    inspection?.inspect(
      selections,
      [event.lngLat.lng, event.lngLat.lat],
      bounds.left + event.point.x,
      bounds.top + event.point.y,
      pinned,
    );
  };
  const click = (event: MapMouseEvent) => inspect(event, true);
  const hover = (event: MapMouseEvent) => {
    if (!map.isMoving()) inspect(event, false);
  };
  const leave = (event: MapMouseEvent) =>
    inspection?.leave(
      (event.originalEvent as MouseEvent | undefined)?.relatedTarget,
    );
  let previousOrder = "";
  const removeLayers = (entry: OverlayEntry) => {
    for (const layerId of [...entry.layerIds].reverse()) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      layerOwners.delete(layerId);
    }
    entry.layerIds = [];
  };
  const removeOverlay = (id: string) => {
    const entry = owned.get(id)!;
    removeLayers(entry);
    if (map.getSource(entry.sourceId)) map.removeSource(entry.sourceId);
    owned.delete(id);
  };
  return {
    update(overlays: readonly MapOverlay[] = []) {
      const ids = new Set<string>();
      for (const overlay of overlays) {
        if (!overlay.id || ids.has(overlay.id))
          throw new Error("Map overlay IDs must be nonempty and unique");
        ids.add(overlay.id);
        const layers = new Set<string>();
        for (const layer of overlay.layers) {
          if (!layer.id || layers.has(layer.id))
            throw new Error(
              "Map overlay layer IDs must be nonempty and unique within their overlay",
            );
          layers.add(layer.id);
        }
      }
      for (const id of owned.keys()) if (!ids.has(id)) removeOverlay(id);
      let changedLayers = false;
      for (const overlay of overlays) {
        let entry = owned.get(overlay.id);
        if (!entry) {
          const sourceId = `easy-ui-overlay-${encodeURIComponent(overlay.id)}`;
          if (map.getSource(sourceId))
            throw new Error(`Map overlay source already exists: ${sourceId}`);
          entry = {
            overlay,
            sourceId,
            layerIds: [],
            featureKey: "",
            features: new Map(),
            propertyKeys: new Set(),
          };
          map.addSource(sourceId, {
            type: "geojson",
            data: sourceData(entry, overlay.data),
          });
          owned.set(overlay.id, entry);
        } else if (entry.overlay.data !== overlay.data) {
          (map.getSource(entry.sourceId) as GeoJSONSource).setData(
            sourceData(entry, overlay.data),
          );
        }
        if (!entry.layerIds.length || entry.overlay.layers !== overlay.layers) {
          removeLayers(entry);
          for (const layer of overlay.layers) {
            const layerId = `${entry.sourceId}/${encodeURIComponent(layer.id)}`;
            if (map.getLayer(layerId))
              throw new Error(`Map overlay layer already exists: ${layerId}`);
            map.addLayer({
              ...layer,
              id: layerId,
              source: entry.sourceId,
              layout: {
                ...layer.layout,
                visibility:
                  overlay.visible === false
                    ? "none"
                    : (layer.layout?.visibility ?? "visible"),
              },
            });
            entry.layerIds.push(layerId);
            layerOwners.set(layerId, overlay.id);
          }
          changedLayers = true;
        } else if (entry.overlay.visible !== overlay.visible) {
          overlay.layers.forEach((layer, index) =>
            map.setLayoutProperty(
              entry.layerIds[index],
              "visibility",
              overlay.visible === false
                ? "none"
                : (layer.layout?.visibility ?? "visible"),
            ),
          );
        }
        entry.overlay = overlay;
      }
      const order = JSON.stringify(overlays.map((overlay) => overlay.id));
      if (changedLayers || order !== previousOrder) {
        for (const overlay of overlays) {
          for (const layerId of owned.get(overlay.id)!.layerIds)
            map.moveLayer(layerId);
        }
        previousOrder = order;
      }
      if (layerOwners.size > 0 && !listening) {
        map.on("click", click);
        if (inspection) {
          map.on("mousemove", hover);
          map.on("mouseout", leave);
        }
        listening = true;
      } else if (!layerOwners.size && listening) {
        map.off("click", click);
        if (inspection) {
          map.off("mousemove", hover);
          map.off("mouseout", leave);
        }
        listening = false;
      }
    },
    dispose() {
      for (const id of [...owned.keys()]) removeOverlay(id);
      if (listening) {
        map.off("click", click);
        if (inspection) {
          map.off("mousemove", hover);
          map.off("mouseout", leave);
        }
      }
      listening = false;
    },
  };
}
