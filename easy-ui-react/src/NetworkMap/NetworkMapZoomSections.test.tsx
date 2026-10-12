import React, { useEffect, useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NetworkMap } from "./NetworkMap";
import { NetworkMapProvider, useNetworkMap } from "./NetworkMapContext";
import { NetworkMapZoomSections } from "./NetworkMapZoomSections";
import type { NetworkMapProps } from "./types";

const seen = new Map<string, NetworkMapProps>();
const mounts = new Map<string, number>();
vi.mock("./NetworkMapSurface", () => ({
  NetworkMapSurface: function TestSurface() {
    const { props: options, setState } = useNetworkMap();
    const name = options["aria-label"] ?? options.title ?? "Map";
    seen.set(name, options);
    useEffect(() => {
      mounts.set(name, (mounts.get(name) ?? 0) + 1);
      setState("ready");
    }, [name, setState]);
    return (
      <div data-testid={name}>
        {options.facilities?.map((facility) => (
          <button
            key={facility.id}
            onClick={() => options.onFacilitySelect?.(facility.id)}
          >
            {facility.label}
          </button>
        ))}
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
beforeEach(() => {
  seen.clear();
  mounts.clear();
});

it("fits explicit local groups without including the long transfer or losing supplied evidence", () => {
  render(
    <NetworkMap
      {...records}
      focus={{ revision: "external", facilityIds: ["c"] }}
      initialView={{ center: [0, 0], zoom: 1 }}
    />,
  );
  const origin = seen.get(originName)!;
  expect(origin.facilities?.map((facility) => facility.id)).toEqual(["a", "b"]);
  expect(origin.segments).toEqual([records.segments![0]]);
  expect(origin.segments![0]).toBe(records.segments![0]);
  expect(origin.initialView).toBeUndefined();
  expect(origin.focus?.maxZoom).toBe(14);
  expect(seen.get(destinationName)?.segments).toEqual([records.segments![2]]);
  expect(seen.get("Journey")?.segments).toHaveLength(3);
  expect(screen.queryByText("View data")).not.toBeInTheDocument();
});

it("shares controlled selection without issuing camera requests to any map", () => {
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
  const before = seen.get(originName)!.focus!.revision;
  fireEvent.click(
    within(screen.getByTestId(destinationName)).getByText("Delivery"),
  );
  for (const options of seen.values())
    expect(options.selectedFacilityId).toBe("d");
  expect(seen.get(originName)!.focus!.revision).toBe(before);
  expect([...mounts.values()]).toEqual([1, 1, 1]);
});

it("keeps each camera through immutable refreshes and reordering, with explicit refits and independent reset", () => {
  const { container, rerender } = render(<NetworkMap {...records} />);
  const original = seen.get(originName)!.focus!.revision;
  const other = seen.get(destinationName)!.focus!.revision;
  fireEvent.click(
    within(
      container.querySelector('[data-map-zoom-section="origin"]')!,
    ).getByRole("button", { name: "Fit section" }),
  );
  const reset = seen.get(originName)!.focus!.revision;
  expect(reset).not.toBe(original);
  expect(seen.get(destinationName)!.focus!.revision).toBe(other);
  const update = {
    ...records,
    facilities: records.facilities!.map((facility) => ({
      ...facility,
      detail: "Updated",
    })),
    zoomSections: [...records.zoomSections!].reverse(),
  };
  rerender(<NetworkMap {...update} />);
  expect(seen.get(originName)!.focus!.revision).toBe(reset);
  expect([...mounts.values()]).toEqual([1, 1, 1]);
  rerender(
    <NetworkMap
      {...update}
      zoomSections={update.zoomSections.map((section) => ({
        ...section,
        focusRevision: 2,
      }))}
    />,
  );
  expect(seen.get(originName)!.focus!.revision).not.toBe(reset);
});

it("shares parent layer visibility and resolved overlays while preserving map controls opt-out", () => {
  const options: NetworkMapProps = {
    ...records,
    controls: false,
    defaultLayerVisibility: { risk: false, weather: true },
    overlays: [
      {
        id: "context",
        label: "Context",
        data: { type: "FeatureCollection", features: [] },
        layers: [],
        visible: false,
      },
    ],
  };
  const { rerender } = render(<NetworkMap {...options} />);
  expect(seen.get(originName)!.layerVisibility).toEqual({
    risk: false,
    weather: true,
    deliverySurface: false,
  });
  expect(seen.get(originName)!.overlays).toEqual(seen.get("Journey")!.overlays);
  expect(
    screen.queryByRole("button", { name: "Fit section" }),
  ).not.toBeInTheDocument();
  rerender(<NetworkMap {...options} layerVisibility={{ risk: true }} />);
  expect(seen.get(destinationName)!.layerVisibility!.risk).toBe(true);
});

it("shows unavailable location groups instead of opening an unrelated world map", () => {
  render(
    <NetworkMap
      {...records}
      zoomSections={[
        {
          id: "empty",
          title: "Unmapped handoff",
          facilityIds: ["missing", "invalid"],
        },
      ]}
    />,
  );
  expect(
    screen.getByText("No mapped locations in this section."),
  ).toBeInTheDocument();
  expect(seen.size).toBe(1);
});

it("can be composed independently, without inheriting the overview's external heading IDs", () => {
  render(
    <NetworkMapProvider {...records} aria-labelledby="external-title">
      <h2 id="external-title">External journey title</h2>
      <NetworkMapZoomSections />
    </NetworkMapProvider>,
  );
  expect(seen.get(originName)!["aria-labelledby"]).toBeUndefined();
  expect(
    screen.getByRole("heading", { name: "Origin detail" }),
  ).toBeInTheDocument();
  expect(seen.size).toBe(2);
});
