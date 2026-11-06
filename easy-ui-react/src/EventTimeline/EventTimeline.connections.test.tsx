import React from "react";
import { render } from "../utilities/test";
import { screen, within } from "@testing-library/react";
import { EventTimeline } from "./EventTimeline";

const events = [
  { id: "a", label: "Origin" },
  { id: "unrelated", label: "Other path" },
  { id: "b", label: "Arrival" },
];
const connections = [
  { id: "a-b", fromEventId: "a", toEventId: "b", pathIds: ["a"] },
];
describe("explicit connection evidence", () => {
  it("uses supplied endpoints rather than adjacent rows and places evidence at the destination", () => {
    const interval = vi.fn(() => <span>Wrong adjacency</span>);
    const evidence = vi.fn(({ connection, fromEvent, toEvent }) => (
      <span>
        {connection.id}: {fromEvent.label} to {toEvent.label}
      </span>
    ));
    render(
      <EventTimeline
        events={events}
        connections={connections}
        renderInterval={interval}
        renderConnectionMetrics={evidence}
        metricsPlacement="inline"
        variant="ledger"
      />,
    );
    expect(interval).not.toHaveBeenCalled();
    expect(evidence).toHaveBeenCalledTimes(1);
    const arrival = screen.getByRole("button", { name: /Arrival/ });
    expect(
      within(arrival.closest("li")!).getByText("a-b: Origin to Arrival"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Wrong adjacency")).not.toBeInTheDocument();
  });
  it("retains legacy intervals only without explicit connections", () => {
    const interval = vi.fn(() => "interval");
    const { rerender } = render(
      <EventTimeline events={events} renderInterval={interval} />,
    );
    expect(interval).toHaveBeenCalledTimes(2);
    interval.mockClear();
    rerender(
      <EventTimeline
        events={events}
        connections={[]}
        renderInterval={interval}
      />,
    );
    expect(interval).not.toHaveBeenCalled();
  });
  it("omits metrics with missing endpoints and preserves independent incoming relationships", () => {
    const metric = vi.fn(({ connection }) => connection.id);
    render(
      <EventTimeline
        events={events}
        connections={[
          ...connections,
          { id: "other-b", fromEventId: "unrelated", toEventId: "b" },
          { id: "missing", fromEventId: "absent", toEventId: "b" },
        ]}
        renderConnectionMetrics={metric}
      />,
    );
    expect(metric.mock.calls.map(([context]) => context.connection.id)).toEqual(
      ["a-b", "other-b"],
    );
  });
});
