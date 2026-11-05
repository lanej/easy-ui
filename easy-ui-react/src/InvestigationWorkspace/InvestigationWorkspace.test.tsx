import React, { useState } from "react";
import { act, fireEvent, screen, within } from "@testing-library/react";
import {
  render,
  mockGetComputedStyle,
  mockIntersectionObserver,
  installScrollToMock,
} from "../utilities/test";
import { InvestigationWorkspace } from "./InvestigationWorkspace";
import { investigationRecords as records } from "./InvestigationWorkspace.fixtures";
import {
  resolveSelection,
  type InvestigationSelection,
  type InvestigationDetailsContext,
  type InvestigationConnection,
} from "./selection";
import type { NetworkMapProps } from "../NetworkMap";
let mapProps: NetworkMapProps;
vi.mock("../NetworkMap", () => ({
  NetworkMap: (props: NetworkMapProps) => {
    mapProps = props;
    return (
      <div data-testid="map" data-location={props.selectedFacilityId}>
        <button onClick={() => props.onFacilitySelect?.("shared")}>
          Map select Central Exchange
        </button>
        <button
          onClick={() =>
            props.onOverlaySelect?.({
              overlayId: props.overlays![props.overlays!.length - 1].id,
              feature: {
                type: "Feature",
                id: "shared-leg",
                geometry: { type: "LineString", coordinates: [] },
                properties: {},
              },
            })
          }
        >
          Map select shared connection
        </button>
      </div>
    );
  },
}));
const map = {
  mapStyle: { version: 8 as const, sources: {}, layers: [] },
  workerUrl: "/worker.js",
};
function Controlled({ initial }: { initial: InvestigationSelection }) {
  const [selection, onSelectionChange] = useState(initial);
  return (
    <InvestigationWorkspace
      {...records}
      map={map}
      selection={selection}
      onSelectionChange={onSelectionChange}
    />
  );
}
const details = () => screen.getByRole("region", { name: "Selection details" });
const timeline = () => screen.getByRole("list", { name: "Events" });

const ledgerConnections: InvestigationConnection[] = [
  {
    id: "accepted-arrived",
    fromEventId: "accepted",
    toEventId: "arrived",
    segmentId: "shared-leg",
    pathIds: ["north", "south"],
  },
  {
    id: "arrived-north",
    fromEventId: "arrived",
    toEventId: "north-scan",
    segmentId: "north-leg",
    pathIds: ["north"],
  },
  {
    id: "arrived-south",
    fromEventId: "arrived",
    toEventId: "south-scan",
    segmentId: "south-leg",
    pathIds: ["south"],
  },
];
const highlightedSegments = () =>
  mapProps
    .overlays![mapProps.overlays!.length - 1].data.features.filter(
      (feature) => feature.properties?.selected,
    )
    .map((feature) => feature.id);

describe("InvestigationWorkspace", () => {
  it("coordinates ledger event type, explicit links, event risk and incident map emphasis", () => {
    const change = vi.fn();
    const inspectRisk = vi.fn();
    const renderDetails = vi.fn((_context: InvestigationDetailsContext) => (
      <span>Selected evidence</span>
    ));
    const props = {
      ...records,
      connections: ledgerConnections,
      variant: "ledger" as const,
      map,
      onSelectionChange: change,
      renderDetails,
      timeline: {
        renderTrailing: (event: { id: string }) => (
          <button onClick={inspectRisk}>Inspect {event.id} risk</button>
        ),
      },
    };
    const { container, rerender } = render(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "event", eventId: "arrived" }}
      />,
    );
    const arrival = within(timeline()).getByRole("button", {
      name: /^Central Exchange Arrived at exchange 10:30 Received 10:34$/,
    });
    expect(arrival).toHaveAttribute("aria-current", "true");
    expect(arrival).toHaveAccessibleDescription("Inspect arrived risk");
    expect(
      within(arrival.closest("li")!).getByText("Received 10:34"),
    ).toBeVisible();
    expect(highlightedSegments()).toEqual([
      "shared-leg",
      "north-leg",
      "south-leg",
    ]);
    expect(
      renderDetails.mock.lastCall?.[0].connections?.map(
        (connection) => connection.id,
      ),
    ).toEqual(["accepted-arrived", "arrived-north", "arrived-south"]);
    expect(screen.getByText("3 candidate relationships")).toBeInTheDocument();
    fireEvent.click(
      within(timeline()).getByRole("button", { name: "Inspect arrived risk" }),
    );
    expect(inspectRisk).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
    expect(container.querySelector("button button")).toBeNull();

    // This record shares occurrence time, place, and candidate memberships with
    // arrived, but has no explicit event link. It must not inherit its geometry.
    rerender(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "event", eventId: "duplicate" }}
      />,
    );
    expect(highlightedSegments()).toEqual([]);
    expect(renderDetails.mock.lastCall?.[0].connections).toEqual([]);
    expect(
      within(timeline()).getByRole("button", {
        name: /^Central Exchange Arrived at exchange 10:30 Received 11:05$/,
      }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("preserves caller map colors, zero label zoom, priorities and explicit camera requests in ledger mode", () => {
    const locations = records.locations.map((location, index) =>
      index === 0
        ? { ...location, color: "#784bb1", labelMinZoom: 0, priority: 7 }
        : index === 1
          ? { ...location, labelMinZoom: 8 }
          : { ...location },
    );
    const segments = records.segments.map((segment, index) =>
      index === 0 ? { ...segment, color: "#bc492b" } : { ...segment },
    );
    const originalLocations = locations.map((location) => ({ ...location }));
    const originalSegments = segments.map((segment) => ({ ...segment }));
    const focus = { revision: "caller-request", facilityIds: ["origin"] };
    const mapOptions = {
      ...map,
      focus,
      primaryFacilityIds: ["origin", "destination"],
    };
    const props = {
      ...records,
      locations,
      segments,
      variant: "ledger" as const,
      map: mapOptions,
      onSelectionChange: vi.fn(),
    };
    const { rerender } = render(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "event", eventId: "accepted" }}
      />,
    );
    expect(mapProps.facilities?.[0]).toMatchObject({
      color: "#784bb1",
      labelMinZoom: 0,
      priority: 7,
    });
    expect(mapProps.facilities?.[1].labelMinZoom).toBe(8);
    expect(mapProps.facilities?.[2].labelMinZoom).toBe(24);
    expect(mapProps.segments![0].color).toBe("#bc492b");
    expect(mapProps.segments![1].color).toEqual(expect.any(String));
    expect(mapProps.primaryFacilityIds).toBe(mapOptions.primaryFacilityIds);
    expect(mapProps.focus).toBe(focus);
    rerender(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "event", eventId: "north-scan" }}
      />,
    );
    expect(mapProps.focus).toBe(focus);
    expect(locations).toEqual(originalLocations);
    expect(segments).toEqual(originalSegments);
  });

  it("preserves legacy candidate emphasis when links are omitted and clears it for an explicit empty graph", () => {
    const props = {
      ...records,
      variant: "ledger" as const,
      map,
      selection: { type: "event" as const, eventId: "accepted" },
      onSelectionChange: vi.fn(),
    };
    const { rerender } = render(<InvestigationWorkspace {...props} />);
    expect(highlightedSegments()).toEqual([
      "shared-leg",
      "north-leg",
      "north-end",
      "south-leg",
      "south-end",
    ]);
    expect(
      screen.queryByText(/candidate relationships?$/),
    ).not.toBeInTheDocument();
    rerender(<InvestigationWorkspace {...props} connections={[]} />);
    expect(highlightedSegments()).toEqual([]);
    expect(
      within(timeline()).getByRole("button", {
        name: "North Harbor Accepted 08:00",
      }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("reads inherited map tokens without a provider and follows system and theme-style changes", async () => {
    const tokenValues = {
      primary: "#173eb8",
      muted: "#576a83",
    };
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    const computed = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) => {
        const css = originalGetComputedStyle(element);
        if (element.getAttribute("aria-label") !== "Event investigation")
          return css;
        const getPropertyValue = css.getPropertyValue.bind(css);
        css.getPropertyValue = (name) => {
          if (name === "--ezui-color-primary-600")
            return ` ${tokenValues.primary} `;
          if (name === "--ezui-color-neutral-500")
            return ` ${tokenValues.muted} `;
          return getPropertyValue(name);
        };
        return css;
      });
    const listeners = new Set<() => void>();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addEventListener: (type: string, listener: () => void) => {
        if (type === "change") listeners.add(listener);
      },
      removeEventListener: (type: string, listener: () => void) => {
        if (type === "change") listeners.delete(listener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const themeStyle = document.createElement("style");
    themeStyle.id = "ezui-theme-style-level-ledger-test";
    themeStyle.textContent = ":root { --test-theme-version: 1; }";
    document.head.appendChild(themeStyle);
    const segments = records.segments.map((segment, index) =>
      index === 0 ? { ...segment, color: "#bc492b" } : segment,
    );
    const assertColors = () => {
      expect(mapProps.segments?.[0].color).toBe("#bc492b");
      expect(mapProps.segments?.[1].color).toBe(tokenValues.muted);
      expect(
        mapProps.overlays![mapProps.overlays!.length - 1].layers.find(
          (layer) => layer.id === "selection",
        ),
      ).toMatchObject({
        paint: { "line-color": tokenValues.primary },
      });
    };
    try {
      const { unmount } = render(
        <InvestigationWorkspace
          {...records}
          segments={segments}
          variant="ledger"
          connections={ledgerConnections}
          map={map}
          selection={{ type: "event", eventId: "arrived" }}
          onSelectionChange={vi.fn()}
        />,
      );
      assertColors();
      expect(listeners.size).toBe(1);
      await act(async () => {
        tokenValues.primary = "#a9bcff";
        tokenValues.muted = "#8496b3";
        for (const listener of [...listeners]) listener();
      });
      assertColors();
      // A ThemeProvider can update its style node while this child is memoized.
      await act(async () => {
        tokenValues.primary = "#246c57";
        tokenValues.muted = "#526c65";
        themeStyle.textContent = ":root { --test-theme-version: 2; }";
        await Promise.resolve();
      });
      assertColors();
      unmount();
      expect(listeners.size).toBe(0);
    } finally {
      themeStyle.remove();
      computed.mockRestore();
      window.matchMedia = originalMatchMedia;
    }
  });

  it("keeps candidate risk actions outside path selection buttons", () => {
    const change = vi.fn();
    const inspect = vi.fn();
    const { container } = render(
      <InvestigationWorkspace
        {...records}
        variant="ledger"
        connections={ledgerConnections}
        map={map}
        selection={{ type: "path", pathId: "north" }}
        onSelectionChange={change}
        renderPathTrailing={(path) => (
          <button onClick={inspect}>Inspect {path.id} history risk</button>
        )}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect north history risk" }),
    );
    expect(inspect).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
    expect(container.querySelector("button button")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Via North Gate" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Via North Gate" }),
    ).toHaveAccessibleDescription("Inspect north history risk");
  });

  it("preserves focus across responsive changes without taking focus from outside the workspace", () => {
    let width = 1200;
    let resize = () => {};
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width,
        height: 800,
        top: 0,
        left: 0,
        right: width,
        bottom: 800,
        x: 0,
        y: 0,
        toJSON() {},
      }));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: () => void) {}
        observe(target: HTMLElement) {
          if (target.getAttribute("aria-label") === "Event investigation")
            resize = this.callback;
        }
        unobserve() {}
        disconnect() {}
      },
    );
    const cleanups = [
      mockGetComputedStyle(),
      mockIntersectionObserver(),
      installScrollToMock(),
    ];
    const setWidth = (next: number) =>
      act(() => {
        width = next;
        resize();
      });
    try {
      render(
        <>
          <button>Outside workspace</button>
          <InvestigationWorkspace
            {...records}
            map={map}
            selection={{ type: "event", eventId: "arrived" }}
            onSelectionChange={vi.fn()}
            renderDetails={() => <input aria-label="Investigation note" />}
          />
        </>,
      );
      const mapButton = screen.getByRole("button", {
        name: "Map select Central Exchange",
      });
      mapButton.focus();
      setWidth(390);
      expect(screen.getByRole("tab", { name: "Map" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(mapButton).toHaveFocus();
      screen.getByRole("tab", { name: "Map" }).focus();
      setWidth(1200);
      expect(
        screen.getByRole("region", { name: "Locations and connections" }),
      ).toHaveFocus();

      const event = within(timeline()).getByRole("button", {
        name: /08:00.*Accepted/,
      });
      event.focus();
      setWidth(390);
      expect(screen.getByRole("tab", { name: "Events" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(event).toHaveFocus();
      screen.getByRole("tab", { name: "Events" }).focus();
      setWidth(1200);
      expect(screen.getByRole("region", { name: "Events" })).toHaveFocus();

      screen.getByRole("textbox", { name: "Investigation note" }).focus();
      setWidth(390);
      expect(
        screen.getByRole("button", { name: "Show details" }),
      ).toHaveFocus();
      fireEvent.click(screen.getByRole("button", { name: "Show details" }));
      const note = screen.getByRole("textbox", { name: "Investigation note" });
      note.focus();
      setWidth(1200);
      setWidth(390);
      expect(note).toHaveFocus();

      const outside = screen.getByRole("button", { name: "Outside workspace" });
      outside.focus();
      setWidth(1200);
      setWidth(390);
      expect(outside).toHaveFocus();
    } finally {
      cleanups.forEach((cleanup) => cleanup());
      rect.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it("keeps scope visible and lets the timeline filter related records without a second event list", () => {
    render(
      <Controlled
        initial={{ type: "path", pathId: "north", eventId: "arrived" }}
      />,
    );
    expect(
      within(details()).getByText("Via North Gate · Event 2 of 4"),
    ).toBeVisible();
    expect(timeline().querySelectorAll('[data-related="true"]')).toHaveLength(
      4,
    );
    expect(
      within(details()).queryByRole("button", { name: /10:30.*Arrived/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Related only" }));
    expect(within(timeline()).getAllByRole("button")).toHaveLength(4);
    expect(
      within(timeline()).queryByRole("button", {
        name: /Processed at South Gate/,
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(details()).getByRole("button", { name: "Next event" }),
    );
    expect(
      within(details()).getByText("Via North Gate · Event 3 of 4"),
    ).toBeVisible();
    fireEvent.click(
      within(details()).getByRole("button", { name: "Clear selection" }),
    );
    expect(within(timeline()).getAllByRole("button")).toHaveLength(7);
  });
  it("distinguishes equal occurrence labels by the supplied receipt time", () => {
    render(<Controlled initial={null} />);
    const arrivals = within(timeline()).getAllByRole("button", {
      name: /10:30.*Arrived at exchange/,
    });
    expect(arrivals[0]).toHaveAccessibleName(/Received 10:34/);
    expect(arrivals[1]).toHaveAccessibleName(/Received 11:05/);
    fireEvent.click(screen.getByText("Map select shared connection"));
    expect(
      within(details()).getByText("Shared by 2 candidate paths · transfer"),
    ).toBeVisible();
    expect(
      within(details()).getByText(
        "Connection · 5 events across candidate paths",
      ),
    ).toBeVisible();
  });
  it("switches narrow views by keyboard while preserving map and expanded detail content", () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        width: 390,
        height: 800,
        top: 0,
        left: 0,
        right: 390,
        bottom: 800,
        x: 0,
        y: 0,
        toJSON() {},
      });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const cleanups = [
      mockGetComputedStyle(),
      mockIntersectionObserver(),
      installScrollToMock(),
    ];
    const detail = (
      <input aria-label="Investigation note" defaultValue="Retained note" />
    );
    try {
      render(
        <InvestigationWorkspace
          {...records}
          map={map}
          selection={{ type: "event", eventId: "arrived" }}
          onSelectionChange={vi.fn()}
          renderDetails={() => detail}
        />,
      );
      const mountedMap = screen.getByTestId("map");
      expect(screen.getByRole("tab", { name: "Events" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(mountedMap).not.toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Show details" }));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Investigation note" }),
        { target: { value: "Edited note" } },
      );
      fireEvent.keyDown(screen.getByRole("tab", { name: "Events" }), {
        key: "ArrowRight",
      });
      expect(screen.getByRole("tab", { name: "Map" })).toHaveFocus();
      expect(screen.getByTestId("map")).toBe(mountedMap);
      expect(mountedMap).toBeVisible();
      expect(
        within(details()).getByRole("heading", { name: "Arrived at exchange" }),
      ).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
      fireEvent.click(screen.getByRole("button", { name: "Show details" }));
      expect(
        screen.getByRole("textbox", { name: "Investigation note" }),
      ).toHaveValue("Edited note");
    } finally {
      for (const cleanup of cleanups) cleanup();
      rect.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("requests selection without mutating a controlled value", () => {
    const change = vi.fn();
    const { rerender } = render(
      <InvestigationWorkspace
        {...records}
        map={map}
        selection={null}
        onSelectionChange={change}
      />,
    );
    fireEvent.click(
      within(timeline()).getByRole("button", { name: /08:00.*Accepted/ }),
    );
    expect(change).toHaveBeenCalledWith({ type: "event", eventId: "accepted" });
    expect(screen.getByTestId("map")).not.toHaveAttribute("data-location");
    rerender(
      <InvestigationWorkspace
        {...records}
        map={map}
        selection={{ type: "event", eventId: "accepted" }}
        onSelectionChange={change}
      />,
    );
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-location",
      "origin",
    );
    expect(
      within(timeline()).getByRole("button", { name: /08:00.*Accepted/ }),
    ).toHaveAttribute("aria-current", "true");
    const selected = mapProps.overlays![0].data.features.filter(
      (item) => item.properties?.selected,
    );
    expect(selected.map((item) => item.id)).toHaveLength(5);
  });
  it("retains duplicate and untimed events while stepping within a selected location", () => {
    render(<Controlled initial={null} />);
    fireEvent.click(screen.getByText("Map select Central Exchange"));
    expect(
      within(details()).getByText(
        /(?:Location · 3 events|Central Exchange · Event 3 of 3)/,
      ),
    ).toBeVisible();
    fireEvent.click(
      within(details()).getByRole("button", { name: "Next event" }),
    );
    expect(within(details()).getByText("10:34")).toBeVisible();
    fireEvent.click(
      within(details()).getByRole("button", { name: "Next event" }),
    );
    expect(within(details()).getByText("11:05")).toBeVisible();
    fireEvent.click(
      within(details()).getByRole("button", { name: "Next event" }),
    );
    expect(within(details()).getByText("Unknown")).toBeVisible();
    expect(
      within(details()).getByRole("button", { name: "Next event" }),
    ).toBeDisabled();
    expect(
      within(details()).getByText(
        /(?:Location · 3 events|Central Exchange · Event 3 of 3)/,
      ),
    ).toBeVisible();
  });
  it("preserves all candidate memberships on a shared connection", () => {
    render(<Controlled initial={null} />);
    fireEvent.click(screen.getByText("Map select shared connection"));
    expect(
      screen.getByRole("button", { name: "Via North Gate" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Via South Gate" }),
    ).toBeVisible();
    expect(mapProps.selectedSegmentId).toBe("shared-leg");
    fireEvent.click(screen.getByRole("button", { name: "Via South Gate" }));
    const highlighted = mapProps.overlays![0].data.features.filter(
      (item) => item.properties?.selected,
    );
    expect(highlighted.map((item) => item.id)).toEqual([
      "shared-leg",
      "south-leg",
      "south-end",
    ]);
    // Path choice never hides conflicting or unlocated observations from the timeline.
    expect(within(timeline()).getAllByRole("button")).toHaveLength(7);
    fireEvent.click(
      within(timeline()).getByRole("button", {
        name: /Processed at North Gate/,
      }),
    );
    expect(
      within(details()).getByRole("heading", {
        name: "Processed at North Gate",
      }),
    ).toBeVisible();
    expect(screen.getByTestId("map")).toHaveAttribute("data-location", "north");
  });
  it("supports timeline keyboard selection and clears stale map emphasis for unlocated events", () => {
    render(<Controlled initial={{ type: "event", eventId: "south-scan" }} />);
    fireEvent.keyDown(
      within(timeline()).getByRole("button", {
        name: /Processed at South Gate/,
      }),
      { key: "ArrowDown" },
    );
    expect(screen.getByTestId("map")).not.toHaveAttribute("data-location");
    expect(within(details()).getByText("Not supplied")).toBeVisible();
    expect(
      mapProps.overlays![0].data.features.some(
        (item) => item.properties?.selected,
      ),
    ).toBe(false);
  });
  it("keeps a selected record visible across immutable updates and reports removal without choosing another event", () => {
    const change = vi.fn();
    const selection: InvestigationSelection = {
      type: "event",
      eventId: "arrived",
    };
    const { rerender } = render(
      <InvestigationWorkspace
        {...records}
        selection={selection}
        map={map}
        onSelectionChange={change}
      />,
    );
    rerender(
      <InvestigationWorkspace
        {...records}
        events={records.events.map((item) => ({ ...item }))}
        selection={selection}
        map={map}
        onSelectionChange={change}
      />,
    );
    expect(
      within(details()).getByRole("heading", { name: "Arrived at exchange" }),
    ).toBeVisible();
    rerender(
      <InvestigationWorkspace
        {...records}
        events={[]}
        selection={selection}
        map={map}
        onSelectionChange={change}
      />,
    );
    expect(
      within(details()).getByRole("heading", { name: "Selection unavailable" }),
    ).toBeVisible();
    expect(change).not.toHaveBeenCalled();
  });
  it("does not fabricate related events for locations without observations", () => {
    render(
      <Controlled initial={{ type: "location", locationId: "unobserved" }} />,
    );
    expect(within(details()).getByText("Location · 0 events")).toBeVisible();
    expect(within(details()).queryByRole("navigation")).not.toBeInTheDocument();
  });
  it("keeps hover previews independent of persistent details and exposes the supplied context to charts", () => {
    const detail = vi.fn((_context: InvestigationDetailsContext) => (
      <span>Custom chart</span>
    ));
    const change = vi.fn();
    render(
      <InvestigationWorkspace
        {...records}
        selection={{ type: "event", eventId: "unlocated" }}
        map={map}
        onSelectionChange={change}
        renderDetails={detail}
      />,
    );
    mapProps.renderFacilityDetails?.({ facility: records.locations[0] });
    expect(change).not.toHaveBeenCalled();
    expect(detail.mock.lastCall?.[0].event?.id).toBe("unlocated");
    expect(within(details()).getByText("Custom chart")).toBeVisible();
  });
  it("retains valid scope when an externally selected event does not belong to it", () => {
    const context = resolveSelection(records, {
      type: "path",
      pathId: "north",
      eventId: "south-scan",
    });
    expect(context.event).toBeUndefined();
    expect(context.path?.id).toBe("north");
    expect(context.events.map((item) => item.id)).not.toContain("south-scan");
  });
  it("passes only application overlay context to its renderer", () => {
    const renderer = vi.fn(() => <span>Application overlay</span>);
    const external = {
      id: "application",
      data: { type: "FeatureCollection" as const, features: [] },
      layers: [],
    };
    render(
      <InvestigationWorkspace
        {...records}
        selection={null}
        onSelectionChange={vi.fn()}
        map={{
          ...map,
          overlays: [external],
          renderOverlayHoverDetails: renderer,
        }}
      />,
    );
    const owned = mapProps.overlays![1];
    mapProps.renderOverlayHoverDetails!({ overlays: [owned], selections: [] });
    expect(renderer).not.toHaveBeenCalled();
    mapProps.renderOverlayHoverDetails!({
      overlays: [owned, external],
      selections: [],
    });
    expect(renderer).toHaveBeenCalledWith({
      overlays: [external],
      selections: [],
    });
  });
  it("keeps location context but discloses an unavailable scoped event", () => {
    render(
      <Controlled
        initial={{ type: "location", locationId: "shared", eventId: "removed" }}
      />,
    );
    expect(
      within(details()).getByText(
        "The selected event is not available in this context.",
      ),
    ).toBeVisible();
    expect(
      within(details()).getByText(
        /(?:Location · 3 events|Central Exchange · Event 3 of 3)/,
      ),
    ).toBeVisible();
  });
});
