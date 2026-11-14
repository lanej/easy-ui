import React, { useState } from "react";
import { EventTimeline } from "../EventTimeline";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import {
  InvestigationWorkbench,
  type InvestigationAnalysisContext,
  type InvestigationAnalysisView,
} from "./InvestigationWorkbench";
import type { InvestigationGraph } from "./workbenchModel";

vi.mock("../NetworkMap", () => ({
  NetworkMap: () => (
    <input aria-label="Map state" defaultValue="original camera" />
  ),
}));

const graph: InvestigationGraph = {
  events: [
    { id: "one", label: "Accepted", timeLabel: "09:00" },
    { id: "two", label: "Arrived", timeLabel: "10:00" },
  ],
  connections: [{ id: "link", fromEventId: "one", toEventId: "two" }],
  paths: [
    { id: "a", label: "History A", color: "#2563eb", connectionIds: ["link"] },
  ],
};
const map = {
  mapStyle: { version: 8 as const, sources: {}, layers: [] },
  workerUrl: "/worker.js",
};
function Stats({ context }: { context: InvestigationAnalysisContext }) {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Selected: {context.selectedEventIds.join(",")}</p>
      <p>Inspected: {context.event?.id ?? "none"}</p>
      <p>Count: {count}</p>
      <input aria-label="Analysis note" defaultValue="retained" />
      <button onClick={() => setCount((value) => value + 1)}>
        Increment statistic
      </button>
    </div>
  );
}
const views: readonly InvestigationAnalysisView[] = [
  {
    id: "timing",
    label: "Timing",
    render: (context) => <Stats context={context} />,
  },
];
const props = {
  graph,
  map,
  analysisViews: views,
  defaultState: { selection: { type: "event" as const, eventId: "one" } },
};
const analysis = () =>
  screen.getByRole("region", { name: "Investigation analysis" });
const tab = (name: string | RegExp) =>
  within(analysis()).getByRole("tab", { name });
const ledger = () => screen.getByRole("region", { name: "Observation ledger" });

describe("InvestigationWorkbench peer analysis views", () => {
  it("keeps the timeline, drawers, map and chart state mounted across view changes", () => {
    const changed = vi.fn();
    render(<InvestigationWorkbench {...props} onStateChange={changed} />);
    const timeline = ledger();
    const drawer = screen.getByRole("region", {
      name: "Investigation inspector",
    });
    const camera = screen.getByRole("textbox", { name: "Map state" });
    fireEvent.change(camera, { target: { value: "panned camera" } });
    const scroll = timeline.querySelector<HTMLElement>(
      "[data-workbench-scroll]",
    )!;
    scroll.scrollTop = 137;
    fireEvent.click(tab("Timing"));
    expect(timeline).toBe(ledger());
    expect(drawer).toBe(
      screen.getByRole("region", { name: "Investigation inspector" }),
    );
    expect(camera).toBeInTheDocument();
    expect(camera).not.toBeVisible();
    expect(scroll.scrollTop).toBe(137);
    expect(screen.getByText("Selected: one")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Increment statistic" }),
    );
    fireEvent.click(tab("Map"));
    expect(camera).toBeVisible();
    expect(camera).toHaveValue("panned camera");
    fireEvent.click(tab("Timing"));
    expect(screen.getByText("Count: 1")).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(within(timeline).getByRole("button", { name: /Arrived/ }));
    expect(screen.getByText("Selected: two")).toBeVisible();
    expect(screen.getByText("Inspected: two")).toBeVisible();
    expect(tab("Timing")).toHaveAttribute("aria-selected", "true");
  });

  it("waits for a controlled owner to accept an analysis-view request", () => {
    const change = vi.fn();
    const { rerender } = render(
      <InvestigationWorkbench
        {...props}
        activeAnalysisViewId="map"
        onAnalysisViewChange={change}
      />,
    );
    fireEvent.click(tab("Timing"));
    expect(change).toHaveBeenCalledExactlyOnceWith("timing");
    expect(tab("Map")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Map" })).toBeVisible();
    rerender(
      <InvestigationWorkbench
        {...props}
        activeAnalysisViewId="timing"
        onAnalysisViewChange={change}
      />,
    );
    expect(screen.getByText("Selected: one")).toBeVisible();
    expect(tab("Timing")).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to Map when an active view is removed, recovering owned keyboard focus", () => {
    const { rerender } = render(
      <InvestigationWorkbench {...props} defaultAnalysisViewId="timing" />,
    );
    screen.getByRole("textbox", { name: "Analysis note" }).focus();
    rerender(
      <InvestigationWorkbench
        {...props}
        analysisViews={[]}
        defaultAnalysisViewId="timing"
      />,
    );
    expect(tab("Map")).toHaveAttribute("aria-selected", "true");
    expect(tab("Map")).toHaveFocus();
    rerender(
      <InvestigationWorkbench {...props} defaultAnalysisViewId="timing" />,
    );
    expect(tab("Map")).toHaveAttribute("aria-selected", "true");
  });

  it("does not borrow focus from outside when analysis views change", () => {
    const content = (analysisViews: readonly InvestigationAnalysisView[]) => (
      <>
        <button>Outside workspace</button>
        <InvestigationWorkbench
          {...props}
          analysisViews={analysisViews}
          defaultAnalysisViewId="timing"
        />
      </>
    );
    const { rerender } = render(content(views));
    screen.getByRole("textbox", { name: "Analysis note" }).focus();
    const outside = screen.getByRole("button", { name: "Outside workspace" });
    outside.focus();
    rerender(content([]));
    expect(outside).toHaveFocus();
  });

  it("keeps disabled views unavailable and retains zero counts", () => {
    render(
      <InvestigationWorkbench
        {...props}
        defaultAnalysisViewId="timing"
        analysisViews={[{ ...views[0], count: 0, isDisabled: true }]}
      />,
    );
    expect(tab(/Timing/)).toBeDisabled();
    expect(tab(/Timing/)).toHaveAccessibleName(/0/);
    expect(tab("Map")).toHaveAttribute("aria-selected", "true");
  });

  it.each(["map", "timing"])(
    "rejects duplicate or reserved view ID %s before rendering analysis",
    (id) => {
      const custom = vi.fn();
      render(
        <InvestigationWorkbench
          {...props}
          analysisViews={[views[0], { id, label: "Other", render: custom }]}
        />,
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Analysis views need distinct IDs",
      );
      expect(custom).not.toHaveBeenCalled();
    },
  );

  it("expands the analysis window while retaining the active view and investigation", () => {
    const change = vi.fn();
    render(
      <InvestigationWorkbench
        {...props}
        onStateChange={change}
        defaultAnalysisViewId="timing"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Expand analysis to full screen" }),
    );
    expect(analysis()).toHaveAttribute("data-expanded", "true");
    expect(screen.getByText("Selected: one")).toBeVisible();
    fireEvent.click(tab("Map"));
    fireEvent.click(tab("Timing"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(analysis()).not.toHaveAttribute("data-expanded");
    expect(tab("Timing")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("button", { name: "Expand analysis to full screen" }),
    ).toHaveFocus();
    expect(change).not.toHaveBeenCalled();
  });

  it("shares injective tab/panel IDs without colliding across workbenches", () => {
    render(
      <>
        <InvestigationWorkbench {...props} />
        <InvestigationWorkbench {...props} />
      </>,
    );
    const tabs = screen.getAllByRole("tab", { name: "Map" });
    expect(tabs).toHaveLength(2);
    expect(tabs[0].id).not.toBe(tabs[1].id);
    for (const button of tabs) {
      const panel = document.getElementById(
        button.getAttribute("aria-controls")!,
      );
      expect(panel).toHaveAttribute("aria-labelledby", button.id);
    }
  });
});

describe("independent selection and caller chronology", () => {
  it("selects original observations without opening details, including repeated and keyboard selection", () => {
    const changed = vi.fn();
    render(
      <InvestigationWorkbench
        graph={graph}
        map={map}
        openDetailsOnSelection={false}
        onStateChange={changed}
      />,
    );
    const accepted = screen.getByRole("button", { name: /Accepted 09:00/ });
    fireEvent.click(accepted);
    expect(changed.mock.lastCall?.[0].selection).toEqual({
      type: "event",
      eventId: "one",
    });
    expect(accepted).toHaveAttribute("aria-current", "true");
    expect(
      screen.queryByRole("region", { name: "Investigation inspector" }),
    ).not.toBeInTheDocument();
    fireEvent.click(accepted);
    expect(
      screen.queryByRole("region", { name: "Investigation inspector" }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(accepted, { key: "ArrowDown" });
    expect(changed.mock.lastCall?.[0].selection).toEqual({
      type: "event",
      eventId: "two",
    });
    expect(
      screen.queryByRole("region", { name: "Investigation inspector" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(
        screen.getByRole("button", { name: /Arrived 10:00/ }).closest("li")!,
      ).getByRole("button", { name: "Expand observation details" }),
    );
    expect(
      screen.getByRole("region", { name: "Investigation inspector" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse observation details" }),
    );
    expect(
      screen.queryByRole("region", { name: "Investigation inspector" }),
    ).not.toBeInTheDocument();
    fireEvent.click(accepted);
    expect(
      screen.queryByRole("region", { name: "Investigation inspector" }),
    ).not.toBeInTheDocument();
  });
  it("opens an unselected observation through its explicit disclosure and retains original graph callbacks in a custom chronology", () => {
    const changed = vi.fn();
    const chronology = vi.fn((timeline) => <EventTimeline {...timeline} />);
    render(
      <InvestigationWorkbench
        graph={graph}
        map={map}
        openDetailsOnSelection={false}
        renderTimeline={chronology}
        onStateChange={changed}
      />,
    );
    const row = screen
      .getByRole("button", { name: /Arrived 10:00/ })
      .closest("li")!;
    fireEvent.click(
      within(row).getByRole("button", { name: "Expand observation details" }),
    );
    expect(changed.mock.lastCall?.[0].selection).toEqual({
      type: "event",
      eventId: "two",
    });
    expect(
      screen.getByRole("region", { name: "Investigation inspector" }),
    ).toBeVisible();
    expect(
      chronology.mock.lastCall?.[0].events.map(
        (event: { id: string }) => event.id,
      ),
    ).toEqual(["one", "two"]);
    expect(chronology.mock.lastCall?.[0].connections[0]).toMatchObject({
      id: "link",
      fromEventId: "one",
      toEventId: "two",
    });
    expect(chronology.mock.lastCall?.[0].selectedIds).toEqual(["two"]);
  });
  it("keeps automatic disclosure as the backward-compatible default", () => {
    render(<InvestigationWorkbench graph={graph} map={map} />);
    fireEvent.click(screen.getByRole("button", { name: /Accepted 09:00/ }));
    expect(
      screen.getByRole("region", { name: "Investigation inspector" }),
    ).toBeVisible();
  });
});
