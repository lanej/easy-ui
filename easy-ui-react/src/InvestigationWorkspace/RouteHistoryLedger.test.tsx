import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { RouteHistoryLedger } from "./RouteHistoryLedger";
import type { InvestigationRecords } from "./selection";

const reported = {
  label: "Arrival",
  statusLabel: "In transit",
  locationId: "brooklyn",
  pathIds: ["a"],
};
const records: Required<InvestigationRecords> = {
  events: [
    { ...reported, id: "arrival", detailLabel: "A1" },
    { ...reported, id: "follow-up", detailLabel: "U1" },
    { ...reported, id: "other-history", pathIds: ["b"] },
    {
      ...reported,
      id: "remote",
      locationId: undefined,
      locationLabel: "Area only",
    },
    { ...reported, id: "return" },
  ],
  locations: [
    {
      id: "brooklyn",
      label: "Brooklyn",
      kind: "hub",
      coordinates: [-73.94, 40.68],
    },
  ],
  paths: [
    { id: "a", label: "A", segmentIds: [], color: "#0284c7" },
    { id: "b", label: "B", segmentIds: [], color: "#7c3aed" },
  ],
  segments: [],
  connections: [],
};

it("shares only consecutive location and candidate headings, while keeping each observation inspectable", () => {
  const onInspectLocation = vi.fn(),
    onInspectEvent = vi.fn();
  render(
    <RouteHistoryLedger
      records={records}
      onInspectLocation={onInspectLocation}
      onInspectEvent={onInspectEvent}
      inspectorId="detail"
      selectedEventId="follow-up"
      eventAnnotations={{ "follow-up": { referenceLabel: "#10" } }}
    />,
  );
  const places = screen.getAllByRole("button", { name: "Inspect Brooklyn" });
  expect(places).toHaveLength(3);
  const [first] = screen.getAllByRole("list", { name: "Scans at Brooklyn" });
  expect(within(first).getAllByRole("button")).toHaveLength(2);
  expect(within(first).queryByText("In transit")).not.toBeInTheDocument();
  fireEvent.click(places[2]);
  expect(onInspectLocation).toHaveBeenCalledWith("brooklyn");
  const followUp = within(first).getByRole("button", { name: /U1.*#10/ });
  expect(followUp).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(followUp);
  expect(onInspectEvent).toHaveBeenCalledWith("follow-up");
  expect(
    screen.queryByRole("button", { name: "Inspect Area only" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Area only.*Arrival/ }));
  expect(onInspectEvent).toHaveBeenCalledWith("remote");
});

it("uses the map's dashed route and diamond for an explicit link, including when the other route is focused", () => {
  const rect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const id = this.dataset.routeEvent;
      if (id === "first") return new DOMRect(0, 40, 220, 28);
      if (id === "last") return new DOMRect(0, 100, 220, 28);
      return new DOMRect(0, 0, 300, 150);
    });
  try {
    const graph = {
      ...records,
      events: [
        { ...reported, id: "first", pathIds: ["a", "b"] },
        { ...reported, id: "last", pathIds: ["b"] },
      ],
      connections: [
        {
          id: "b-leg",
          fromEventId: "first",
          toEventId: "last",
          pathIds: ["b"],
        },
      ],
    };
    const { container } = render(
      <RouteHistoryLedger
        records={graph}
        focusedPathId="a"
        selectedEventId="first"
        inspectorId="detail"
        onInspectLocation={vi.fn()}
        onInspectEvent={vi.fn()}
      />,
    );
    const edge = container.querySelector('[data-connection-id="b-leg"]');
    expect(edge).toHaveAttribute("data-muted", "true");
    expect(edge?.querySelector('[data-path-id="b"]')).toHaveAttribute(
      "stroke-dasharray",
      "4 3",
    );
    expect(
      container.querySelector(
        '[data-connection-graph] [data-event-id="last"] > path',
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll(
        '[data-connection-graph] [data-event-id="first"] [pathLength]',
      ),
    ).toHaveLength(2);
  } finally {
    rect.mockRestore();
  }
});
