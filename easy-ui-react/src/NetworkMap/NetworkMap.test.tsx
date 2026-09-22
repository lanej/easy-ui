import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NetworkMap } from "./NetworkMap";
import { NetworkMapProvider } from "./NetworkMapContext";
import { NetworkMapSurface } from "./NetworkMapSurface";
import {
  NetworkMapControlPanel,
  NetworkMapDataView,
} from "./NetworkMapCompanions";
import { loadMapEngine } from "./engine";
import { surfaceData } from "./geometry";
import type { NetworkMapProps } from "./types";
vi.mock("./engine", () => ({ loadMapEngine: vi.fn() }));
const fitBounds = vi.fn(),
  easeTo = vi.fn(),
  remove = vi.fn(),
  addControl = vi.fn(),
  removeControl = vi.fn(),
  setData = vi.fn(),
  getClusterExpansionZoom = vi.fn().mockResolvedValue(9);
const listeners: Record<string, (...args: unknown[]) => void> = {};
const sources = new Set<string>();
// Full addSource() definitions, keyed by id, so tests can assert cluster/clusterMaxZoom/clusterRadius.
const sourceDefs = new Map<string, Record<string, unknown>>();
// Full addLayer() definitions, keyed by id, so tests can assert data-driven paint expressions
// beyond just line-color (see layerPaint below, which only tracks that one property).
const layerDefs = new Map<string, Record<string, unknown>>();
const constructor = vi.fn();
const layerPaint = new Map<string, unknown>();
const paintProperties = new Map<string, Map<string, unknown>>();
// Records addLayer/addSource/setPaintProperty/setLayoutProperty call order (by id) so tests can
// assert a consumer-visible callback (e.g. onMapReady) fires only after this component's own
// layer setup, and that a visibility toggle actually reaches the map.
let callOrder: string[] = [];
const setPaintProperty = vi.fn((id: string, prop: string, value: unknown) => {
  const properties = paintProperties.get(id)!;
  if (value == null) properties.delete(prop);
  else properties.set(prop, structuredClone(value));
  if (prop === "line-color") layerPaint.set(id, value);
  callOrder.push(`setPaintProperty:${id}`);
});
const setLayoutProperty = vi.fn((id: string, _prop: string, value: unknown) => {
  callOrder.push(`setLayoutProperty:${id}:${value}`);
});
const setFilter = vi.fn((id: string, value: unknown) => {
  const layer = layerDefs.get(id);
  if (layer) layer.filter = value;
});
// Test-controlled stand-in for MapLibre's own clustering computation (normally done by the
// bundled supercluster library against loaded tiles) — set per test to whatever
// querySourceFeatures should currently report.
let sourceFeatures: {
  properties?: Record<string, unknown>;
  geometry: { type: "Point"; coordinates: [number, number] };
}[] = [];
function matchesFilter(
  feature: (typeof sourceFeatures)[number],
  filter: unknown,
): boolean {
  if (!filter) return true;
  const [op, arg] = filter as [string, unknown];
  if (op === "has")
    return arg === "point_count" && "point_count" in (feature.properties ?? {});
  if (op === "!") return !matchesFilter(feature, arg);
  return true;
}
class FakeMap {
  constructor(options: unknown) {
    // Passing `this` lets tests recover the exact instance the component received, e.g. to
    // assert onMapReady was called with that same live map object.
    constructor(this, options);
  }
  on(
    type: string,
    layerOrListener: string | ((...args: unknown[]) => void),
    listener?: (...args: unknown[]) => void,
  ) {
    if (typeof layerOrListener === "string")
      listeners[`${type}:${layerOrListener}`] = listener!;
    else listeners[type] = layerOrListener;
  }
  addControl = addControl;
  removeControl = removeControl;
  addSource(id: string, definition: Record<string, unknown>) {
    sources.add(id);
    sourceDefs.set(id, definition);
    callOrder.push(`addSource:${id}`);
  }
  addLayer(layer: { id: string; paint?: Record<string, unknown> }) {
    paintProperties.set(
      layer.id,
      new Map(Object.entries(structuredClone(layer.paint ?? {}))),
    );
    if (layer.paint && "line-color" in layer.paint)
      layerPaint.set(layer.id, layer.paint["line-color"]);
    layerDefs.set(layer.id, layer);
    callOrder.push(`addLayer:${layer.id}`);
  }
  addImage() {}
  getSource(id: string) {
    return sources.has(id) ? { setData, getClusterExpansionZoom } : undefined;
  }
  querySourceFeatures(_id: string, params?: { filter?: unknown }) {
    return sourceFeatures.filter((f) => matchesFilter(f, params?.filter));
  }
  isSourceLoaded() {
    return true;
  }
  getCanvas() {
    return { style: {} as CSSStyleDeclaration };
  }
  setPaintProperty = setPaintProperty;
  getPaintProperty(id: string, prop: string) {
    return structuredClone(paintProperties.get(id)?.get(prop));
  }
  setLayoutProperty = setLayoutProperty;
  setFilter = setFilter;
  getZoom() {
    return 9;
  }
  project() {
    return { x: 200, y: 100 };
  }
  resize() {}
  fitBounds = fitBounds;
  easeTo = easeTo;
  remove = remove;
}
class FakeMarker {
  el: HTMLElement;
  constructor({ element }: { element: HTMLElement }) {
    this.el = element;
    this.el.classList.add("maplibregl-marker");
  }
  setLngLat() {
    return this;
  }
  addTo() {
    document.querySelector("[data-map-state] > div")!.append(this.el);
    return this;
  }
  remove() {
    this.el.remove();
  }
}
const engine = {
  setWorkerUrl: vi.fn(),
  Map: FakeMap,
  Marker: FakeMarker,
  NavigationControl: class {},
  ScaleControl: class {},
} as unknown as Awaited<ReturnType<typeof loadMapEngine>>;
const props = {
  title: "Network",
  description: "Observed handoffs",
  mapStyle: { version: 8, sources: {}, layers: [] },
  workerUrl: "/map-worker.js",
  facilities: [
    { id: "one", label: "Oakland", coordinates: [-122, 38], kind: "warehouse" },
  ],
  segments: [],
  onFacilitySelect: vi.fn(),
} satisfies NetworkMapProps;
beforeEach(() => {
  vi.clearAllMocks();
  sources.clear();
  sourceDefs.clear();
  layerDefs.clear();
  sourceFeatures = [];
  layerPaint.clear();
  paintProperties.clear();
  callOrder = [];
  for (const key of Object.keys(listeners)) delete listeners[key];
  getClusterExpansionZoom.mockResolvedValue(9);
  vi.mocked(loadMapEngine).mockResolvedValue(engine);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
it("restores camera commands during Strict Mode replay and map reloads", async () => {
  const view = (
    facilities: NetworkMapProps["facilities"] = props.facilities,
  ) => (
    <React.StrictMode>
      <NetworkMap {...props} facilities={facilities} />
    </React.StrictMode>
  );
  const { rerender } = render(view());
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  expect(fitBounds).toHaveBeenCalledTimes(1);
  expect(fitBounds).toHaveBeenLastCalledWith(
    [
      [-122, 38],
      [-122, 38],
    ],
    expect.objectContaining({ maxZoom: 11 }),
  );
  rerender(view([{ ...props.facilities[0], coordinates: [2.35, 48.86] }]));
  fireEvent.click(screen.getByRole("button", { name: "Fit all locations" }));
  expect(fitBounds).toHaveBeenCalledTimes(2);
  const updatedBounds = fitBounds.mock.lastCall![0];
  expect(updatedBounds[0][0]).toBeCloseTo(2.35);
  expect(updatedBounds[0][1]).toBe(48.86);

  act(() => listeners.error({ error: new Error("Transient basemap failure") }));
  fireEvent.click(screen.getByRole("button", { name: "Reload map" }));
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(2));
  act(() => listeners.load());
  expect(fitBounds).toHaveBeenCalledTimes(3);
  expect(fitBounds.mock.lastCall![0]).toEqual(updatedBounds);
  fireEvent.click(screen.getByRole("button", { name: "Fit all locations" }));
  expect(fitBounds).toHaveBeenCalledTimes(4);
});

it("retains an explicit initial view in Strict Mode while keeping fit controls usable", async () => {
  const initialView = { center: [2.35, 48.86] as const, zoom: 8 };
  render(
    <React.StrictMode>
      <NetworkMap {...props} initialView={initialView} />
    </React.StrictMode>,
  );
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  expect(constructor.mock.calls[0][1]).toMatchObject(initialView);
  expect(fitBounds).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Fit all locations" }));
  expect(fitBounds).toHaveBeenCalledOnce();
});

it("preserves camera and focused markers when observations or selection update, and cleans up", async () => {
  const view = render(<NetworkMap {...props} />);
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  expect(fitBounds).toHaveBeenCalledTimes(1);
  const marker = screen.getByRole("button", { name: "Select Oakland" });
  marker.focus();
  view.rerender(
    <NetworkMap
      {...props}
      selectedFacilityId="one"
      facilities={[{ ...props.facilities[0], detail: "New scan" }]}
    />,
  );
  expect(constructor).toHaveBeenCalledTimes(1);
  expect(fitBounds).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(marker);
  expect(marker).toHaveClass("maplibregl-marker");
  expect(marker).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Selected facility")).toBeInTheDocument();
  view.rerender(
    <NetworkMap
      {...props}
      selectedFacilityId="one"
      showSelectionDetails={false}
    />,
  );
  expect(screen.queryByText("Selected facility")).not.toBeInTheDocument();
  expect(marker).toHaveAttribute("aria-pressed", "true");
  expect(document.activeElement).toBe(marker);
  expect(constructor).toHaveBeenCalledTimes(1);
  expect(fitBounds).toHaveBeenCalledTimes(1);
  fireEvent.click(marker);
  expect(props.onFacilitySelect).toHaveBeenCalledWith("one");
  view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
it("keeps data available after an engine failure and retries explicitly", async () => {
  vi.mocked(loadMapEngine).mockRejectedValueOnce(
    new Error("WebGL unavailable"),
  );
  const onRenderError = vi.fn();
  render(<NetworkMap {...props} onRenderError={onRenderError} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to display the map",
  );
  expect(screen.getByText("Oakland")).toBeInTheDocument();
  expect(onRenderError).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("does not create a map when unmounted before its lazy engine resolves", async () => {
  let resolve!: (value: typeof engine) => void;
  vi.mocked(loadMapEngine).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const view = render(<NetworkMap {...props} />);
  view.unmount();
  await act(async () => resolve(engine));
  expect(constructor).not.toHaveBeenCalled();
});

it("exposes stalled worker/style initialization instead of loading indefinitely", async () => {
  vi.useFakeTimers();
  try {
    render(<NetworkMap {...props} />);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to display the map",
    );
    expect(screen.getByText("Oakland")).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it("prefers a caller-supplied per-segment color and falls back to the evidence scheme otherwise", async () => {
  const segmentProps: NetworkMapProps = {
    ...props,
    facilities: [
      ...props.facilities,
      { id: "two", label: "Reno", coordinates: [-119, 39], kind: "hub" },
    ],
    segments: [
      {
        id: "colored",
        from: "one",
        to: "two",
        label: "Oakland to Reno",
        evidence: "transfer",
        color: "#00ff00",
      },
    ],
  };
  render(<NetworkMap {...segmentProps} />);
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  // The observed layer's blue resolves from --map-route, a design-token() reference in
  // NetworkMap.module.scss; the unobserved layer's amber is a plain hex literal there.
  expect(layerPaint.get("easy-ui-observed")).toEqual([
    "coalesce",
    ["get", "color"],
    "var(--ezui-color-primary-600)",
  ]);
  expect(layerPaint.get("easy-ui-unobserved")).toEqual([
    "coalesce",
    ["get", "color"],
    "#9b5900",
  ]);
});

it("sets a caller-supplied facility marker color as a CSS custom property and clears it once removed", async () => {
  const colorProps: NetworkMapProps = {
    ...props,
    facilities: [{ ...props.facilities[0], color: "#ff00ff" }],
  };
  const view = render(<NetworkMap {...colorProps} />);
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  const marker = screen.getByRole("button", { name: "Select Oakland" });
  const dot = marker.firstElementChild as HTMLElement;
  expect(dot.style.getPropertyValue("--map-facility-color")).toBe("#ff00ff");
  view.rerender(
    <NetworkMap {...colorProps} facilities={[props.facilities[0]]} />,
  );
  expect(dot.style.getPropertyValue("--map-facility-color")).toBe("");
});

it("clamps a height below the floor to 220px instead of the caller-supplied value", async () => {
  render(<NetworkMap {...props} height={200} />);
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  const canvas = document.querySelector(
    "[data-map-state] > div",
  ) as HTMLElement;
  expect(canvas.style.height).toBe("220px");
});

it("calls onMapReady exactly once, with the live map instance, only after the component's own layer setup", async () => {
  const onMapReady = vi.fn(() => callOrder.push("onMapReady"));
  const view = render(<NetworkMap {...props} onMapReady={onMapReady} />);
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  const instance = constructor.mock.calls[0][0];
  act(() => listeners.load());

  expect(onMapReady).toHaveBeenCalledTimes(1);
  expect(onMapReady).toHaveBeenCalledWith(instance);

  const readyIndex = callOrder.indexOf("onMapReady");
  expect(readyIndex).toBeGreaterThan(0);
  const before = callOrder.slice(0, readyIndex);
  // The component's own sources/layers must already exist...
  expect(before).toEqual(
    expect.arrayContaining([
      "addSource:easy-ui-transfers",
      "addSource:easy-ui-weather",
      "addLayer:easy-ui-weather-fill",
      "addLayer:easy-ui-weather-edge",
      "addLayer:easy-ui-casing",
      "addLayer:easy-ui-observed",
      "addLayer:easy-ui-unobserved",
      "addLayer:easy-ui-direction",
    ]),
  );
  // ...AND its own first paint-property pass (from the initial update()) must already have run,
  // not just layer creation — otherwise a consumer's own setPaintProperty override could still
  // be clobbered by the component's own baseline call.
  expect(before).toContain("setPaintProperty:easy-ui-observed");

  // A later data/selection update must not re-fire onMapReady — the callback is mount-scoped,
  // not tied to this component's ongoing refresh effect.
  view.rerender(
    <NetworkMap {...props} onMapReady={onMapReady} selectedFacilityId="one" />,
  );
  expect(onMapReady).toHaveBeenCalledTimes(1);
  expect(callOrder.filter((c) => c === "onMapReady")).toHaveLength(1);
});

describe("consumer paint ownership", () => {
  const routeProps = {
    ...props,
    facilities: [
      ...props.facilities,
      { id: "two", label: "Reno", coordinates: [-119, 39], kind: "hub" },
    ],
    segments: [
      {
        id: "leg",
        from: "one",
        to: "two",
        label: "Oakland to Reno",
        evidence: "transfer",
      },
    ],
  } satisfies NetworkMapProps;
  const observedColor = () =>
    paintProperties.get("easy-ui-observed")?.get("line-color");

  it.each([undefined, []])(
    "preserves onMapReady overrides through readiness, data, selection, and layer updates (areas=%s)",
    async (areas) => {
      const onMapReady = vi.fn((map) => {
        map.setPaintProperty("easy-ui-observed", "line-color", "#ff0099");
        map.setPaintProperty("easy-ui-observed", "line-width", 7);
      });
      const view = render(
        <NetworkMap {...routeProps} areas={areas} onMapReady={onMapReady} />,
      );
      await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
      act(() => listeners.load());
      expect(observedColor()).toBe("#ff0099");

      view.rerender(
        <NetworkMap
          {...routeProps}
          areas={areas}
          onMapReady={onMapReady}
          facilities={[
            { ...routeProps.facilities[0], detail: "New scan" },
            routeProps.facilities[1],
          ]}
          segments={[{ ...routeProps.segments[0], volume: 25 }]}
          selectedFacilityId="two"
          selectedSegmentId="leg"
          layerVisibility={{ weather: true }}
        />,
      );
      expect(observedColor()).toBe("#ff0099");
      expect(paintProperties.get("easy-ui-observed")?.get("line-width")).toBe(
        7,
      );
      expect(
        screen.getByRole("button", { name: "Select Oakland: New scan" }),
      ).toBeInTheDocument();
      expect(setLayoutProperty).toHaveBeenCalledWith(
        "easy-ui-weather-fill",
        "visibility",
        "visible",
      );
      expect(onMapReady).toHaveBeenCalledTimes(1);
      expect(constructor).toHaveBeenCalledTimes(1);
      expect(fitBounds).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves expression overrides applied to the retained map after readiness", async () => {
    const view = render(<NetworkMap {...routeProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const map = constructor.mock.calls[0][0] as FakeMap;
    const customColor = [
      "case",
      ["==", ["get", "id"], "leg"],
      "#ff0099",
      "#008855",
    ];
    map.setPaintProperty("easy-ui-observed", "line-color", customColor);
    view.rerender(<NetworkMap {...routeProps} selectedSegmentId="leg" />);
    expect(map.getPaintProperty("easy-ui-observed", "line-color")).toEqual(
      customColor,
    );
  });

  it("continues automatic selection styling when the consumer has not overridden color", async () => {
    const view = render(<NetworkMap {...routeProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const baseline = structuredClone(observedColor());
    view.rerender(<NetworkMap {...routeProps} selectedSegmentId="leg" />);
    expect(observedColor()).toEqual([
      "coalesce",
      ["get", "color"],
      [
        "case",
        ["==", ["get", "id"], "leg"],
        "var(--ezui-color-primary-600)",
        "var(--ezui-color-neutral-600)",
      ],
    ]);
    view.rerender(<NetworkMap {...routeProps} />);
    expect(observedColor()).toEqual(baseline);
  });

  it("restores automatic color after a consumer clears its override", async () => {
    const onMapReady = vi.fn((map) => {
      map.setPaintProperty("easy-ui-observed", "line-color", "#ff0099");
      map.setPaintProperty("easy-ui-observed", "line-width", 7);
    });
    const view = render(<NetworkMap {...routeProps} onMapReady={onMapReady} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const map = constructor.mock.calls[0][0] as FakeMap;
    map.setPaintProperty("easy-ui-observed", "line-color", null);
    view.rerender(
      <NetworkMap
        {...routeProps}
        onMapReady={onMapReady}
        selectedSegmentId="leg"
      />,
    );
    expect(observedColor()).toEqual([
      "coalesce",
      ["get", "color"],
      expect.arrayContaining([["==", ["get", "id"], "leg"]]),
    ]);
    expect(map.getPaintProperty("easy-ui-observed", "line-width")).toBe(7);
  });

  it("reapplies customization to a newly initialized map instance", async () => {
    const onMapReady = vi.fn((map) =>
      map.setPaintProperty("easy-ui-observed", "line-color", "#ff0099"),
    );
    const view = render(<NetworkMap {...routeProps} onMapReady={onMapReady} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    view.rerender(
      <NetworkMap
        {...routeProps}
        onMapReady={onMapReady}
        workerUrl="/replacement-worker.js"
      />,
    );
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(2));
    act(() => listeners.load());
    expect(onMapReady).toHaveBeenCalledTimes(2);
    expect(observedColor()).toBe("#ff0099");
  });
});

describe("clusterFacilities", () => {
  const clusterProps: NetworkMapProps = {
    ...props,
    facilities: [
      {
        id: "one",
        label: "Oakland",
        coordinates: [-122, 38],
        kind: "warehouse",
      },
      { id: "two", label: "Newark", coordinates: [-74.15, 40.72], kind: "hub" },
    ],
  };

  it("is fully backward compatible: omitting it never adds a clustering source or layer", async () => {
    render(<NetworkMap {...clusterProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(sources.has("easy-ui-facility-clusters")).toBe(false);
    expect(callOrder.some((c) => c.includes("facility-cluster"))).toBe(false);
    // Every facility still renders as its own interactive Marker, exactly as before.
    expect(
      screen.getByRole("button", { name: "Select Oakland" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select Newark" }),
    ).toBeInTheDocument();
  });

  it("adds a clustered GeoJSON source and cluster layers, configured from the given options", async () => {
    render(
      <NetworkMap
        {...clusterProps}
        clusterFacilities={{ radius: 40, maxZoom: 10 }}
      />,
    );
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(sourceDefs.get("easy-ui-facility-clusters")).toMatchObject({
      type: "geojson",
      cluster: true,
      clusterMaxZoom: 10,
      clusterRadius: 40,
    });
    expect(callOrder).toContain("addLayer:easy-ui-facility-cluster-circles");
    expect(callOrder).toContain("addLayer:easy-ui-facility-cluster-count");
  });

  it("defaults maxZoom/radius when the options object is empty", async () => {
    render(<NetworkMap {...clusterProps} clusterFacilities={{}} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(sourceDefs.get("easy-ui-facility-clusters")).toMatchObject({
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });
  });

  it("does not render an individual Marker for a facility MapLibre currently reports as clustered", async () => {
    // Both facilities are merged into one cluster point — querySourceFeatures reports zero
    // unclustered leaves, mirroring what a real, not-yet-declustered zoom level would report.
    sourceFeatures = [
      {
        properties: { cluster: true, cluster_id: 7, point_count: 2 },
        geometry: { type: "Point", coordinates: [-100, 39] },
      },
    ];
    render(<NetworkMap {...clusterProps} clusterFacilities={{}} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(
      screen.queryByRole("button", { name: "Select Oakland" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select Newark" }),
    ).not.toBeInTheDocument();
  });

  it("renders a full, interactive Marker for a facility MapLibre reports as not clustered", async () => {
    // Oakland is reported as an unclustered leaf (its own feature, no point_count); Newark is
    // still merged into a cluster — only Oakland should get a real Marker.
    sourceFeatures = [
      {
        properties: { id: "one" },
        geometry: { type: "Point", coordinates: [-122, 38] },
      },
      {
        properties: { cluster: true, cluster_id: 3, point_count: 6 },
        geometry: { type: "Point", coordinates: [-90, 39] },
      },
    ];
    render(<NetworkMap {...clusterProps} clusterFacilities={{}} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const marker = screen.getByRole("button", { name: "Select Oakland" });
    expect(marker).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Select Newark" }),
    ).not.toBeInTheDocument();
  });

  it("resyncs which facilities are clustered once MapLibre finishes (re-)tiling the source", async () => {
    // Nothing is unclustered yet (tiles not loaded) at the moment update() first runs.
    sourceFeatures = [];
    render(<NetworkMap {...clusterProps} clusterFacilities={{}} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(
      screen.queryByRole("button", { name: "Select Oakland" }),
    ).not.toBeInTheDocument();

    // MapLibre finishes tiling and now reports Oakland as an unclustered leaf.
    sourceFeatures = [
      {
        properties: { id: "one" },
        geometry: { type: "Point", coordinates: [-122, 38] },
      },
    ];
    act(() =>
      listeners["sourcedata"]({ sourceId: "easy-ui-facility-clusters" }),
    );
    expect(
      screen.getByRole("button", { name: "Select Oakland" }),
    ).toBeInTheDocument();
  });

  it("flies to a cluster's expansion zoom when the cluster circle is clicked", async () => {
    render(<NetworkMap {...clusterProps} clusterFacilities={{}} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    getClusterExpansionZoom.mockResolvedValueOnce(9);

    await act(async () => {
      listeners["click:easy-ui-facility-cluster-circles"]({
        features: [
          {
            properties: { cluster_id: 7 },
            geometry: { type: "Point", coordinates: [-100, 39] },
          },
        ],
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getClusterExpansionZoom).toHaveBeenCalledWith(7);
    expect(easeTo).toHaveBeenCalledWith({ center: [-100, 39], zoom: 9 });
  });
});

describe("delivery surface", () => {
  const surfaceProps: NetworkMapProps = {
    ...props,
    surface: {
      asOf: "2026-09-01T00:00:00Z",
      source: "spatial-prior-v1",
      cells: [
        {
          latMin: 37,
          latMax: 37.01,
          lonMin: -122,
          lonMax: -121.99,
          medianMinutes: 45,
          iqrMinutes: 10,
          n: 12,
        },
      ],
    },
  };

  it("adds a delivery-time surface geojson source built from surfaceData()", async () => {
    render(<NetworkMap {...surfaceProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(sourceDefs.get("easy-ui-delivery-surface")).toEqual({
      type: "geojson",
      data: surfaceData(surfaceProps.surface!.cells),
    });
  });

  it("adds a fill layer with data-driven fill-color/fill-opacity paint expressions", async () => {
    render(<NetworkMap {...surfaceProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const layer = layerDefs.get("easy-ui-delivery-surface-fill");
    expect(layer?.type).toBe("fill");
    expect(layer?.source).toBe("easy-ui-delivery-surface");
    expect(layer?.filter).toEqual([
      "==",
      ["get", "hasSupportedEstimate"],
      true,
    ]);
    const paint = layer?.paint as Record<string, unknown>;
    // Both must be real expressions (arrays), not fixed literals, driven by the correct
    // per-feature property (surfaceData() puts median delivery time in `medianMinutes` and
    // normalized observation count in `relativeSampleCount`).
    expect(Array.isArray(paint["fill-color"])).toBe(true);
    expect(Array.isArray(paint["fill-opacity"])).toBe(true);
    expect(JSON.stringify(paint["fill-color"])).toContain("medianMinutes");
    expect(JSON.stringify(paint["fill-opacity"])).toContain(
      "relativeSampleCount",
    );
  });

  it("keeps the delivery surface layer and its missing-data explanation hidden until toggled", async () => {
    render(<NetworkMap {...surfaceProps} />);
    expect(
      screen.queryByRole("group", { name: "Delivery time surface legend" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "easy-ui-delivery-surface-fill",
      "visibility",
      "none",
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    );
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "easy-ui-delivery-surface-fill",
      "visibility",
      "visible",
    );
  });

  it("retains missing source values while excluding them from rendering, without conflating a real zero", async () => {
    const valid = surfaceProps.surface!.cells[0];
    render(
      <NetworkMap
        {...surfaceProps}
        layerVisibility={{ deliverySurface: true }}
        surface={{
          ...surfaceProps.surface!,
          cells: [
            { ...valid, medianMinutes: null },
            { ...valid, medianMinutes: 0 },
          ],
        }}
      />,
    );
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const data = sourceDefs.get("easy-ui-delivery-surface")!.data as ReturnType<
      typeof surfaceData
    >;
    expect(
      data.features.map((feature) => ({
        median: feature.properties!.medianMinutes,
        supported: feature.properties!.hasSupportedEstimate,
      })),
    ).toEqual([
      { median: null, supported: false },
      { median: 0, supported: true },
    ]);
    expect(
      screen.getByRole("group", { name: "Delivery time surface legend" }),
    ).toHaveTextContent(
      "Cells without an estimate or observations are unfilled.",
    );
  });

  it("omits the delivery surface toggle when no surface data is supplied", async () => {
    render(<NetworkMap {...props} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(
      screen.queryByRole("checkbox", { name: "Delivery time surface" }),
    ).not.toBeInTheDocument();
  });

  it("refreshes the delivery surface source when surface data changes", async () => {
    const view = render(<NetworkMap {...surfaceProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    setData.mockClear();
    const newCells = [{ ...surfaceProps.surface!.cells[0], medianMinutes: 90 }];
    view.rerender(
      <NetworkMap
        {...surfaceProps}
        surface={{ ...surfaceProps.surface!, cells: newCells }}
      />,
    );
    expect(setData).toHaveBeenCalledWith(surfaceData(newCells));
  });

  it("starts the surface layer visible immediately when initialDeliverySurfaceVisible is true, with no toggle click", async () => {
    render(<NetworkMap {...surfaceProps} initialDeliverySurfaceVisible />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "easy-ui-delivery-surface-fill",
      "visibility",
      "visible",
    );
    expect(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    ).toBeChecked();
  });

  it("still starts the surface layer hidden when initialDeliverySurfaceVisible is omitted, preserving current behavior", async () => {
    render(<NetworkMap {...surfaceProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    ).not.toBeChecked();
  });
});

describe("delivery surface metric switcher", () => {
  const metricsProps: NetworkMapProps = {
    ...props,
    surface: {
      asOf: "2026-09-01T00:00:00Z",
      source: "spatial-prior-v1",
      cells: [
        {
          latMin: 37,
          latMax: 37.01,
          lonMin: -122,
          lonMax: -121.99,
          medianMinutes: 45,
          iqrMinutes: 10,
          n: 12,
        },
      ],
      metrics: [
        {
          key: "median",
          label: "Median delivery time",
          field: "medianMinutes",
        },
        {
          key: "count",
          label: "Observation count",
          field: "n",
          colorScale: [
            { value: 0, color: "#000000" },
            { value: 50, color: "#ffffff" },
          ],
        },
      ],
    },
  };

  it("renders a radio per metric, defaulting to the first one, without disturbing the legacy checkbox toggle", async () => {
    render(<NetworkMap {...metricsProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(
      screen.getByRole("radio", { name: "Median delivery time" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Observation count" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    ).toBeInTheDocument();
  });

  it("switches the fill layer's paint to the selected metric's own field and colorScale", async () => {
    render(<NetworkMap {...metricsProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    fireEvent.click(screen.getByRole("radio", { name: "Observation count" }));
    const fillColor = JSON.stringify(
      paintProperties.get("easy-ui-delivery-surface-fill")?.get("fill-color"),
    );
    expect(fillColor).toContain('"n"');
    expect(fillColor).not.toContain("medianMinutes");
    expect(fillColor).toContain("#000000");
    // A single selected metric renders alone -- opacity must no longer blend in a second
    // variable's relative sample count.
    expect(
      JSON.stringify(
        paintProperties
          .get("easy-ui-delivery-surface-fill")
          ?.get("fill-opacity"),
      ),
    ).not.toContain("relativeSampleCount");
  });

  it("omits the metric switcher and keeps the legacy opacity legend note when no metrics are supplied", async () => {
    const legacyProps: NetworkMapProps = {
      ...props,
      initialDeliverySurfaceVisible: true,
      surface: { ...metricsProps.surface!, metrics: undefined },
    };
    render(<NetworkMap {...legacyProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(
      screen.queryByRole("radiogroup", { name: /delivery surface metric/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Delivery time surface legend" }),
    ).toHaveTextContent("Opacity compares observation counts within this map.");
    // Backward compatibility: unmodified legacy paint, driven by medianMinutes/relativeSampleCount.
    const layer = layerDefs.get("easy-ui-delivery-surface-fill");
    expect(JSON.stringify(layer?.paint)).toContain("medianMinutes");
    expect(JSON.stringify(layer?.paint)).toContain("relativeSampleCount");
  });
});

describe("delivery surface hover", () => {
  const hoverProps: NetworkMapProps = {
    ...props,
    initialDeliverySurfaceVisible: true,
    surface: {
      asOf: "2026-09-01T00:00:00Z",
      source: "spatial-prior-v1",
      cells: [
        {
          latMin: 37,
          latMax: 37.01,
          lonMin: -122,
          lonMax: -121.99,
          medianMinutes: 45,
          iqrMinutes: 10,
          n: 12,
        },
      ],
    },
  };

  it("shows a tooltip and calls onCellHover on mouseenter/mousemove, additive to facility click-to-select", async () => {
    const onCellHover = vi.fn();
    render(<NetworkMap {...hoverProps} onCellHover={onCellHover} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const feature = surfaceData(hoverProps.surface!.cells).features[0];
    act(() => {
      listeners["mouseenter:easy-ui-delivery-surface-fill"]({
        point: { x: 12, y: 34 },
        features: [{ properties: feature.properties }],
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent("45 min median");
    expect(screen.getByRole("status")).toHaveTextContent("12 obs.");
    expect(onCellHover).toHaveBeenCalledWith(
      expect.objectContaining({ medianMinutes: 45, n: 12 }),
    );
    // Facility click-to-select remains available -- hover wiring is additive, not a replacement.
    expect(
      screen.getByRole("button", { name: "Select Oakland" }),
    ).toBeInTheDocument();
  });

  it("clears the tooltip and calls onCellHover(null) on mouseleave", async () => {
    const onCellHover = vi.fn();
    render(<NetworkMap {...hoverProps} onCellHover={onCellHover} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const feature = surfaceData(hoverProps.surface!.cells).features[0];
    act(() => {
      listeners["mouseenter:easy-ui-delivery-surface-fill"]({
        point: { x: 12, y: 34 },
        features: [{ properties: feature.properties }],
      });
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => {
      listeners["mouseleave:easy-ui-delivery-surface-fill"]();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onCellHover).toHaveBeenLastCalledWith(null);
  });

  it("renders no hover tooltip before any hover, preserving current behavior for callers that don't pass onCellHover", async () => {
    render(<NetworkMap {...hoverProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("applicable controls and layer visibility", () => {
  const applicableProps: NetworkMapProps = {
    ...props,
    facilities: [
      {
        ...props.facilities[0],
        risk: {
          probability: 0.2,
          baseline: 0.1,
          event: "Exception",
          horizonHours: 24,
          cohort: "Observed shipments",
          asOf: "2026-09-01T00:00:00Z",
          status: "current",
        },
      },
      { id: "two", label: "Reno", kind: "hub", coordinates: [-119, 39] },
    ],
    segments: [
      {
        id: "leg",
        from: "one",
        to: "two",
        label: "Handoff",
        evidence: "transfer",
      },
    ],
    selectedSegmentId: "leg",
    latestFacilityId: "one",
    areas: [
      {
        id: "rain",
        label: "Rain",
        coordinates: [
          [-122, 37],
          [-121, 37],
          [-122, 38],
        ],
        evidence: "forecast",
        validFrom: "2026-09-01T00:00:00Z",
        validUntil: "2026-09-02T00:00:00Z",
        source: "Fixture",
      },
    ],
    surface: {
      asOf: "2026-09-01T00:00:00Z",
      source: "spatial-prior-v1",
      cells: [
        {
          latMin: 37,
          latMax: 37.01,
          lonMin: -122,
          lonMax: -121.99,
          medianMinutes: 45,
          iqrMinutes: 10,
          n: 12,
        },
      ],
    },
  };
  const toolbarName = "Network camera and layers";
  const labels = ["Fit all locations", "Selected leg", "Latest events"];
  const layerLabels = ["Facility risk", "Weather", "Delivery time surface"];
  const finishLoading = async () => {
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
  };

  it("omits an empty toolbar and shows only fit for a map with plain locations", async () => {
    const view = render(<NetworkMap {...props} facilities={[]} />);
    expect(
      screen.queryByRole("group", { name: toolbarName }),
    ).not.toBeInTheDocument();
    await finishLoading();
    view.rerender(<NetworkMap {...props} />);
    const toolbar = within(screen.getByRole("group", { name: toolbarName }));
    expect(toolbar.getAllByRole("button")).toHaveLength(1);
    expect(
      toolbar.getByRole("button", { name: "Fit all locations" }),
    ).toBeEnabled();
    expect(toolbar.queryAllByRole("checkbox")).toHaveLength(0);
    expect(constructor).toHaveBeenCalledTimes(1);
  });

  it("disables only applicable controls while loading, then removes controls whose data disappears", async () => {
    const view = render(<NetworkMap {...applicableProps} />);
    for (const name of labels)
      expect(screen.getByRole("button", { name })).toBeDisabled();
    for (const name of layerLabels)
      expect(screen.getByRole("checkbox", { name })).toBeDisabled();
    await finishLoading();
    for (const name of labels)
      expect(screen.getByRole("button", { name })).toBeEnabled();
    for (const name of layerLabels)
      expect(screen.getByRole("checkbox", { name })).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Facility risk" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Weather" })).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    ).not.toBeChecked();
    view.rerender(<NetworkMap {...props} />);
    for (const name of labels.slice(1))
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    for (const name of layerLabels)
      expect(screen.queryByRole("checkbox", { name })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fit all locations" }),
    ).toBeEnabled();
    expect(constructor).toHaveBeenCalledTimes(1);
  });

  it("allows each control to be hidden independently while keeping its layer visible", async () => {
    render(
      <NetworkMap
        {...applicableProps}
        controls={{
          fitAll: false,
          selectedSegment: false,
          latestEvent: false,
          risk: false,
          weather: false,
        }}
        defaultLayerVisibility={{
          risk: true,
          weather: true,
          deliverySurface: true,
        }}
      />,
    );
    await finishLoading();
    const toolbar = within(screen.getByRole("group", { name: toolbarName }));
    expect(toolbar.queryAllByRole("button")).toHaveLength(0);
    expect(toolbar.getAllByRole("checkbox")).toHaveLength(1);
    expect(
      toolbar.getByRole("checkbox", { name: "Delivery time surface" }),
    ).toBeChecked();
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "easy-ui-weather-fill",
      "visibility",
      "visible",
    );
    expect(
      screen.getByRole("button", { name: "Select Oakland" }),
    ).toHaveAttribute("data-risk", "elevated");
  });

  it("hides all built-in controls without hiding data or provider attribution", async () => {
    render(<NetworkMap {...applicableProps} controls={false} />);
    await finishLoading();
    expect(
      screen.queryByRole("group", { name: toolbarName }),
    ).not.toBeInTheDocument();
    expect(addControl).not.toHaveBeenCalled();
    expect(constructor.mock.calls[0][1]).toMatchObject({
      attributionControl: {},
    });
    expect(sources.has("easy-ui-transfers")).toBe(true);
    expect(sources.has("easy-ui-delivery-surface")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Select Oakland" }),
    ).toBeInTheDocument();
  });

  it("uses legacy networkControls only as a fallback for its original group", async () => {
    const view = render(
      <NetworkMap {...applicableProps} networkControls={false} />,
    );
    await finishLoading();
    for (const name of labels)
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Facility risk" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Weather" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    ).toBeInTheDocument();
    view.rerender(
      <NetworkMap
        {...applicableProps}
        networkControls={false}
        controls={{ fitAll: true, risk: true, weather: false }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Fit all locations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Facility risk" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Selected leg" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Weather" }),
    ).not.toBeInTheDocument();
  });

  it("updates navigation and scale without recreating the map or removing attribution", async () => {
    const view = render(
      <NetworkMap {...props} controls={{ navigation: false }} />,
    );
    await finishLoading();
    expect(addControl).toHaveBeenCalledTimes(1);
    const scale = addControl.mock.calls[0][0];
    expect(scale).toBeInstanceOf(engine.ScaleControl);
    view.rerender(
      <NetworkMap {...props} controls={{ navigation: true, scale: false }} />,
    );
    expect(removeControl).toHaveBeenCalledWith(scale);
    expect(addControl).toHaveBeenLastCalledWith(
      expect.any(engine.NavigationControl),
      "top-right",
    );
    view.rerender(<NetworkMap {...props} controls={false} />);
    expect(removeControl).toHaveBeenLastCalledWith(
      expect.any(engine.NavigationControl),
    );
    expect(removeControl).toHaveBeenCalledTimes(2);
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(constructor.mock.calls[0][1]).toMatchObject({
      attributionControl: {},
    });
  });

  it("accepts domain-specific labels without changing the camera actions", async () => {
    render(
      <NetworkMap
        {...applicableProps}
        controlLabels={{
          fitAll: "Entire journey",
          selectedSegment: "Focus transfer",
          latestEvent: "Last scan",
          risk: "Exception risk",
          weather: "Disruptions",
          deliverySurface: "Transit estimates",
        }}
      />,
    );
    await finishLoading();
    expect(
      screen.queryByRole("button", { name: "Fit all locations" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entire journey" }));
    expect(fitBounds).toHaveBeenLastCalledWith(
      [
        [-122, 38],
        [-119, 39],
      ],
      expect.objectContaining({ maxZoom: 11 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Focus transfer" }));
    expect(props.onFacilitySelect).toHaveBeenLastCalledWith("two");
    expect(fitBounds).toHaveBeenLastCalledWith(
      [
        [-122, 38],
        [-119, 39],
      ],
      expect.objectContaining({ maxZoom: 13 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Last scan" }));
    expect(props.onFacilitySelect).toHaveBeenLastCalledWith("one");
    for (const name of ["Exception risk", "Disruptions", "Transit estimates"])
      expect(screen.getByRole("checkbox", { name })).toBeInTheDocument();
  });

  it("keeps default accessible labels when optional overrides are explicitly undefined", async () => {
    render(
      <NetworkMap
        {...applicableProps}
        controlLabels={{
          fitAll: undefined,
          selectedSegment: undefined,
          latestEvent: undefined,
          risk: undefined,
          weather: undefined,
          deliverySurface: undefined,
        }}
      />,
    );
    await finishLoading();
    for (const name of labels)
      expect(screen.getByRole("button", { name })).toBeEnabled();
    for (const name of layerLabels)
      expect(screen.getByRole("checkbox", { name })).toBeEnabled();
  });

  it("keeps uncontrolled visibility after defaults change and reports the full requested state", async () => {
    const onLayerVisibilityChange = vi.fn();
    const view = render(
      <NetworkMap
        {...applicableProps}
        initialDeliverySurfaceVisible
        defaultLayerVisibility={{
          risk: false,
          weather: true,
          deliverySurface: false,
        }}
        onLayerVisibilityChange={onLayerVisibilityChange}
      />,
    );
    await finishLoading();
    expect(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Facility risk" }));
    expect(onLayerVisibilityChange).toHaveBeenLastCalledWith({
      risk: true,
      weather: true,
      deliverySurface: false,
    });
    view.rerender(
      <NetworkMap
        {...applicableProps}
        defaultLayerVisibility={{
          risk: false,
          weather: false,
          deliverySurface: true,
        }}
        onLayerVisibilityChange={onLayerVisibilityChange}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Facility risk" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Weather" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    ).not.toBeChecked();
    expect(onLayerVisibilityChange).toHaveBeenCalledTimes(1);
  });

  it("controls supplied visibility fields while other layers remain independently user-controlled", async () => {
    const onLayerVisibilityChange = vi.fn();
    const view = render(
      <NetworkMap
        {...applicableProps}
        layerVisibility={{ weather: false }}
        onLayerVisibilityChange={onLayerVisibilityChange}
      />,
    );
    await finishLoading();
    fireEvent.click(screen.getByRole("checkbox", { name: "Weather" }));
    expect(onLayerVisibilityChange).toHaveBeenLastCalledWith({
      risk: true,
      weather: true,
      deliverySurface: false,
    });
    expect(screen.getByRole("checkbox", { name: "Weather" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Facility risk" }));
    expect(
      screen.getByRole("checkbox", { name: "Facility risk" }),
    ).not.toBeChecked();
    expect(onLayerVisibilityChange).toHaveBeenLastCalledWith({
      risk: false,
      weather: false,
      deliverySurface: false,
    });
    view.rerender(
      <NetworkMap
        {...applicableProps}
        layerVisibility={{ weather: true }}
        onLayerVisibilityChange={onLayerVisibilityChange}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Weather" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Facility risk" }),
    ).not.toBeChecked();
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "easy-ui-weather-fill",
      "visibility",
      "visible",
    );
    expect(onLayerVisibilityChange).toHaveBeenCalledTimes(2);
  });

  it("applies external layer updates even when every built-in control is hidden", async () => {
    const view = render(
      <NetworkMap
        {...applicableProps}
        controls={false}
        layerVisibility={{
          risk: false,
          weather: false,
          deliverySurface: false,
        }}
      />,
    );
    await finishLoading();
    setLayoutProperty.mockClear();
    view.rerender(
      <NetworkMap
        {...applicableProps}
        controls={false}
        layerVisibility={{ risk: true, weather: true, deliverySurface: true }}
      />,
    );
    expect(
      screen.queryByRole("group", { name: toolbarName }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select Oakland" }),
    ).toHaveAttribute("data-risk", "elevated");
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "easy-ui-weather-fill",
      "visibility",
      "visible",
    );
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "easy-ui-delivery-surface-fill",
      "visibility",
      "visible",
    );
    expect(constructor).toHaveBeenCalledTimes(1);
  });

  it("preserves layer preferences when data and its controls disappear and return", async () => {
    const view = render(<NetworkMap {...applicableProps} />);
    await finishLoading();
    fireEvent.click(screen.getByRole("checkbox", { name: "Weather" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    );
    view.rerender(<NetworkMap {...props} />);
    expect(
      screen.queryByRole("checkbox", { name: "Weather" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Delivery time surface" }),
    ).not.toBeInTheDocument();
    view.rerender(<NetworkMap {...applicableProps} />);
    expect(screen.getByRole("checkbox", { name: "Weather" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Delivery time surface" }),
    ).toBeChecked();
  });
});

describe("focus with bounds", () => {
  const boundsFocusProps: NetworkMapProps = {
    ...props,
    facilities: [
      {
        id: "one",
        label: "Oakland",
        coordinates: [-122, 38],
        kind: "warehouse",
      },
    ],
    focus: {
      revision: 1,
      facilityIds: ["one"],
      bounds: { minLat: 29.5, maxLat: 30.5, minLon: -95.9, maxLon: -95.0 },
      maxZoom: 10,
    },
  };

  it("fits the camera to the given bounds instead of facilityIds when both are present", async () => {
    render(<NetworkMap {...boundsFocusProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(fitBounds).toHaveBeenCalledWith(
      [
        [-95.9, 29.5],
        [-95.0, 30.5],
      ],
      expect.objectContaining({ maxZoom: 10 }),
    );
  });

  it("re-fires the bounds fit when focus.revision changes, even with the same facilityIds", async () => {
    const view = render(<NetworkMap {...boundsFocusProps} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    fitBounds.mockClear();
    view.rerender(
      <NetworkMap
        {...boundsFocusProps}
        focus={{ ...boundsFocusProps.focus!, revision: 2 }}
      />,
    );
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it("falls back to fitting facilityIds when focus has no bounds, unchanged from today", async () => {
    const idsOnlyFocus: NetworkMapProps = {
      ...boundsFocusProps,
      focus: { revision: 1, facilityIds: ["one"], maxZoom: 10 },
    };
    render(<NetworkMap {...idsOnlyFocus} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(fitBounds).toHaveBeenCalledWith(
      [
        [-122, 38],
        [-122, 38],
      ],
      expect.objectContaining({ maxZoom: 10 }),
    );
  });
});

describe("independent map composition", () => {
  it("supports description-only, title-only, and externally named surfaces without empty heading wrappers", async () => {
    const view = render(
      <>
        <h2 id="outside">Warehouse context</h2>
        <NetworkMap
          {...props}
          title={undefined}
          description="Coverage only"
          aria-labelledby="outside"
        />
      </>,
    );
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(
      screen.getByRole("region", { name: "Warehouse context" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Coverage only")).toBeInTheDocument();
    expect(document.querySelector("h3")).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /null location|undefined location/,
    );
    view.rerender(
      <NetworkMap {...props} title="Title only" description={undefined} />,
    );
    expect(
      screen.getByRole("heading", { name: "Title only" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Coverage only")).not.toBeInTheDocument();
    view.rerender(
      <NetworkMap
        {...props}
        title={null}
        description={null}
        aria-label="Custom network"
      />,
    );
    expect(
      screen.getByRole("region", { name: "Custom network" }),
    ).toBeInTheDocument();
    expect(document.querySelector("h3")).toBeNull();
    expect(constructor).toHaveBeenCalledTimes(1);
  });

  it("mounts a standalone geographic surface without dummy logistics data or companions", async () => {
    render(
      <NetworkMapSurface
        mapStyle={props.mapStyle}
        workerUrl={props.workerUrl}
        aria-label="Weather base"
        controls={false}
      />,
    );
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    expect(
      screen.getByRole("region", { name: "Weather base" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Locations and exact data"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Observed transfer")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it("places controls and exact surface records outside the viewport and retains them when WebGL fails", async () => {
    vi.mocked(loadMapEngine).mockRejectedValueOnce(new Error("No WebGL"));
    const surface = {
      source: "Model A",
      asOf: "2026-09-20T00:00Z",
      cells: [
        {
          lonMin: 1,
          lonMax: 2,
          latMin: 3,
          latMax: 4,
          medianMinutes: null,
          iqrMinutes: null,
          n: 0,
        },
        {
          lonMin: 2,
          lonMax: 3,
          latMin: 3,
          latMax: 4,
          medianMinutes: 0,
          iqrMinutes: 1.5,
          n: 10,
        },
      ],
    };
    render(
      <NetworkMapProvider
        mapStyle={props.mapStyle}
        workerUrl={props.workerUrl}
        aria-label="Delivery field"
        aria-describedby="exact-field"
        surface={surface}
      >
        <aside data-testid="external-controls">
          <NetworkMapControlPanel />
        </aside>
        <NetworkMapSurface />
        <aside>
          <NetworkMapDataView id="exact-field" expanded />
        </aside>
      </NetworkMapProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to display the map",
    );
    expect(
      screen.getByRole("region", { name: "Delivery field" }),
    ).toHaveAttribute("aria-describedby", "exact-field");
    expect(screen.getByText(/Source: Model A/)).toHaveTextContent(
      "2026-09-20T00:00Z",
    );
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getAllByText("Unavailable")).toHaveLength(2);
    expect(within(rows[1]).getByText("0")).toBeInTheDocument();
    expect(within(rows[2]).getByText("0")).toBeInTheDocument();
    expect(within(rows[2]).getByText("1.5")).toBeInTheDocument();
    expect(
      screen.queryByText("Locations and exact data"),
    ).not.toBeInTheDocument();
  });

  it("keeps weather provenance and coordinates available while its layer is hidden", async () => {
    render(
      <NetworkMap
        {...props}
        facilities={undefined}
        segments={undefined}
        areas={[
          {
            id: "a",
            label: "Snow",
            evidence: "forecast",
            validFrom: "start",
            validUntil: "end",
            source: "Forecast source",
            coordinates: [
              [1, 2],
              [2, 2],
              [2, 3],
            ],
          },
        ]}
      />,
    );
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    fireEvent.click(screen.getByText("View exact map data"));
    expect(
      screen.getByRole("region", { name: "Network area data" }),
    ).toHaveTextContent("Forecast source");
    expect(screen.getByText("1, 2; 2, 2; 2, 3")).toBeInTheDocument();
    expect(screen.queryByText("Observed transfer")).not.toBeInTheDocument();
  });

  it("updates callback-only marker capabilities and uses the latest handler without source uploads", async () => {
    const first = vi.fn(),
      second = vi.fn();
    const view = render(<NetworkMap {...props} onFacilitySelect={undefined} />);
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    const marker = screen.getByRole("button", { name: "Select Oakland" });
    expect(marker).toBeDisabled();
    setData.mockClear();
    view.rerender(<NetworkMap {...props} onFacilitySelect={first} />);
    expect(marker).toBeEnabled();
    fireEvent.click(marker);
    expect(first).toHaveBeenCalledWith("one");
    view.rerender(<NetworkMap {...props} onFacilitySelect={second} />);
    fireEvent.click(marker);
    expect(second).toHaveBeenCalledWith("one");
    expect(first).toHaveBeenCalledTimes(1);
    view.rerender(<NetworkMap {...props} onFacilitySelect={undefined} />);
    expect(marker).toBeDisabled();
    expect(setData).not.toHaveBeenCalled();
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it("updates selection and visibility without uploading unchanged sources even for large cohorts", async () => {
    const facilities = Array.from({ length: 500 }, (_, index) => ({
      ...props.facilities[0],
      id: String(index),
    }));
    const view = render(
      <NetworkMapSurface {...props} facilities={facilities} />,
    );
    await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
    act(() => listeners.load());
    setData.mockClear();
    for (let index = 0; index < 5; index++)
      view.rerender(
        <NetworkMapSurface
          {...props}
          facilities={facilities}
          selectedFacilityId={String(index)}
          layerVisibility={{ risk: index % 2 === 0 }}
        />,
      );
    expect(setData).not.toHaveBeenCalled();
    view.rerender(
      <NetworkMapSurface {...props} facilities={facilities.slice(1)} />,
    );
    expect(setData).toHaveBeenCalledTimes(1);
  });

  it.each(["transfer", "measured", "planned", "inferred"] as const)(
    "gives %s routes an independent selection halo without overriding colors",
    async (evidence) => {
      const facilities = [
        ...props.facilities,
        {
          ...props.facilities[0],
          id: "two",
          coordinates: [-120, 39] as [number, number],
        },
      ];
      const segments = [
        {
          id: "route",
          from: "one",
          to: "two",
          label: "Route",
          evidence,
          color: "#bb3377",
          coordinates: [
            [-122, 38],
            [-120, 39],
          ] as [number, number][],
        },
      ];
      const view = render(
        <NetworkMap
          {...props}
          facilities={facilities}
          segments={segments}
          selectedSegmentId="route"
          onMapReady={(map) =>
            map.setPaintProperty("easy-ui-observed", "line-color", "#ff0099")
          }
        />,
      );
      await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
      act(() => listeners.load());
      expect(layerDefs.get("easy-ui-selection")?.filter).toEqual([
        "==",
        ["get", "id"],
        "route",
      ]);
      expect(callOrder.indexOf("addLayer:easy-ui-selection")).toBeLessThan(
        callOrder.indexOf("addLayer:easy-ui-casing"),
      );
      expect(paintProperties.get("easy-ui-observed")?.get("line-color")).toBe(
        "#ff0099",
      );
      expect(
        paintProperties.get("easy-ui-unobserved")?.get("line-dasharray"),
      ).toEqual([2, 2]);
      view.rerender(
        <NetworkMap {...props} facilities={facilities} segments={segments} />,
      );
      expect(layerDefs.get("easy-ui-selection")?.filter).toEqual([
        "==",
        ["get", "id"],
        "",
      ]);
    },
  );
});

it("resets external control readiness when the surface is conditionally removed", async () => {
  function Composition({ mounted }: { mounted: boolean }) {
    return (
      <NetworkMapProvider {...props}>
        <NetworkMapControlPanel />
        {mounted && <NetworkMapSurface />}
      </NetworkMapProvider>
    );
  }
  const view = render(<Composition mounted />);
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  expect(
    screen.getByRole("button", { name: "Fit all locations" }),
  ).toBeEnabled();
  view.rerender(<Composition mounted={false} />);
  expect(
    screen.getByRole("button", { name: "Fit all locations" }),
  ).toBeDisabled();
  expect(remove).toHaveBeenCalledTimes(1);
});

it("does not mutate nonexistent cluster layers when a mount-only clustering prop changes", async () => {
  const view = render(<NetworkMap {...props} />);
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  setLayoutProperty.mockClear();
  view.rerender(
    <NetworkMap {...props} clusterFacilities={{}} selectedFacilityId="one" />,
  );
  expect(
    setLayoutProperty.mock.calls.some(
      ([id]) => id === "easy-ui-facility-cluster-count",
    ),
  ).toBe(false);
  expect(constructor).toHaveBeenCalledTimes(1);
});

it("fits drawable layer bounds when supplied facility records have no valid coordinates", async () => {
  render(
    <NetworkMap
      {...props}
      facilities={[{ ...props.facilities[0], coordinates: [NaN, 0] }]}
      areas={[
        {
          id: "a",
          label: "Area",
          evidence: "observed",
          source: "Source",
          validFrom: "from",
          validUntil: "to",
          coordinates: [
            [1, 2],
            [2, 2],
            [2, 3],
          ],
        },
      ]}
    />,
  );
  await waitFor(() => expect(constructor).toHaveBeenCalledTimes(1));
  act(() => listeners.load());
  expect(fitBounds).toHaveBeenCalledWith(
    [
      [1, 2],
      [2, 3],
    ],
    expect.anything(),
  );
});

it("retains exact low probabilities and encoded connection values when the engine fails", async () => {
  vi.mocked(loadMapEngine).mockRejectedValueOnce(new Error("No engine"));
  render(
    <NetworkMap
      {...props}
      facilities={[
        {
          ...props.facilities[0],
          risk: {
            probability: 0.004,
            baseline: 0,
            status: "current",
            asOf: "2026-09-20",
            event: "Exception",
            horizonHours: 24,
            cohort: "Synthetic",
          },
        },
      ]}
      segments={[
        {
          id: "one",
          from: "origin-id",
          to: "destination-id",
          label: "Measured transfer",
          evidence: "measured",
          volume: 123,
          coordinates: [
            [1, 2],
            [3, 4],
          ],
        },
      ]}
    />,
  );
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("Locations and exact data"));
  expect(
    screen.getByRole("cell", { name: "0.4% (0.004) · current" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "0% (0)" })).toBeInTheDocument();
  const transfers = screen.getByRole("region", {
    name: "Network connection data",
  });
  expect(transfers).toHaveTextContent("123");
  expect(transfers).toHaveTextContent("origin-id");
  expect(transfers).toHaveTextContent("destination-id");
  expect(transfers).toHaveTextContent("1, 2; 3, 4");
});
