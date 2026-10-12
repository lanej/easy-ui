import React, { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NetworkMap } from "./NetworkMap";
import { NetworkMapProvider, useNetworkMap } from "./NetworkMapContext";
import { NetworkMapZoomSections } from "./NetworkMapZoomSections";
import { NetworkMapSurface } from "./NetworkMapSurface";
import type { NetworkMapProps } from "./types";

const focusSection = vi.fn();
const fitAll = vi.fn();
vi.mock("./NetworkMapSurface", () => ({
  NetworkMapSurface: function TestSurface() {
    const { setState, commands, setActiveZoomSectionId } = useNetworkMap();
    useEffect(() => {
      setState("ready");
      setActiveZoomSectionId(null);
      commands.current.zoomSection = (id) => {
        focusSection(id);
        setActiveZoomSectionId(id);
      };
      commands.current.fitAll = () => {
        fitAll();
        setActiveZoomSectionId(null);
      };
    }, [setState, commands, setActiveZoomSectionId]);
    return <div data-testid="map-surface" />;
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
  segments: [],
  zoomSections: [
    {
      id: "origin",
      title: "Origin detail",
      description: "Warehouse and acceptance",
      facilityIds: ["a"],
    },
    { id: "destination", title: "Destination detail", facilityIds: ["b"] },
  ],
  showDataTable: false,
};
beforeEach(() => vi.clearAllMocks());

it("offers section focus and one entire-journey action beside a single surface", () => {
  render(<NetworkMap {...records} />);
  expect(screen.getAllByTestId("map-surface")).toHaveLength(1);
  expect(
    screen.getAllByRole("button", { name: "Entire journey" }),
  ).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "Entire journey" }),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Origin detail" }));
  expect(focusSection).toHaveBeenCalledWith("origin");
  expect(screen.getByRole("button", { name: "Origin detail" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByRole("button", { name: "Origin detail" }),
  ).toHaveAccessibleDescription("Warehouse and acceptance");
  fireEvent.click(screen.getByRole("button", { name: "Entire journey" }));
  expect(fitAll).toHaveBeenCalledOnce();
  expect(
    screen.queryByText("Warehouse and acceptance"),
  ).not.toBeInTheDocument();
});

it("marks unmapped sections unavailable while keeping the map usable", () => {
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
    screen.getByRole("button", { name: "Unmapped handoff" }),
  ).toBeDisabled();
  expect(
    screen.getByText("Unmapped handoff: No mapped locations in this section."),
  ).toBeInTheDocument();
  expect(screen.getAllByTestId("map-surface")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Entire journey" })).toBeEnabled();
});

it("respects control opt-outs and configured return actions", () => {
  const { rerender } = render(<NetworkMap {...records} controls={false} />);
  expect(
    screen.queryByRole("group", { name: "Journey map views" }),
  ).not.toBeInTheDocument();
  rerender(<NetworkMap {...records} controls={{ fitAll: false }} />);
  expect(
    screen.queryByRole("button", { name: "Entire journey" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Origin detail" })).toBeEnabled();
  rerender(
    <NetworkMap
      {...records}
      toolbarControls={[
        {
          id: "fit",
          type: "action",
          action: "fitAll",
          label: "Return to route",
        },
      ]}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Entire journey" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole("button", { name: "Return to route" }),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Return to route" }));
  expect(fitAll).toHaveBeenCalledOnce();
});

it("can place focus controls independently without creating another surface", () => {
  render(
    <NetworkMapProvider {...records}>
      <NetworkMapZoomSections />
      <NetworkMapSurface />
    </NetworkMapProvider>,
  );
  expect(
    screen.getByRole("group", { name: "Journey map views" }),
  ).toBeInTheDocument();
  expect(screen.getAllByTestId("map-surface")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Destination detail" }));
  expect(focusSection).toHaveBeenCalledWith("destination");
});
