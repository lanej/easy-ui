import { act, renderHook } from "@testing-library/react";
import type { Map as MapInstance } from "maplibre-gl";
import type { MapOverlay, NetworkMapProps } from "./types";
import { useOverlayInspection } from "./useOverlayInspection";

const feature: MapOverlay["data"]["features"][number] = {
  type: "Feature",
  id: 0,
  properties: { label: "Scan", count: 2 },
  geometry: { type: "Point", coordinates: [1, 2] },
};
const overlay: MapOverlay = {
  id: "scans",
  data: { type: "FeatureCollection", features: [feature] },
  layers: [{ id: "points", type: "circle" }],
};
const options: NetworkMapProps = {
  mapStyle: { version: 8, sources: {}, layers: [] },
  workerUrl: "/worker.js",
  overlays: [overlay],
  renderOverlayDetails: () => "Details",
};
const map = {
  project: vi.fn(() => ({ x: 10, y: 20 })),
} as unknown as MapInstance;
const selection = {
  overlayId: overlay.id,
  feature,
  coordinate: [1, 2] as const,
};

beforeEach(() => vi.clearAllMocks());

it("keeps original records and stable handlers while following camera movement", () => {
  const { result, rerender } = renderHook(useOverlayInspection, {
    initialProps: options,
  });
  const events = result.current.events;
  act(() => events.select(selection, map));
  expect(result.current.context?.feature).toBe(feature);
  expect(result.current.context?.overlay).toBe(overlay);
  expect(result.current.inspection).toMatchObject({ x: 10, y: 20 });
  vi.mocked(map.project).mockReturnValue({ x: 30, y: 40 } as ReturnType<
    MapInstance["project"]
  >);
  act(() => events.move(map));
  expect(result.current.inspection).toMatchObject({ x: 30, y: 40 });
  rerender({ ...options });
  expect(result.current.events).toBe(events);
  act(() => events.close());
  expect(result.current.context).toBeNull();
});

it("reads fresh immutable data by stable feature ID", () => {
  const { result, rerender } = renderHook(useOverlayInspection, {
    initialProps: options,
  });
  act(() => result.current.events.select(selection, map));
  const updated = { ...feature, properties: { count: 12 } };
  const updatedOverlay = {
    ...overlay,
    data: { ...overlay.data, features: [updated] },
  };
  rerender({ ...options, overlays: [updatedOverlay] });
  expect(result.current.context?.feature).toBe(updated);
  expect(result.current.context?.overlay).toBe(updatedOverlay);
});

it.each(["hidden", "removed", "empty", "noRenderer", "hiddenLayers"] as const)(
  "clears the inspector when %s",
  (condition) => {
    const { result, rerender } = renderHook(useOverlayInspection, {
      initialProps: options,
    });
    act(() => result.current.events.select(selection, map));
    const next = { ...options };
    if (condition === "hidden")
      next.overlays = [{ ...overlay, visible: false }];
    if (condition === "removed") next.overlays = [];
    if (condition === "empty")
      next.overlays = [{ ...overlay, data: { ...overlay.data, features: [] } }];
    if (condition === "noRenderer") next.renderOverlayDetails = undefined;
    if (condition === "hiddenLayers")
      next.overlays = [
        {
          ...overlay,
          layers: [
            { id: "points", type: "circle", layout: { visibility: "none" } },
          ],
        },
      ];
    rerender(next);
    expect(result.current.context).toBeNull();
    expect(result.current.inspection).toBeNull();
  },
);

it("does not guess a replacement for removed anonymous or ambiguous features", () => {
  const anonymous = { ...feature, id: undefined };
  const { result, rerender } = renderHook(useOverlayInspection, {
    initialProps: {
      ...options,
      overlays: [
        { ...overlay, data: { ...overlay.data, features: [anonymous] } },
      ],
    } as NetworkMapProps,
  });
  act(() =>
    result.current.events.select({ ...selection, feature: anonymous }, map),
  );
  rerender({
    ...options,
    overlays: [
      { ...overlay, data: { ...overlay.data, features: [{ ...anonymous }] } },
    ],
  });
  expect(result.current.context).toBeNull();
  rerender(options);
  act(() => result.current.events.select(selection, map));
  rerender({
    ...options,
    overlays: [
      {
        ...overlay,
        data: { ...overlay.data, features: [{ ...feature }, { ...feature }] },
      },
    ],
  });
  expect(result.current.context).toBeNull();
});

it("does not open an inspector without a renderer or map coordinate", () => {
  const { result, rerender } = renderHook(useOverlayInspection, {
    initialProps: {
      ...options,
      renderOverlayDetails: undefined,
    } as NetworkMapProps,
  });
  act(() => result.current.events.select(selection, map));
  expect(result.current.context).toBeNull();
  rerender(options);
  act(() =>
    result.current.events.select({ ...selection, coordinate: undefined }, map),
  );
  expect(result.current.context).toBeNull();
});
