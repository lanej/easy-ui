import type { Map as MapInstance, MapMouseEvent } from "maplibre-gl";
import { vi } from "vitest";
import {
  createOverlayRenderer,
  overlayCoordinates,
  overlayFitBounds,
} from "./overlays";
import type { FeatureCollection } from "geojson";
import type { MapOverlay } from "./types";
import { investigationOverlays } from "../examples/NetworkInvestigationMap.overlays";

function fakeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const map = {
    addSource: vi.fn((id: string, _definition: { data: FeatureCollection }) =>
      sources.set(id, { setData: vi.fn() }),
    ),
    getSource: vi.fn((id: string) => sources.get(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((layer: { id: string }) => layers.set(layer.id, layer)),
    getLayer: vi.fn((id: string) => layers.get(id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    moveLayer: vi.fn(),
    setLayoutProperty: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    queryRenderedFeatures: vi.fn(),
  };
  const onSelect = vi.fn();
  return {
    map,
    sources,
    layers,
    onSelect,
    renderer: createOverlayRenderer(map as unknown as MapInstance, onSelect),
  };
}

it("adds points, lines and areas with source-scoped layer IDs and authored paint", () => {
  const { map, renderer, layers } = fakeMap();
  const overlays = investigationOverlays("light");
  renderer.update(overlays);
  expect(map.addSource).toHaveBeenCalledTimes(3);
  expect(map.addLayer).toHaveBeenCalledTimes(4);
  expect(layers.get("easy-ui-overlay-observations/points")).toMatchObject({
    type: "circle",
    source: "easy-ui-overlay-observations",
    paint: overlays[2].layers[0].paint,
  });
  expect(layers.get("easy-ui-overlay-service-area/fill")).toMatchObject({
    type: "fill",
  });
});

it("updates data and visibility without rebuilding sources or layers", () => {
  const { map, renderer, sources } = fakeMap();
  const overlay = investigationOverlays("light")[2];
  renderer.update([overlay]);
  const changed = {
    ...overlay,
    visible: false,
    data: { ...overlay.data, features: [] },
  };
  renderer.update([changed]);
  expect(map.addSource).toHaveBeenCalledTimes(1);
  expect(map.addLayer).toHaveBeenCalledTimes(1);
  expect(
    sources.get("easy-ui-overlay-observations")!.setData,
  ).toHaveBeenCalledWith(changed.data);
  expect(map.setLayoutProperty).toHaveBeenLastCalledWith(
    "easy-ui-overlay-observations/points",
    "visibility",
    "none",
  );
  renderer.update([{ ...changed, visible: true }]);
  expect(map.setLayoutProperty).toHaveBeenLastCalledWith(
    "easy-ui-overlay-observations/points",
    "visibility",
    "visible",
  );
});

it("replaces layer styling and honors layer visibility separately", () => {
  const { map, renderer } = fakeMap();
  const overlay = investigationOverlays("light")[2];
  renderer.update([overlay]);
  renderer.update([
    {
      ...overlay,
      layers: [
        {
          id: "points",
          type: "circle",
          layout: { visibility: "none" },
          paint: { "circle-radius": 12 },
        },
      ],
    },
  ]);
  expect(map.removeLayer).toHaveBeenCalledWith(
    "easy-ui-overlay-observations/points",
  );
  expect(map.addLayer).toHaveBeenLastCalledWith(
    expect.objectContaining({
      layout: { visibility: "none" },
      paint: { "circle-radius": 12 },
    }),
  );
});

it("selects only the topmost overlay feature once per click", () => {
  const { map, renderer, onSelect } = fakeMap();
  const overlays = investigationOverlays("light");
  renderer.update(overlays);
  const original = overlays[2].data.features[0];
  const data = map.addSource.mock.calls[2][1].data;
  const feature = {
    ...data.features[0],
    id: 0,
    geometry: { type: "Point", coordinates: [-87.6301, 41.8801] },
    layer: { id: "easy-ui-overlay-observations/points" },
  };
  map.queryRenderedFeatures.mockReturnValue([
    feature,
    { ...feature, layer: { id: "easy-ui-overlay-service-area/fill" } },
  ]);
  const click = map.on.mock.calls[0][1] as unknown as (
    event: MapMouseEvent,
  ) => void;
  click({
    point: { x: 10, y: 20 },
    lngLat: { lng: -87, lat: 41 },
  } as MapMouseEvent);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith({
    overlayId: "observations",
    feature: original,
    coordinate: [-87, 41],
  });
});

it("does not collide with caller properties or select stale hits after data replacement", () => {
  const { map, renderer, onSelect } = fakeMap();
  const overlay = investigationOverlays("light")[2];
  overlay.data.features[0].properties = {
    __easy_ui_overlay_feature: "caller value",
  };
  overlay.data.features[1].properties = null;
  renderer.update([overlay]);
  const data = map.addSource.mock.calls[0][1].data;
  expect(data.features[0].properties).toMatchObject({
    __easy_ui_overlay_feature: "caller value",
    __easy_ui_overlay_feature_: 0,
  });
  const feature = {
    ...data.features[0],
    layer: { id: "easy-ui-overlay-observations/points" },
  };
  map.queryRenderedFeatures.mockReturnValue([feature]);
  const click = map.on.mock.calls[0][1] as unknown as (
    event: MapMouseEvent,
  ) => void;
  const event = {
    point: { x: 10, y: 20 },
    lngLat: { lng: -87, lat: 41 },
  } as MapMouseEvent;
  click(event);
  expect(onSelect.mock.calls[0][0].feature).toBe(overlay.data.features[0]);
  renderer.update([{ ...overlay, data: { ...overlay.data, features: [] } }]);
  click(event);
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it("never reuses retired caller keys when a stale hit could impersonate a surviving feature", () => {
  const { map, renderer, onSelect, sources } = fakeMap();
  const overlay = investigationOverlays("light")[2];
  const [retired, retained] = overlay.data.features;
  retired.properties = { __easy_ui_overlay_feature: 1 };
  retained.properties = {};
  renderer.update([
    { ...overlay, data: { ...overlay.data, features: [retired, retained] } },
  ]);
  const originalData = map.addSource.mock.calls[0][1].data;
  map.queryRenderedFeatures.mockReturnValue([
    {
      ...originalData.features[0],
      layer: { id: "easy-ui-overlay-observations/points" },
    },
  ]);
  const click = map.on.mock.calls[0][1] as unknown as (
    event: MapMouseEvent,
  ) => void;
  const event = {
    point: { x: 10, y: 20 },
    lngLat: { lng: -87, lat: 41 },
  } as MapMouseEvent;
  renderer.update([
    { ...overlay, data: { ...overlay.data, features: [retained] } },
  ]);
  click(event);
  expect(onSelect).not.toHaveBeenCalled();
  const updateData = sources.get("easy-ui-overlay-observations")!.setData;
  expect(updateData.mock.calls[0][0].features[0].properties).toEqual({
    __easy_ui_overlay_feature_: 1,
  });
  const replacement = {
    ...retained,
    properties: { __easy_ui_overlay_feature_: 1 },
  };
  renderer.update([
    { ...overlay, data: { ...overlay.data, features: [replacement] } },
  ]);
  click(event);
  expect(onSelect).not.toHaveBeenCalled();
  const current = updateData.mock.calls[1][0].features[0];
  expect(current.properties).toEqual({
    __easy_ui_overlay_feature_: 1,
    __easy_ui_overlay_feature__: 2,
  });
  map.queryRenderedFeatures.mockReturnValue([
    { ...current, layer: { id: "easy-ui-overlay-observations/points" } },
  ]);
  click(event);
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ feature: replacement }),
  );
});

it("removes its layers before sources and unregisters selection without touching foreign layers", () => {
  const { map, renderer, layers, sources } = fakeMap();
  layers.set("foreign", {});
  sources.set("foreign", { setData: vi.fn() });
  renderer.update(investigationOverlays("light"));
  renderer.update([]);
  expect(layers.size).toBe(1);
  expect(sources.size).toBe(1);
  expect(map.off).toHaveBeenCalledWith("click", expect.any(Function));
  expect(Math.max(...map.removeLayer.mock.invocationCallOrder)).toBeLessThan(
    Math.max(...map.removeSource.mock.invocationCallOrder),
  );
});

it("rejects duplicate overlay and layer IDs before mutating the map", () => {
  const { map, renderer } = fakeMap();
  const overlay = investigationOverlays("light")[2];
  expect(() => renderer.update([overlay, overlay])).toThrow(/unique/);
  expect(() =>
    renderer.update([
      { ...overlay, layers: [...overlay.layers, ...overlay.layers] },
    ]),
  ).toThrow(/unique/);
  expect(map.addSource).not.toHaveBeenCalled();
});

it("does not claim a source belonging to the caller", () => {
  const { sources, renderer, map } = fakeMap();
  sources.set("easy-ui-overlay-observations", { setData: vi.fn() });
  expect(() => renderer.update([investigationOverlays("light")[2]])).toThrow(
    /already exists/,
  );
  renderer.dispose();
  expect(map.removeSource).not.toHaveBeenCalled();
});

it("collects coordinates from multi-geometries and geometry collections but not hidden or invalid features", () => {
  const overlay: MapOverlay = {
    id: "geometry",
    layers: [],
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "GeometryCollection",
            geometries: [
              {
                type: "MultiPoint",
                coordinates: [
                  [10, 20],
                  [30, 40, 50],
                  [NaN, 5],
                ],
              },
              {
                type: "MultiPolygon",
                coordinates: [
                  [
                    [
                      [1, 2],
                      [2, 3],
                      [3, 2],
                      [1, 2],
                    ],
                  ],
                ],
              },
            ],
          },
        },
      ],
    },
  };
  expect(overlayCoordinates([overlay])).toEqual([
    [10, 20],
    [30, 40],
    [1, 2],
    [2, 3],
    [3, 2],
    [1, 2],
  ]);
  expect(overlayCoordinates([{ ...overlay, visible: false }])).toEqual([]);
});

it("fits connected GeoJSON extents rather than wrapping a wide area into its complement", () => {
  const overlay: MapOverlay = {
    id: "wide-area",
    layers: [{ id: "fill", type: "fill" }],
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-170, -20],
                [170, -20],
                [170, 20],
                [-170, 20],
                [-170, -20],
              ],
            ],
          },
        },
      ],
    },
  };
  expect(overlayFitBounds([], [overlay])).toEqual([
    [-170, -20],
    [170, 20],
  ]);
  expect(overlayFitBounds([[-175, 30]], [overlay])).toEqual([
    [-175, -20],
    [170, 30],
  ]);
  expect(overlayFitBounds([], [{ ...overlay, visible: false }])).toBeNull();
  expect(
    overlayCoordinates([{ ...overlay, visible: false }], true),
  ).toHaveLength(5);
  expect(
    overlayFitBounds([
      [-170, 0],
      [170, 0],
    ]),
  ).toEqual([
    [170, 0],
    [190, 0],
  ]);
});
