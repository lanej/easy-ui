import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
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
