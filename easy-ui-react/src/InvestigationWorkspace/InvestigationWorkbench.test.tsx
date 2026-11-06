import React from "react";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { InvestigationWorkbench } from "./InvestigationWorkbench";
import type {
  InvestigationGraph,
  InvestigationPrediction,
  InvestigationDeviation,
} from "./workbenchModel";
import type { NetworkMapProps } from "../NetworkMap";

let mapProps: NetworkMapProps;
vi.mock("../NetworkMap", () => ({
  NetworkMap: (props: NetworkMapProps) => {
    mapProps = props;
    return (
      <div data-testid="map">
        <button onClick={() => props.onFacilitySelect?.("x")}>
          Inspect repeated location
        </button>
      </div>
    );
  },
}));
const graph: InvestigationGraph = {
  events: [
    {
      id: "e1",
      label: "Accepted",
      locationId: "x",
      locationLabel: "Origin",
      timeLabel: "09:00",
    },
    {
      id: "e2",
      label: "Arrival",
      locationId: "y",
      locationLabel: "Hub",
      timeLabel: "10:00",
    },
    {
      id: "e3",
      label: "Return",
      locationId: "x",
      locationLabel: "Origin",
      timeLabel: "11:00",
    },
    {
      id: "e4",
      label: "Delivered",
      locationId: "y",
      locationLabel: "Hub",
      timeLabel: "12:00",
    },
  ],
  connections: [
    { id: "c1", fromEventId: "e1", toEventId: "e2", segmentId: "s1" },
    { id: "c2", fromEventId: "e2", toEventId: "e3", segmentId: "s2" },
  ],
  paths: [
    {
      id: "a",
      label: "History A",
      color: "#2563eb",
      connectionIds: ["c1", "c2"],
    },
    { id: "b", label: "History B", color: "#7c3aed", connectionIds: ["c1"] },
  ],
  locations: [
    { id: "x", label: "Origin", coordinates: [-100, 40], kind: "hub" },
    { id: "y", label: "Hub", coordinates: [-99, 39], kind: "hub" },
  ],
  segments: [
    {
      id: "s1",
      from: "x",
      to: "y",
      label: "Origin to Hub",
      evidence: "inferred",
    },
    {
      id: "s2",
      from: "y",
      to: "x",
      label: "Return to Origin",
      evidence: "inferred",
    },
  ],
};
const predictions: InvestigationPrediction[] = [
  {
    id: "p",
    pathId: "a",
    label: "Forecast south",
    color: "#aa6600",
    source: "Synthetic model",
    asOf: "08:00 UTC",
    lines: [
      [
        [-100, 40],
        [-99, 39],
      ],
    ],
  },
];
const deviations: InvestigationDeviation[] = [
  {
    id: "d",
    predictionId: "p",
    eventId: "e3",
    firstDivergenceEventId: "e3",
    summary: "Supplied return finding",
    source: "Synthetic assessment",
    asOf: "11:30 UTC",
    facts: [{ label: "Difference", value: "+12 min" }],
  },
];
const map = {
  mapStyle: { version: 8 as const, sources: {}, layers: [] },
  workerUrl: "/worker.js",
};
const props = { graph, map, predictions, deviations };
const ledger = () => screen.getByRole("region", { name: "Observation ledger" });
const inspector = () =>
  screen.getByRole("region", { name: "Investigation inspector" });

describe("InvestigationWorkbench", () => {
  it("shows overview without forecasts and focuses a history without modifying the camera request", () => {
    const focus = { revision: "caller", facilityIds: ["x"] };
    render(
      <InvestigationWorkbench
        {...props}
        map={{ ...map, focus }}
        defaultState={{ enabledPredictionIds: ["p"] }}
      />,
    );
    expect(mapProps.overlays).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: /History A.*3 observations/ }),
    );
    expect(
      screen.getByRole("button", { name: "Focused history" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(mapProps.overlays).toHaveLength(3);
    expect(mapProps.focus).toBe(focus);
    expect(
      within(ledger()).getByText("Unassigned observations (1)"),
    ).toBeInTheDocument();
  });
  it("uses independent focus and selected event state through location and revisit inspection", () => {
    const change = vi.fn();
    render(
      <InvestigationWorkbench
        {...props}
        onStateChange={change}
        defaultState={{
          mode: "deviation",
          focusedPathId: "a",
          enabledPredictionIds: ["p"],
          comparisonPredictionId: "p",
          selection: { type: "event", eventId: "e3" },
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect repeated location" }),
    );
    expect(change.mock.lastCall?.[0]).toMatchObject({
      mode: "deviation",
      focusedPathId: "a",
      comparisonPredictionId: "p",
      selection: { type: "location", locationId: "x" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Event" }));
    expect(
      within(inspector()).getByText(
        "2 observations at this location. Repeated visits remain separate.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(inspector()).getByRole("button", { name: "Return · 11:00" }),
    );
    expect(change.mock.lastCall?.[0].selection).toEqual({
      type: "event",
      eventId: "e3",
    });
    expect(mapProps.overlays).toHaveLength(3);
  });
  it("renders only caller-supplied deviations and supports accessible inspector tabs", () => {
    render(
      <InvestigationWorkbench
        {...props}
        defaultState={{
          mode: "deviation",
          focusedPathId: "a",
          enabledPredictionIds: ["p"],
          comparisonPredictionId: "p",
          selection: { type: "event", eventId: "e3" },
        }}
        renderEvidence={() => <span>Detailed reference</span>}
      />,
    );
    expect(screen.getByRole("tab", { name: "Deviation" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Supplied return finding")).toBeVisible();
    expect(screen.getByText("+12 min")).toBeVisible();
    const deviationTab = screen.getByRole("tab", {
      name: "Deviation",
    });
    fireEvent.keyDown(deviationTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Evidence" })).toHaveFocus();
    expect(screen.getByText("Detailed reference")).toBeVisible();
    fireEvent.click(
      within(ledger()).getByRole("button", { name: /Arrival Hub/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Deviation" }));
    expect(screen.getByText(/No deviation assessment supplied/)).toBeVisible();
  });
  it("keeps a removed controlled selection unavailable rather than silently replacing it", () => {
    const { rerender } = render(
      <InvestigationWorkbench
        {...props}
        defaultState={{ selection: { type: "event", eventId: "e4" } }}
      />,
    );
    rerender(
      <InvestigationWorkbench
        {...props}
        graph={{ ...graph, events: graph.events.filter((e) => e.id !== "e4") }}
      />,
    );
    expect(
      screen.getByText("The selected record is no longer available."),
    ).toBeVisible();
  });
  it("does not change controlled state until its owner updates it", () => {
    const state = {
      mode: "overview" as const,
      focusedPathId: null,
      selection: null,
      enabledPredictionIds: [],
      comparisonPredictionId: null,
      showDisconnected: true,
      showRisks: true,
    };
    const change = vi.fn();
    render(
      <InvestigationWorkbench
        {...props}
        state={state}
        onStateChange={change}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Focused history" }));
    expect(change.mock.lastCall?.[0].mode).toBe("focused");
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("fails visibly on inconsistent topology without mounting the map", () => {
    render(
      <InvestigationWorkbench
        {...props}
        graph={{
          ...graph,
          connections: [{ ...graph.connections[0], segmentId: "s2" }],
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "disagree on their endpoints",
    );
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });
  it("keeps event risk independent of event type and does not nest controls", () => {
    const { container } = render(
      <InvestigationWorkbench
        {...props}
        assessments={[
          {
            id: "risk",
            target: { type: "event", eventId: "e4" },
            label: "High risk",
            tone: "danger",
            summary: "Supplied risk",
            source: "Policy",
            asOf: "12:05",
          },
        ]}
      />,
    );
    const delivered = within(ledger()).getByRole("button", {
      name: /Delivered Hub/,
    });
    expect(
      within(delivered.closest("li")!).getByText("High risk"),
    ).toBeInTheDocument();
    expect(container.querySelector("button button")).toBeNull();
  });
});

describe("selection and assessment regressions", () => {
  it("clears the ledger's selected visit when a repeated location is inspected", () => {
    render(<InvestigationWorkbench {...props} />);
    fireEvent.click(
      within(ledger()).getByRole("button", { name: /Return Origin/ }),
    );
    expect(
      within(ledger()).getByRole("button", { name: /Return Origin/ }),
    ).toHaveAttribute("aria-current", "true");
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect repeated location" }),
    );
    expect(
      within(inspector()).getByText(
        "2 observations at this location. Repeated visits remain separate.",
      ),
    ).toBeVisible();
    expect(ledger().querySelector('[aria-current="true"]')).toBeNull();
  });

  it("shows a path assessment when that path is selected", () => {
    render(
      <InvestigationWorkbench
        {...props}
        assessments={[
          {
            id: "path-risk",
            target: { type: "path", pathId: "a" },
            label: "Path risk",
            tone: "danger",
            summary: "Supplied path finding",
            source: "Policy",
            asOf: "Now",
          },
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /History A.*3 observations/ }),
    );
    expect(screen.getByText("Supplied path finding")).toBeVisible();
  });
});

it("shows a supplied connection assessment when the mapped segment is selected", () => {
  render(
    <InvestigationWorkbench
      {...props}
      defaultState={{ selection: { type: "segment", segmentId: "s1" } }}
      assessments={[
        {
          id: "risk-c",
          target: { type: "connection", connectionId: "c1" },
          label: "Risk",
          tone: "danger",
          summary: "Connection finding",
          source: "Policy",
          asOf: "Now",
        },
      ]}
    />,
  );
  expect(screen.getByText("Connection finding")).toBeVisible();
});

it.each(["Accepted", "Delivered"])(
  "keeps %s unselected while the controlled owner retains null",
  (label) => {
    render(
      <InvestigationWorkbench
        {...props}
        state={{
          mode: "focused",
          focusedPathId: "a",
          selection: null,
          enabledPredictionIds: [],
          comparisonPredictionId: null,
          showDisconnected: true,
          showRisks: true,
        }}
      />,
    );
    fireEvent.click(within(ledger()).getByText(label).closest("button")!);
    expect(ledger().querySelector('[aria-current="true"]')).toBeNull();
  },
);

it("does not mark every relationship selected when the selection is empty", () => {
  render(<InvestigationWorkbench {...props} />);
  expect(within(ledger()).queryAllByText("In selected context")).toHaveLength(
    0,
  );
});

it("honors an explicit false map controls setting", () => {
  render(
    <InvestigationWorkbench {...props} map={{ ...map, controls: false }} />,
  );
  expect(mapProps.controls).toBe(false);
});

describe("workbench review regressions", () => {
  it.each(["Event", "Evidence"])(
    "reveals deviation again after inspecting the %s tab",
    (tab) => {
      render(
        <InvestigationWorkbench
          {...props}
          defaultState={{
            mode: "deviation",
            focusedPathId: "a",
            enabledPredictionIds: ["p"],
            comparisonPredictionId: "p",
          }}
        />,
      );
      for (const command of ["Compare Forecast south", "Deviation analysis"]) {
        fireEvent.click(screen.getByRole("tab", { name: tab }));
        expect(screen.getByRole("tab", { name: tab })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        fireEvent.click(screen.getByRole("button", { name: command }));
        expect(screen.getByRole("tab", { name: "Deviation" })).toHaveAttribute(
          "aria-selected",
          "true",
        );
      }
    },
  );

  it("keeps controlled analysis mode with its owner while repeated accepted commands reveal its tab", () => {
    const state = {
      mode: "overview" as const,
      focusedPathId: "a",
      selection: null,
      enabledPredictionIds: ["p"],
      comparisonPredictionId: "p",
      showDisconnected: true,
      showRisks: true,
    };
    const change = vi.fn();
    const { rerender } = render(
      <InvestigationWorkbench
        {...props}
        state={state}
        onStateChange={change}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Deviation analysis" }));
    expect(change.mock.lastCall?.[0].mode).toBe("deviation");
    expect(screen.getByRole("tab", { name: "Event" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    rerender(
      <InvestigationWorkbench
        {...props}
        state={change.mock.lastCall?.[0]}
        onStateChange={change}
      />,
    );
    for (const command of ["Compare Forecast south", "Deviation analysis"]) {
      fireEvent.click(screen.getByRole("tab", { name: "Evidence" }));
      fireEvent.click(screen.getByRole("button", { name: command }));
      expect(screen.getByRole("tab", { name: "Deviation" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }
  });

  it("does not navigate the inspector when analysis is unavailable", () => {
    render(
      <InvestigationWorkbench
        graph={{ ...graph, paths: [] }}
        map={map}
        defaultState={{ mode: "deviation" }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Evidence" }));
    const command = screen.getByRole("button", { name: "Deviation analysis" });
    expect(command).toBeDisabled();
    fireEvent.click(command);
    expect(screen.getByRole("tab", { name: "Evidence" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("preserves map presentation references for event, location, risk and unassigned-only updates", () => {
    const external: NonNullable<NetworkMapProps["overlays"]>[number] = {
      id: "external",
      label: "Caller overlay",
      data: { type: "FeatureCollection", features: [] },
      layers: [],
    };
    render(
      <InvestigationWorkbench
        {...props}
        map={{ ...map, overlays: [external] }}
        defaultState={{
          mode: "deviation",
          focusedPathId: "a",
          enabledPredictionIds: ["p"],
          comparisonPredictionId: "p",
        }}
      />,
    );
    const { facilities, segments, overlays } = mapProps;
    const expectStable = () => {
      expect(mapProps.facilities).toBe(facilities);
      expect(mapProps.segments).toBe(segments);
      expect(mapProps.overlays).toBe(overlays);
      expect(mapProps.overlays?.[0]).toBe(external);
    };
    fireEvent.click(
      within(ledger()).getByRole("button", { name: /Return Origin/ }),
    );
    expectStable();
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect repeated location" }),
    );
    expectStable();
    fireEvent.click(screen.getByRole("checkbox", { name: /Risk indicators/ }));
    expectStable();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Unassigned observations/ }),
    );
    expectStable();
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(mapProps.overlays).not.toBe(overlays);
    expect(mapProps.overlays).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Deviation analysis" }));
    expect(mapProps.overlays).toHaveLength(4);
    const compared = mapProps.overlays;
    fireEvent.click(screen.getByRole("checkbox", { name: "Forecast south" }));
    expect(mapProps.overlays).not.toBe(compared);
    expect(mapProps.overlays).toHaveLength(3);
  });

  const unassignedGraph: InvestigationGraph = {
    ...graph,
    events: [...graph.events, { id: "e5", label: "Unassigned origin" }],
    connections: [
      ...graph.connections,
      {
        id: "unassigned-link",
        fromEventId: "e5",
        toEventId: "e4",
        label: "Explicit unassigned evidence",
      },
      {
        id: "mixed-link",
        fromEventId: "e2",
        toEventId: "e4",
        label: "Cross-scope evidence",
      },
    ],
  };

  it("reveals a map-selected unassigned visit before measuring it, without taking focus", () => {
    const { rerender } = render(
      <InvestigationWorkbench
        {...props}
        graph={unassignedGraph}
        defaultState={{ mode: "focused", focusedPathId: "a" }}
      />,
    );
    const disclosure = within(ledger())
      .getByText("Unassigned observations (2)")
      .closest("details")!;
    expect(disclosure.open).toBe(false);
    const row = within(disclosure).getByText("Delivered").closest("button")!;
    const measuredOpen: boolean[] = [];
    vi.spyOn(row, "getBoundingClientRect").mockImplementation(() => {
      measuredOpen.push(disclosure.open);
      return { top: 1200, bottom: 1250 } as DOMRect;
    });
    const mapButton = screen.getByRole("button", {
      name: "Inspect repeated location",
    });
    mapButton.focus();
    rerender(
      <InvestigationWorkbench
        {...props}
        graph={unassignedGraph}
        state={{
          mode: "focused",
          focusedPathId: "a",
          selection: { type: "location", locationId: "y", eventId: "e4" },
          enabledPredictionIds: [],
          comparisonPredictionId: null,
          showDisconnected: true,
          showRisks: true,
        }}
      />,
    );
    expect(row).toHaveAttribute("aria-current", "true");
    expect(disclosure.open).toBe(true);
    expect(measuredOpen).toEqual([true]);
    expect(mapButton).toHaveFocus();
  });

  it("retains unassigned connections, incoming metrics and risk independently of history focus", () => {
    const metrics = vi.fn(({ connection, fromEvent, toEvent }) => (
      <span>
        {connection.id}: {fromEvent.id} → {toEvent.id}
      </span>
    ));
    render(
      <InvestigationWorkbench
        {...props}
        graph={unassignedGraph}
        renderConnectionMetrics={metrics}
        assessments={[
          {
            id: "edge-risk",
            target: { type: "connection", connectionId: "unassigned-link" },
            label: "Edge warning",
            tone: "warning",
            summary: "Supplied edge warning",
            source: "Policy",
            asOf: "Now",
          },
          {
            id: "event-risk",
            target: { type: "event", eventId: "e4" },
            label: "Event warning",
            tone: "warning",
            summary: "Supplied event warning",
            source: "Policy",
            asOf: "Now",
          },
        ]}
      />,
    );
    expect(
      within(ledger()).getByText("unassigned-link: e5 → e4"),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: /History A.*3 observations/ }),
    );
    const disclosure = within(ledger())
      .getByText("Unassigned observations (2)")
      .closest("details")!;
    fireEvent.click(
      within(disclosure).getByText("Unassigned observations (2)"),
    );
    // jsdom does not implement the summary's native disclosure toggle.
    disclosure.open = true;
    expect(
      within(disclosure).getByText("unassigned-link: e5 → e4"),
    ).toBeVisible();
    expect(within(disclosure).getByText("Edge warning")).toBeVisible();
    expect(within(disclosure).getByText("Event warning")).toBeVisible();
    expect(
      within(disclosure).getByText("Explicit unassigned evidence"),
    ).toBeInTheDocument();
    expect(within(disclosure).queryByText(/mixed-link/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Risk indicators/ }));
    expect(within(disclosure).queryByText("Edge warning")).toBeNull();
    expect(within(disclosure).queryByText("Event warning")).toBeNull();
    expect(
      within(disclosure).getByText("unassigned-link: e5 → e4"),
    ).toBeVisible();
  });

  it("rejects missing unassigned endpoints without invoking evidence with an incomplete context", () => {
    const metrics = vi.fn();
    render(
      <InvestigationWorkbench
        {...props}
        graph={{ ...unassignedGraph, events: graph.events }}
        renderConnectionMetrics={metrics}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Connection unassigned-link has a missing observation.",
    );
    expect(metrics).not.toHaveBeenCalled();
  });
});

it("does not invoke the application hover renderer for owned-only overlay context", () => {
  const renderer = vi.fn(() => <span>Application overlay</span>);
  const fallback = vi.fn(() => <span>Legacy app detail</span>);
  const external = {
    id: "external",
    data: {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [0, 0] },
          properties: { label: "External" },
        },
      ],
    },
    layers: [],
  };
  render(
    <InvestigationWorkbench
      {...props}
      map={{
        ...map,
        overlays: [external],
        renderOverlayHoverDetails: renderer,
        renderOverlayDetails: fallback,
      }}
    />,
  );
  const owned = mapProps.overlays![1];
  const ownedHit = {
    overlayId: owned.id,
    overlay: owned,
    feature: owned.data.features[0],
  };
  const hit = {
    overlayId: external.id,
    overlay: external,
    feature: external.data.features[0],
  };
  mapProps.renderOverlayHoverDetails!({
    overlays: [owned],
    selections: [ownedHit],
  });
  expect(renderer).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
  mapProps.renderOverlayHoverDetails!({
    overlays: [owned, external],
    selections: [ownedHit, hit],
  });
  expect(renderer).toHaveBeenCalledExactlyOnceWith({
    overlays: [external],
    selections: [hit],
  });
  expect(fallback).not.toHaveBeenCalled();
});

it("preserves the legacy external overlay details fallback", () => {
  const fallback = vi.fn(() => <span>Legacy app detail</span>);
  const external = {
    id: "external",
    data: {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [0, 0] },
          properties: { label: "External" },
        },
      ],
    },
    layers: [],
  };
  render(
    <InvestigationWorkbench
      {...props}
      map={{ ...map, overlays: [external], renderOverlayDetails: fallback }}
    />,
  );
  const owned = mapProps.overlays![1];
  const ownedHit = {
    overlayId: owned.id,
    overlay: owned,
    feature: owned.data.features[0],
  };
  const hit = {
    overlayId: external.id,
    overlay: external,
    feature: external.data.features[0],
  };
  mapProps.renderOverlayHoverDetails!({
    overlays: [owned],
    selections: [ownedHit],
  });
  expect(fallback).not.toHaveBeenCalled();
  mapProps.renderOverlayHoverDetails!({
    overlays: [owned, external],
    selections: [ownedHit, hit],
  });
  expect(fallback).toHaveBeenCalledExactlyOnceWith(hit);
});

it("does not dim every remaining history after the focused history disappears", () => {
  const stableProps = { ...props, predictions: [], deviations: [] };
  const change = vi.fn();
  const view = render(
    <InvestigationWorkbench
      {...stableProps}
      onStateChange={change}
      defaultState={{
        mode: "focused",
        focusedPathId: "a",
        selection: { type: "path", pathId: "a" },
      }}
    />,
  );
  view.rerender(
    <InvestigationWorkbench
      {...stableProps}
      onStateChange={change}
      graph={{ ...graph, paths: graph.paths.filter((path) => path.id !== "a") }}
    />,
  );
  const layer = mapProps.overlays![0].layers[0];
  if (layer.type !== "line") throw new Error("Missing history line layer");
  expect(layer.paint?.["line-opacity"]).toBe(0.95);
  expect(
    screen.getByText("The selected record is no longer available."),
  ).toBeVisible();
  expect(within(ledger()).getByText("All reported observations")).toBeVisible();
  expect(change).not.toHaveBeenCalled();
});

function observeWorkbenchResize() {
  const observers: { callback: () => void; elements: Element[] }[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      item: { callback: () => void; elements: Element[] };
      constructor(callback: () => void) {
        this.item = { callback, elements: [] };
        observers.push(this.item);
      }
      observe(element: Element) {
        this.item.elements.push(element);
      }
      disconnect() {}
    },
  );
  return (root: HTMLElement) => {
    let width = 390;
    vi.spyOn(root, "getBoundingClientRect").mockImplementation(() => ({
      width,
      height: 900,
      top: 0,
      bottom: 900,
      left: 0,
      right: width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
    const observer = observers.find((item) => item.elements.includes(root))!;
    return (next: number) =>
      act(() => {
        width = next;
        observer.callback();
      });
  };
}

it.each(["Events", "Map"])(
  "retains keyboard focus when widening removes the mobile %s button",
  (view) => {
    const observe = observeWorkbenchResize();
    try {
      render(<InvestigationWorkbench {...props} />);
      const root = screen.getByRole("region", {
        name: "Investigation",
      });
      const resize = observe(root);
      resize(390);
      const button = screen.getByRole("button", { name: view });
      button.focus();
      resize(1000);
      expect(
        screen.getByRole("region", {
          name: view === "Events" ? "Observation ledger" : "History map",
        }),
      ).toHaveFocus();
      resize(390);
      expect(screen.getByRole("button", { name: view })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it("does not borrow view or sidebar focus from a sibling workbench during resize", () => {
  const observe = observeWorkbenchResize();
  try {
    render(
      <>
        <InvestigationWorkbench {...props} title="First investigation" />
        <InvestigationWorkbench {...props} title="Second investigation" />
      </>,
    );
    const first = screen.getByRole("region", {
      name: "First investigation",
    });
    const second = screen.getByRole("region", {
      name: "Second investigation",
    });
    const resizeFirst = observe(first);
    const resizeSecond = observe(second);
    resizeFirst(1000);
    resizeSecond(1000);
    within(first)
      .getByRole("button", { name: "Inspect repeated location" })
      .focus();
    resizeSecond(390);
    expect(
      within(second).getByRole("button", { name: "Events" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(first).getByRole("button", { name: "Inspect repeated location" }),
    ).toHaveFocus();
    resizeSecond(1000);
    const history = within(first).getByRole("button", {
      name: /History A.*3 observations/,
    });
    history.focus();
    resizeSecond(390);
    expect(
      second.querySelector<HTMLDetailsElement>("[data-workbench-sidebar]")!
        .open,
    ).toBe(false);
    expect(history).toHaveFocus();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("reveals a selected observation that becomes unassigned in a new graph snapshot", () => {
  const stableProps = { ...props, predictions: [], deviations: [] };
  const view = render(
    <InvestigationWorkbench
      {...stableProps}
      defaultState={{
        mode: "focused",
        focusedPathId: "a",
        selection: { type: "event", eventId: "e3" },
      }}
    />,
  );
  view.rerender(
    <InvestigationWorkbench
      {...stableProps}
      graph={{
        ...graph,
        paths: graph.paths.map((path) =>
          path.id === "a" ? { ...path, connectionIds: ["c1"] } : path,
        ),
      }}
    />,
  );
  const disclosure = within(ledger())
    .getByText("Unassigned observations (2)")
    .closest("details")!;
  expect(
    within(disclosure).getByText("Return").closest("button"),
  ).toHaveAttribute("aria-current", "true");
  expect(disclosure.open).toBe(true);
});

it("reveals a retained unassigned selection when unassigned observations are shown again", () => {
  render(
    <InvestigationWorkbench
      {...props}
      defaultState={{
        mode: "focused",
        focusedPathId: "a",
        selection: { type: "event", eventId: "e4" },
      }}
    />,
  );
  const toggle = screen.getByRole("checkbox", {
    name: /Unassigned observations/,
  });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  const disclosure = within(ledger())
    .getByText("Unassigned observations (1)")
    .closest("details")!;
  expect(
    within(disclosure).getByText("Delivered").closest("button"),
  ).toHaveAttribute("aria-current", "true");
  expect(disclosure.open).toBe(true);
});
