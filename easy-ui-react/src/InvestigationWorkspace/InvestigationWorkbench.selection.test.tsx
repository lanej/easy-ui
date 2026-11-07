import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import type { NetworkMapProps } from "../NetworkMap";
import { InvestigationWorkbench } from "./InvestigationWorkbench";
import type { InvestigationGraph } from "./workbenchModel";
import {
  initialInvestigationWorkbenchState,
  reduceInvestigationWorkbench,
} from "./workbenchState";
import { normalizeInvestigationGraph } from "./workbenchModel";
import { selectedObservationOverlays } from "./workbenchMap";

let mapProps: NetworkMapProps;
vi.mock("../NetworkMap", () => ({
  NetworkMap: (props: NetworkMapProps) => {
    mapProps = props;
    return (
      <div data-testid="selection-map">
        <button
          type="button"
          onClick={() => props.onFacilitySelect?.("origin")}
        >
          Pick origin
        </button>
      </div>
    );
  },
}));

const graph: InvestigationGraph = {
  events: [
    {
      id: "a",
      label: "Accepted",
      locationId: "origin",
      locationLabel: "Origin",
      timeLabel: "09:00",
    },
    {
      id: "b",
      label: "In transit",
      locationId: "hub",
      locationLabel: "Hub",
      timeLabel: "10:00",
    },
    {
      id: "c",
      label: "Delivered",
      locationId: "destination",
      locationLabel: "Destination",
      timeLabel: "11:00",
    },
    {
      id: "d",
      label: "Delivered",
      locationId: "origin",
      locationLabel: "Origin",
      timeLabel: "12:00",
    },
  ],
  connections: [
    { id: "ab", fromEventId: "a", toEventId: "b", segmentId: "ab-map" },
    { id: "bc", fromEventId: "b", toEventId: "c", segmentId: "bc-map" },
  ],
  paths: [
    {
      id: "A",
      label: "A · First history",
      connectionIds: ["ab", "bc"],
      color: "#2563eb",
    },
    {
      id: "B",
      label: "B · Second history",
      isolatedEventIds: ["d"],
      connectionIds: [],
      color: "#7c3aed",
    },
  ],
  locations: [
    { id: "origin", label: "Origin", coordinates: [-100, 40], kind: "hub" },
    { id: "hub", label: "Hub", coordinates: [-99, 39], kind: "hub" },
    {
      id: "destination",
      label: "Destination",
      coordinates: [-98, 38],
      kind: "delivery",
    },
  ],
  segments: [
    {
      id: "ab-map",
      from: "origin",
      to: "hub",
      label: "Known A to B",
      evidence: "inferred",
    },
    {
      id: "bc-map",
      from: "hub",
      to: "destination",
      label: "Known B to C",
      evidence: "inferred",
    },
  ],
};
const props = {
  graph,
  map: {
    mapStyle: { version: 8 as const, sources: {}, layers: [] },
    workerUrl: "/worker.js",
  },
};
const ledger = () => screen.getByRole("region", { name: "Observation ledger" });
const accepted = () =>
  within(ledger()).getByRole("button", { name: /Accepted Origin/ });
const inTransit = () =>
  within(ledger()).getByRole("button", { name: /In transit Hub/ });
const delivered = () =>
  within(ledger()).getByRole("button", { name: /Delivered Destination/ });

describe("InvestigationWorkbench explicit subset and expand behavior", () => {
  it("preserves the subset when opening selected rows and adds new rows during multi-select", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    fireEvent.click(accepted());
    fireEvent.click(screen.getByRole("button", { name: "Multi-select" }));
    fireEvent.click(delivered());
    expect(screen.getByText("2 selected")).toBeVisible();
    fireEvent.click(
      within(inTransit().closest("li")!).getByRole("button", {
        name: "Expand observation details",
      }),
    );
    expect(change.mock.lastCall?.[0]).toMatchObject({
      selectedEventIds: ["a", "b", "c"],
      selection: { type: "event", eventId: "b" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(
      within(delivered().closest("li")!).getByRole("button", {
        name: "Expand observation details",
      }),
    );
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["a", "b", "c"]);
  });

  it("retains navigation focus as the drawer moves and recovers when the next control becomes disabled", () => {
    render(<InvestigationWorkbench {...props} />);
    fireEvent.click(accepted());
    const next = () => screen.getByRole("button", { name: "Next event" });
    next().focus();
    fireEvent.click(next());
    expect(inTransit()).toHaveAttribute("aria-current", "true");
    expect(next()).toHaveFocus();
    fireEvent.click(next());
    expect(delivered()).toHaveAttribute("aria-current", "true");
    expect(next()).toHaveFocus();
    fireEvent.click(next());
    expect(next()).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Details" })).toHaveFocus();
    const previous = screen.getByRole("button", { name: "Previous event" });
    previous.focus();
    fireEvent.click(previous);
    expect(
      screen.getByRole("button", { name: "Previous event" }),
    ).toHaveFocus();
  });

  it("moves focus into the row drawer after choosing a visit from location details", () => {
    render(
      <InvestigationWorkbench
        {...props}
        defaultState={{ selection: { type: "location", locationId: "origin" } }}
      />,
    );
    const visit = screen.getByRole("button", { name: "Accepted · 09:00" });
    visit.focus();
    fireEvent.click(visit);
    expect(accepted()).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("tab", { name: "Details" })).toHaveFocus();
  });

  it("does not take focus back when a controlled navigation request is accepted later", () => {
    const change = vi.fn();
    const initial = {
      ...initialInvestigationWorkbenchState,
      selection: { type: "event" as const, eventId: "a" },
      selectedEventIds: ["a"],
    };
    const content = (state: typeof initialInvestigationWorkbenchState) => (
      <>
        <button>Outside workspace</button>
        <InvestigationWorkbench
          {...props}
          state={state}
          onStateChange={change}
        />
      </>
    );
    const { rerender } = render(content(initial));
    const next = screen.getByRole("button", { name: "Next event" });
    next.focus();
    fireEvent.click(next);
    expect(next).toHaveFocus();
    const outside = screen.getByRole("button", { name: "Outside workspace" });
    outside.focus();
    rerender(content(change.mock.lastCall?.[0]));
    expect(inTransit()).toHaveAttribute("aria-current", "true");
    expect(outside).toHaveFocus();
  });

  it.each([
    { type: "location", locationId: "origin", eventId: "a" } as const,
    { type: "path", pathId: "A", eventId: "a" } as const,
    { type: "segment", segmentId: "ab-map", eventId: "a" } as const,
  ])("validates the observation in a scoped $type selection", (selection) => {
    const records = normalizeInvestigationGraph(graph).records;
    const reduce = (ids: readonly string[]) =>
      reduceInvestigationWorkbench(
        initialInvestigationWorkbenchState,
        { type: "selectEvents", ids, selection },
        records,
        [],
      );
    expect(reduce(["d"]).selection).toEqual({ type: "event", eventId: "d" });
    expect(reduce(["a", "d"]).selection).toEqual(selection);
    expect(reduce([]).selection).toBeNull();
  });

  it("selects a full history without hiding other observations or inventing links", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    const path = within(ledger()).getByRole("button", {
      name: /A · First history.*3 observations/,
    });
    expect(path).toHaveTextContent("A");
    expect(path).not.toHaveTextContent("First history");
    fireEvent.click(path);
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["a", "b", "c"]);
    expect(
      within(ledger()).getByRole("button", { name: /Delivered Origin/ }),
    ).toBeInTheDocument();
    expect(
      (mapProps.overlays ?? []).some((overlay) =>
        overlay.id.includes("selected-history-A"),
      ),
    ).toBe(true);
    expect(
      (mapProps.overlays ?? []).some((overlay) =>
        overlay.id.includes("selected-points"),
      ),
    ).toBe(true);
  });

  it("makes descriptive history labels optional without losing accessible names", () => {
    const view = render(<InvestigationWorkbench {...props} />);
    const history = () =>
      within(ledger()).getByRole("button", { name: /A · First history/ });
    expect(history()).toHaveTextContent("A");
    expect(history()).not.toHaveTextContent("First history");
    expect(
      within(ledger()).queryByText(/First history emphasized/),
    ).not.toBeInTheDocument();
    view.rerender(<InvestigationWorkbench {...props} showHistoryLabels />);
    expect(history()).toHaveTextContent("A · First history");
  });

  it("supports Shift ranges, additive selection, and touch-friendly toggles", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    fireEvent.click(accepted());
    fireEvent.click(delivered(), { shiftKey: true });
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["a", "b", "c"]);
    fireEvent.click(inTransit(), { ctrlKey: true });
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["a", "c"]);
    fireEvent.click(screen.getByRole("button", { name: "Multi-select" }));
    expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(accepted());
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["c"]);
  });

  it("can select map location visits in selection mode without merging revisits", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Multi-select" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick origin" }));
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["a", "d"]);
  });

  it("preserves selection, focus, predictions, and map mounting across expansion", () => {
    const change = vi.fn();
    render(
      <InvestigationWorkbench
        {...props}
        onStateChange={change}
        renderInspectorGraph={({ selectedEventIds }) => (
          <span>Graph scope: {selectedEventIds.length}</span>
        )}
      />,
    );
    fireEvent.click(accepted());
    const map = screen.getByTestId("selection-map");
    expect(screen.getByText("Graph scope: 1")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Expand analysis to full screen" }),
    );
    expect(map).toBeInTheDocument();
    expect(map.closest("[data-expanded]")).toHaveAttribute(
      "data-expanded",
      "true",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "Expand analysis to full screen" }),
    ).toBeInTheDocument();
    expect(map).toBeInTheDocument();
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["a"]);
  });

  it("moves inspection to a remaining observation when a selected row is removed", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    fireEvent.click(accepted());
    fireEvent.click(delivered(), { ctrlKey: true });
    fireEvent.click(delivered(), { ctrlKey: true });
    expect(change.mock.lastCall?.[0]).toMatchObject({
      selectedEventIds: ["a"],
      selection: { type: "event", eventId: "a" },
    });
    expect(accepted()).toHaveAttribute("aria-current", "true");
    expect(delivered()).not.toHaveAttribute("aria-current", "true");
    fireEvent.click(accepted(), { metaKey: true });
    expect(change.mock.lastCall?.[0]).toMatchObject({
      selectedEventIds: [],
      selection: null,
    });
    expect(screen.getByText("0 selected")).toBeVisible();
  });

  it("inspects a history when selecting its complete observation set", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    fireEvent.click(accepted());
    fireEvent.click(screen.getByRole("button", { name: /B · Second history/ }));
    expect(change.mock.lastCall?.[0]).toMatchObject({
      selectedEventIds: ["d"],
      selection: { type: "path", pathId: "B" },
    });
    expect(
      screen.getByRole("heading", { name: "B · Second history" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Investigation mode" }),
    ).not.toBeInTheDocument();
  });

  it("moves inspection away from a map location when its visits are deselected", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    fireEvent.click(inTransit());
    fireEvent.click(screen.getByRole("button", { name: "Multi-select" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick origin" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick origin" }));
    expect(change.mock.lastCall?.[0]).toMatchObject({
      selectedEventIds: ["b"],
      selection: { type: "event", eventId: "b" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(
      screen.getByRole("button", { name: "Multi-select" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("1 selected")).toBeVisible();
  });

  it("initializes selection from the default inspected observation", () => {
    render(
      <InvestigationWorkbench
        {...props}
        defaultState={{ selection: { type: "event", eventId: "b" } }}
      />,
    );
    expect(screen.getByText("1 selected")).toBeVisible();
    expect(inTransit()).toHaveAttribute("aria-current", "true");
    expect(
      mapProps.overlays?.some((overlay) =>
        overlay.id.includes("selected-points"),
      ),
    ).toBe(true);
  });

  it("keeps supplemental analysis collapsed until requested", () => {
    render(
      <InvestigationWorkbench
        {...props}
        renderInspectorGraph={() => <span>Caller graph</span>}
      />,
    );
    fireEvent.click(accepted());
    const summary = screen.getByText("Additional analysis");
    const disclosure = summary.closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(disclosure).toHaveAttribute("open");
  });

  it("opens evidence inside its observation row and closes without clearing selection", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    const row = accepted().closest("li")!;
    fireEvent.click(
      within(row).getByRole("button", { name: "Expand observation details" }),
    );
    const drawer = screen.getByRole("region", {
      name: "Investigation inspector",
    });
    expect(row).toContainElement(drawer);
    expect(
      within(drawer).queryByRole("heading", { name: "Origin" }),
    ).not.toBeInTheDocument();
    expect(within(drawer).queryByText("09:00")).not.toBeInTheDocument();
    expect(within(drawer).getByText("Event ID")).toBeVisible();
    const selected = change.mock.lastCall?.[0];
    fireEvent.click(
      within(drawer).getByRole("button", {
        name: "Close investigation details",
      }),
    );
    expect(
      screen.queryByRole("region", { name: "Investigation inspector" }),
    ).not.toBeInTheDocument();
    expect(change.mock.lastCall?.[0]).toBe(selected);
    expect(
      within(row).getByRole("button", { name: "Expand observation details" }),
    ).toHaveFocus();
    expect(accepted()).toHaveAttribute("aria-current", "true");
  });

  it("closes a drawer with Escape and retains selected observations", () => {
    render(<InvestigationWorkbench {...props} />);
    fireEvent.click(accepted());
    const drawer = screen.getByRole("region", {
      name: "Investigation inspector",
    });
    fireEvent.keyDown(within(drawer).getByRole("tab", { name: "Details" }), {
      key: "Escape",
    });
    expect(
      screen.queryByRole("region", { name: "Investigation inspector" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeVisible();
    expect(
      within(accepted().closest("li")!).getByRole("button", {
        name: "Expand observation details",
      }),
    ).toHaveFocus();
  });

  it("moves the single drawer with the inspected observation while preserving a subset", () => {
    render(<InvestigationWorkbench {...props} />);
    fireEvent.click(accepted());
    fireEvent.click(delivered(), { ctrlKey: true });
    const firstRow = accepted().closest("li")!;
    const lastRow = delivered().closest("li")!;
    expect(lastRow).toContainElement(
      screen.getByRole("region", { name: "Investigation inspector" }),
    );
    fireEvent.click(
      within(firstRow).getByRole("button", {
        name: "Expand observation details",
      }),
    );
    expect(firstRow).toContainElement(
      screen.getByRole("region", { name: "Investigation inspector" }),
    );
    expect(
      screen.getAllByRole("region", { name: "Investigation inspector" }),
    ).toHaveLength(1);
    expect(screen.getByText("2 selected")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Pick origin" }));
    const contextual = screen.getByRole("region", {
      name: "Investigation inspector",
    });
    expect(contextual.closest("li")).toBeNull();
    expect(
      within(contextual).getByText(/2 observations at this location/),
    ).toBeVisible();
  });

  it("uses only explicit edges to highlight a disjoint selection", () => {
    const records = normalizeInvestigationGraph(graph).records;
    const none = selectedObservationOverlays(records, ["a", "c", "d"], "test");
    expect(
      none.some((overlay) => overlay.id.includes("selected-history")),
    ).toBe(false);
    expect(none.some((overlay) => overlay.id.includes("selected-points"))).toBe(
      true,
    );
    const adjacent = selectedObservationOverlays(records, ["a", "b"], "test");
    expect(
      adjacent.some((overlay) => overlay.id.includes("selected-history-A")),
    ).toBe(true);
    const focused = reduceInvestigationWorkbench(
      initialInvestigationWorkbenchState,
      { type: "focus", pathId: "A" },
      records,
      [],
    );
    expect(focused.selectedEventIds).toEqual(["a", "b", "c"]);
  });
});
