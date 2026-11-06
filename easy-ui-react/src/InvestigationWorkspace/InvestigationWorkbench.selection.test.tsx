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
    fireEvent.click(screen.getByRole("button", { name: "Select points" }));
    expect(screen.getByRole("button", { name: "Selecting" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(accepted());
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["c"]);
  });

  it("can select map location visits in selection mode without merging revisits", () => {
    const change = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Select points" }));
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
      screen.getByRole("button", { name: "Expand map to full screen" }),
    );
    expect(map).toBeInTheDocument();
    expect(map.closest("[data-expanded]")).toHaveAttribute(
      "data-expanded",
      "true",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "Expand map to full screen" }),
    ).toBeInTheDocument();
    expect(map).toBeInTheDocument();
    expect(change.mock.lastCall?.[0].selectedEventIds).toEqual(["a"]);
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
