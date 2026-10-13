import React, { useEffect, useRef, useState } from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Map as MapInstance } from "maplibre-gl";
import { NetworkMap } from "./NetworkMap";
import { NetworkMapProvider, useNetworkMap } from "./NetworkMapContext";
import { NetworkMapViewport } from "./NetworkMapViewport";
import { crowdedInsetNodes } from "./useMapInsets";
import type { MapSurfaceMetric, NetworkMapProps } from "./types";

const seen = new Map<string, NetworkMapProps>();
const seenMetrics = new Map<string, MapSurfaceMetric | undefined>();
const mounts = new Map<string, number>();
let scale = 14;
const project = ([longitude, latitude]: number[]) => ({
  x: 400 + (longitude + 122.2) * scale,
  y: 330 + (latitude - 37.8) * scale,
});
vi.mock("./NetworkMapSurface", () => ({
  NetworkMapSurface: function TestSurface() {
    const {
      props: options,
      activeMetric,
      setState,
      mapRef,
      insets,
    } = useNetworkMap();
    const { update } = insets;
    const element = useRef<HTMLDivElement>(null);
    const name = options["aria-label"] ?? options.title ?? "Map";
    seen.set(name, options);
    seenMetrics.set(name, activeMetric);
    useEffect(() => {
      mounts.set(name, (mounts.get(name) ?? 0) + 1);
      setState("ready");
    }, [name, setState]);
    useEffect(() => {
      const container = element.current!;
      Object.defineProperties(container, {
        clientWidth: { value: 1300, configurable: true },
        clientHeight: { value: 660, configurable: true },
      });
      const map = {
        getContainer: () => container,
        getCenter: () => ({ lng: -96 }),
        project,
        isMoving: () => false,
        on() {},
        off() {},
      } as unknown as MapInstance;
      mapRef.current = map;
      update(map);
    }, [mapRef, update, options.facilities, options.zoomSections]);
    return (
      <div ref={element} data-testid={name}>
        {options.facilities?.map((facility) => (
          <button
            key={facility.id}
            data-map-facility-id={facility.id}
            onClick={() => {
              insets.request(facility.id);
              options.onFacilitySelect?.(facility.id);
            }}
          >
            {facility.label}
          </button>
        ))}
        <button onClick={() => insets.close()}>Move overview</button>
      </div>
    );
  },
}));
const records: NetworkMapProps = {
  title: "Journey",
  mapStyle: { version: 8, sources: {}, layers: [] },
  workerUrl: "/worker.js",
  facilities: [
    {
      id: "a",
      label: "Origin",
      kind: "warehouse",
      coordinates: [-122.2, 37.8],
    },
    {
      id: "b",
      label: "Acceptance",
      kind: "hub",
      coordinates: [-122.21, 37.81],
    },
    {
      id: "c",
      label: "Regional sort",
      kind: "hub",
      coordinates: [-83.2, 42.3],
    },
    {
      id: "d",
      label: "Delivery",
      kind: "delivery",
      coordinates: [-83.21, 42.31],
    },
    {
      id: "invalid",
      label: "Unknown location",
      kind: "hub",
      coordinates: [NaN, 0],
    },
  ],
  segments: [
    {
      id: "first",
      from: "a",
      to: "b",
      label: "Origin transfer",
      evidence: "measured",
      coordinates: [
        [-122.2, 37.8],
        [-122.21, 37.81],
      ],
      color: "#123456",
    },
    {
      id: "long",
      from: "b",
      to: "c",
      label: "Long transfer",
      evidence: "transfer",
    },
    {
      id: "last",
      from: "c",
      to: "d",
      label: "Delivery transfer",
      evidence: "planned",
    },
  ],
  zoomSections: [
    {
      id: "origin",
      title: "Origin detail",
      facilityIds: ["a", "b", "a", "missing", "invalid"],
      maxZoom: 14,
    },
    { id: "destination", title: "Destination detail", facilityIds: ["c", "d"] },
  ],
  showDataTable: false,
};
const originName = "Journey · Origin detail";
const destinationName = "Journey · Destination detail";
const overview = () => within(screen.getByTestId("Journey"));
const openOrigin = () => fireEvent.click(overview().getByText("Origin"));
beforeEach(() => {
  seen.clear();
  seenMetrics.clear();
  mounts.clear();
  scale = 14;
});

it.each(["before", "after"] as const)(
  "shares the overview metric when switched %s opening a close-up, including refreshed and removed metrics",
  async (order) => {
    const user = userEvent.setup();
    const surface = {
      asOf: "2026-10-13T00:00:00Z",
      source: "Synthetic",
      cells: [
        {
          lonMin: -122.3,
          lonMax: -122.1,
          latMin: 37.7,
          latMax: 37.9,
          medianMinutes: 30,
          iqrMinutes: 10,
          n: 100,
        },
      ],
      metrics: [
        { key: "median", label: "Median", field: "medianMinutes" },
        { key: "spread", label: "Spread", field: "iqrMinutes" },
      ] as MapSurfaceMetric[],
    };
    const props = {
      ...records,
      surface,
      defaultLayerVisibility: { deliverySurface: true },
    };
    const view = render(<NetworkMap {...props} />);
    if (order === "after") openOrigin();
    await user.click(
      screen.getByRole("button", { name: /delivery surface metric/ }),
    );
    await user.click(screen.getByRole("option", { name: "Spread" }));
    if (order === "before") openOrigin();
    expect(seenMetrics.get("Journey")).toBe(surface.metrics[1]);
    expect(seenMetrics.get(originName)).toBe(surface.metrics[1]);
    expect(
      screen.getByRole("group", { name: "Delivery time surface legend" }),
    ).toHaveTextContent("Spread:");
    const focusRevision = seen.get(originName)!.focus!.revision;

    const refreshed = surface.metrics.map((metric) => ({
      ...metric,
      colorScale: [
        { value: 0, color: "#000000" },
        { value: 120, color: "#ffffff" },
      ],
    }));
    view.rerender(
      <NetworkMap {...props} surface={{ ...surface, metrics: refreshed }} />,
    );
    expect(seenMetrics.get("Journey")).toBe(refreshed[1]);
    expect(seenMetrics.get(originName)).toBe(refreshed[1]);

    view.rerender(
      <NetworkMap
        {...props}
        surface={{ ...surface, metrics: [refreshed[0]] }}
      />,
    );
    expect(seenMetrics.get("Journey")).toBe(refreshed[0]);
    expect(seenMetrics.get(originName)).toBe(refreshed[0]);

    view.rerender(
      <NetworkMap {...props} surface={{ ...surface, metrics: undefined }} />,
    );
    expect(seenMetrics.get("Journey")).toBeUndefined();
    expect(seenMetrics.get(originName)).toBeUndefined();
    expect(
      screen.getByRole("group", { name: "Delivery time surface legend" }),
    ).toHaveTextContent("Median minutes:");
    expect(seen.get(originName)!.focus!.revision).toBe(focusRevision);
    expect([...mounts.values()]).toEqual([1, 1]);
  },
);

it("starts with only the overview even when a crowded facility is already selected", () => {
  const { container } = render(
    <NetworkMap {...records} selectedFacilityId="a" />,
  );
  expect(seen.size).toBe(1);
  expect(
    container.querySelector("[data-map-zoom-section]"),
  ).not.toBeInTheDocument();
});
it("opens only the clicked crowded group and preserves the supplied local evidence", () => {
  const { container } = render(
    <NetworkMap
      {...records}
      initialView={{ center: [0, 0], zoom: 1 }}
      focus={{ revision: "external", facilityIds: ["c"] }}
    />,
  );
  openOrigin();
  const origin = seen.get(originName)!;
  expect(origin.facilities?.map((facility) => facility.id)).toEqual(["a", "b"]);
  expect(origin.segments).toEqual(records.segments!.slice(0, 2));
  expect(origin.focus?.facilityIds).toEqual(["a", "b"]);
  expect(origin.segments![0]).toBe(records.segments![0]);
  expect(origin.initialView).toBeUndefined();
  expect(origin.focus?.maxZoom).toBe(14);
  expect(seen.has(destinationName)).toBe(false);
  expect(container.querySelectorAll("[data-map-zoom-section]")).toHaveLength(1);
  expect(seen.get("Journey")?.focus?.revision).toBe("external");
  expect(seen.get("Journey")?.segments).toHaveLength(3);
});
it("does not open an inset for a node that is readable at the current scale", () => {
  scale = 5000;
  const { container } = render(<NetworkMap {...records} />);
  openOrigin();
  expect(
    container.querySelector("[data-map-zoom-section]"),
  ).not.toBeInTheDocument();
  expect(seen.size).toBe(1);
});
it("shares selection without opening another inset or changing its focus revision", () => {
  function LinkedJourney() {
    const [selected, setSelected] = useState("a");
    return (
      <NetworkMap
        {...records}
        selectedFacilityId={selected}
        onFacilitySelect={setSelected}
      />
    );
  }
  render(<LinkedJourney />);
  openOrigin();
  const before = seen.get(originName)!.focus!.revision;
  fireEvent.click(
    within(screen.getByTestId(originName)).getByText("Acceptance"),
  );
  expect(seen.get("Journey")?.selectedFacilityId).toBe("b");
  expect(seen.get(originName)?.selectedFacilityId).toBe("b");
  expect(seen.get(originName)?.focus?.revision).toBe(before);
  expect([...mounts.values()]).toEqual([1, 1]);
});
it("retains the requested inset through immutable refreshes and explicit local refits", () => {
  const { rerender } = render(<NetworkMap {...records} />);
  openOrigin();
  const original = seen.get(originName)!.focus!.revision;
  fireEvent.click(screen.getByRole("button", { name: "Fit" }));
  const fitted = seen.get(originName)!.focus!.revision;
  expect(fitted).not.toBe(original);
  rerender(
    <NetworkMap
      {...records}
      facilities={records.facilities!.map((f) => ({ ...f, detail: "Updated" }))}
      zoomSections={[...records.zoomSections!].reverse()}
    />,
  );
  expect(seen.get(originName)?.focus?.revision).toBe(fitted);
  expect([...mounts.values()]).toEqual([1, 1]);
});
it("keeps only one inset when choosing another crowded node", () => {
  const { container } = render(<NetworkMap {...records} />);
  openOrigin();
  fireEvent.click(overview().getByText("Delivery"));
  expect(container.querySelectorAll("[data-map-zoom-section]")).toHaveLength(1);
  expect(screen.queryByTestId(originName)).not.toBeInTheDocument();
  expect(screen.getByTestId(destinationName)).toBeInTheDocument();
  expect(seen.get(destinationName)?.segments).toEqual(
    records.segments!.slice(1),
  );
  expect(
    screen.getByRole("button", { name: "Select Acceptance in journey" }),
  ).toHaveTextContent("From Acceptance");
  expect(mounts.get("Journey")).toBe(1);
});
it("closes with Escape or Close and returns focus to the source node", () => {
  const { container } = render(<NetworkMap {...records} />);
  openOrigin();
  fireEvent.keyDown(overview().getByText("Origin"), { key: "Escape" });
  expect(
    container.querySelector("[data-map-zoom-section]"),
  ).not.toBeInTheDocument();
  expect(overview().getByText("Origin")).toHaveFocus();
  openOrigin();
  fireEvent.click(screen.getByRole("button", { name: "Close close-up" }));
  expect(
    container.querySelector("[data-map-zoom-section]"),
  ).not.toBeInTheDocument();
});
it("does not reopen on a camera change and omits invalid or unmapped candidates", () => {
  const { container } = render(<NetworkMap {...records} />);
  openOrigin();
  fireEvent.click(overview().getByText("Move overview"));
  expect(
    container.querySelector("[data-map-zoom-section]"),
  ).not.toBeInTheDocument();
  fireEvent.click(overview().getByText("Unknown location"));
  expect(
    container.querySelector("[data-map-zoom-section]"),
  ).not.toBeInTheDocument();
});
it("shares resolved layers and retains dismissal when camera controls are disabled", () => {
  render(
    <NetworkMap
      {...records}
      controls={false}
      defaultLayerVisibility={{ risk: false, weather: true }}
    />,
  );
  openOrigin();
  expect(seen.get(originName)?.layerVisibility).toEqual({
    risk: false,
    weather: true,
    deliverySurface: false,
  });
  expect(screen.queryByRole("button", { name: "Fit" })).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Close close-up" }),
  ).toBeInTheDocument();
});
it("composes inside one frame without inheriting the overview's external heading IDs", () => {
  const { container } = render(
    <NetworkMapProvider {...records} aria-labelledby="external-title">
      <h2 id="external-title">External title</h2>
      <NetworkMapViewport />
    </NetworkMapProvider>,
  );
  openOrigin();
  expect(container.querySelectorAll("[data-map-geography]")).toHaveLength(1);
  expect(seen.get(originName)?.["aria-labelledby"]).toBeUndefined();
  expect(
    screen.getByRole("heading", { name: "Origin detail" }),
  ).toBeInTheDocument();
});
it("measures crowding in screen pixels and excludes far, missing and invalid members", () => {
  const map = {
    getContainer: () => ({ clientWidth: 1300, clientHeight: 660 }),
    getCenter: () => ({ lng: -96 }),
    project,
  } as unknown as Parameters<typeof crowdedInsetNodes>[1];
  const crowded = crowdedInsetNodes(records, map);
  expect(crowded.get("a")?.facilityIds).toEqual(["a", "b"]);
  expect(crowded.get("c")?.facilityIds).toEqual(["c", "d"]);
  expect(crowded.has("invalid")).toBe(false);
  scale = 5000;
  expect(crowdedInsetNodes(records, map).size).toBe(0);
});

it("links an off-inset facility to shared selection while keeping the local focus and surface", () => {
  function LinkedJourney() {
    const [selected, setSelected] = useState("a");
    return (
      <NetworkMap
        {...records}
        selectedFacilityId={selected}
        onFacilitySelect={setSelected}
      />
    );
  }
  render(<LinkedJourney />);
  openOrigin();
  const original = seen.get(originName)!.focus!.revision;
  fireEvent.click(
    screen.getByRole("button", { name: "Select Regional sort in journey" }),
  );
  expect(seen.get("Journey")?.selectedFacilityId).toBe("c");
  expect(seen.get(originName)?.selectedFacilityId).toBe("c");
  expect(seen.get(originName)?.focus?.revision).toBe(original);
  expect(seen.get(originName)?.facilities?.map((f) => f.id)).toEqual([
    "a",
    "b",
  ]);
  expect([...mounts.values()]).toEqual([1, 1]);
});
it("deduplicates continuation links and omits missing or unmapped endpoints", () => {
  render(
    <NetworkMap
      {...records}
      segments={[
        ...records.segments!,
        {
          id: "another",
          label: "Another transfer",
          from: "a",
          to: "c",
          evidence: "planned",
        },
        {
          id: "missing",
          label: "Missing",
          from: "a",
          to: "absent",
          evidence: "planned",
        },
        {
          id: "invalid",
          label: "Invalid",
          from: "a",
          to: "invalid",
          evidence: "planned",
        },
      ]}
    />,
  );
  openOrigin();
  expect(
    screen.getAllByRole("button", { name: "Select Regional sort in journey" }),
  ).toHaveLength(1);
  expect(seen.get(originName)?.segments?.map((s) => s.id)).toEqual([
    "first",
    "long",
    "another",
  ]);
});
