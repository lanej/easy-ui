import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { Pill } from "../Pill";
import { EventTimeline } from "./EventTimeline";
import type { EventTimelineEvent } from "./EventItem";

const ledgerEvents: EventTimelineEvent[] = [
  {
    id: "accepted",
    locationId: "hammond",
    locationLabel: "Hammond, IN",
    locationTypeLabel: "Origin facility",
    label: "Accepted",
    timeLabel: "Oct 22 · 12:23 UTC",
  },
  {
    id: "delivery-a",
    locationId: "stotts",
    locationLabel: "Stotts City, MO",
    label: "Delivered",
    timeLabel: "Oct 23 · 11:26 UTC",
    receivedTimeLabel: "11:27 UTC",
    detailLabel: "Received at 11:27 UTC · Source A",
  },
  {
    id: "delivery-b",
    locationId: "stotts",
    locationLabel: "Stotts City, MO",
    label: "Delivered",
    timeLabel: "Oct 23 · 11:26 UTC",
    receivedTimeLabel: "11:41 UTC",
    detailLabel: "Received at 11:41 UTC · Source B",
  },
];

describe("EventTimeline ledger", () => {
  it("places event type before location and occurrence time, with separately named risk", () => {
    render(
      <EventTimeline
        events={ledgerEvents}
        variant="ledger"
        size="compact"
        defaultSelectedId="delivery-a"
        renderTrailing={(event) => (
          <Pill tone={event.id === "accepted" ? "neutral" : "danger"} size="xs">
            {event.id === "accepted" ? "Not assessed" : "High risk"}
          </Pill>
        )}
      />,
    );

    const accepted = screen.getByRole("button", {
      name: "Accepted Hammond, IN Oct 22 · 12:23 UTC",
    });
    expect(accepted).toHaveAccessibleDescription(
      "Origin facility Not assessed",
    );
    const delivery = screen.getByRole("button", {
      name: /Delivered Stotts City, MO.*Source A/,
    });
    expect(delivery).toHaveAccessibleDescription("High risk");
    expect(delivery).toHaveAttribute("aria-current", "true");
    expect(within(delivery).queryByText("High risk")).not.toBeInTheDocument();
    const row = delivery.closest("li")!;
    expect(within(row).getAllByText("Delivered")).toHaveLength(1);
    expect(within(row).getByText("Oct 23 · 11:26 UTC")).toBeVisible();
    expect(within(row).queryByRole("img")).not.toBeInTheDocument();
    expect(within(accepted).getByText("Accepted")).toBeVisible();
    expect(within(accepted).getByText("Hammond, IN")).toBeVisible();
    expect(within(accepted).getByText("Oct 22 · 12:23 UTC")).toBeVisible();
  });

  it("keeps duplicate reports visibly distinguishable without merging or changing caller order", () => {
    render(
      <EventTimeline events={ledgerEvents} variant="ledger" size="compact" />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(
      within(rows[1]).getByText("Received at 11:27 UTC · Source A"),
    ).toBeVisible();
    expect(
      within(rows[2]).getByText("Received at 11:41 UTC · Source B"),
    ).toBeVisible();
    expect(within(rows[1]).getByRole("button")).toHaveAccessibleName(
      /Source A/,
    );
    expect(within(rows[2]).getByRole("button")).toHaveAccessibleName(
      /Source B/,
    );
  });

  it("keeps an unlocated event selectable and identifies receipt time without using it as occurrence", () => {
    render(
      <EventTimeline
        variant="ledger"
        size="compact"
        events={[
          {
            id: "unlocated",
            label: "Delivery reported",
            receivedTimeLabel: "Oct 24 · 14:00 UTC",
          },
        ]}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Delivery reported Time unknown Received: Oct 24 · 14:00 UTC",
    });
    expect(screen.getAllByText("Delivery reported")).toHaveLength(1);
    expect(screen.getByText("Received: Oct 24 · 14:00 UTC")).toBeVisible();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-current", "true");
  });

  it("keeps controlled selection and keyboard focus independent of risk controls", () => {
    const onSelectedIdChange = vi.fn();
    const onRiskClick = vi.fn();
    const { container } = render(
      <EventTimeline
        events={ledgerEvents}
        variant="ledger"
        selectedId="accepted"
        onSelectedIdChange={onSelectedIdChange}
        renderTrailing={(event) => (
          <button onClick={onRiskClick}>Inspect {event.id} risk</button>
        )}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    const buttons = rows.map((row) => within(row).getAllByRole("button")[0]);
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect delivery-a risk" }),
    );
    expect(onRiskClick).toHaveBeenCalledOnce();
    expect(onSelectedIdChange).not.toHaveBeenCalled();
    fireEvent.keyDown(buttons[1], { key: "ArrowDown" });
    expect(buttons[2]).toHaveFocus();
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("delivery-b");
    expect(buttons[0]).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(buttons[2], { key: "Home" });
    expect(buttons[0]).toHaveFocus();
    expect(container.querySelector("button button")).toBeNull();
  });

  it.each(["below", "inline"] as const)(
    "keeps %s metric and detail controls outside the ledger event button, including the final event",
    (metricsPlacement) => {
      const onSelectedIdChange = vi.fn();
      render(
        <EventTimeline
          events={ledgerEvents}
          variant="ledger"
          metricsPlacement={metricsPlacement}
          onSelectedIdChange={onSelectedIdChange}
          renderMetrics={(event) => <button>Inspect {event.id} metric</button>}
          renderTrailing={() => <Pill size="xs">Assessed</Pill>}
          renderDetails={(event) => (
            <button>Inspect {event.id} evidence</button>
          )}
          renderInterval={(event) => <span>After {event.id}</span>}
        />,
      );
      for (const event of ledgerEvents) {
        const metric = screen.getByRole("button", {
          name: `Inspect ${event.id} metric`,
        });
        const evidence = screen.getByRole("button", {
          name: `Inspect ${event.id} evidence`,
        });
        expect(metric.parentElement?.closest("button")).toBeNull();
        expect(evidence.parentElement?.closest("button")).toBeNull();
        if (metricsPlacement === "inline") {
          const slot = metric.closest("[data-inline-metrics]");
          const row = metric.closest("li")!;
          // References span below both identity and a separate risk badge,
          // so a trailing summary cannot squeeze them into the text column.
          expect(slot?.parentElement).toBe(
            row.querySelector('[data-variant="ledger"]'),
          );
        }
        fireEvent.click(metric);
      }
      expect(onSelectedIdChange).not.toHaveBeenCalled();
      expect(screen.getByText("After delivery-a")).toBeVisible();
      expect(screen.queryByText("After delivery-b")).not.toBeInTheDocument();
    },
  );

  it("retains unresolved relationships when their events are absent from the current view", () => {
    render(
      <EventTimeline
        events={[]}
        variant="ledger"
        connections={[
          { id: "outside", fromEventId: "origin", toEventId: "delivery" },
        ]}
      />,
    );
    expect(screen.getByText("No observations")).toBeVisible();
    expect(
      screen.getByText(
        /Event origin \(outside this view\).*Event delivery \(outside this view\)/,
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Endpoint outside this view; no connection is drawn."),
    ).toBeVisible();
  });
});
