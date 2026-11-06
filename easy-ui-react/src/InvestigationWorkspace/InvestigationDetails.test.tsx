import React, { useState } from "react";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { EventTimeline, type EventTimelineEvent } from "../EventTimeline";
import {
  InvestigationDetails,
  resolveSelection,
  selectEvent,
  type InvestigationSelection,
} from ".";

const events: EventTimelineEvent[] = [
  {
    id: "created",
    label: "Account created",
    timeLabel: "Oct 15, 2026",
    description: "Created by an administrator",
  },
  { id: "updated", label: "Preferences updated", timeLabel: "Oct 16, 2026" },
];
function Composition({
  variant = "default",
  observations = events,
}: {
  variant?: "default" | "compact";
  observations?: EventTimelineEvent[];
} = {}) {
  const [selection, setSelection] = useState<InvestigationSelection>(null);
  const context = resolveSelection({ events: observations }, selection);
  const chooseEvent = (id: string) => setSelection(selectEvent(context, id));
  return (
    <>
      <EventTimeline
        events={observations}
        selectedId={context.event?.id ?? null}
        onSelectedIdChange={chooseEvent}
      />
      <InvestigationDetails
        variant={variant}
        context={context}
        chooseEvent={chooseEvent}
        clear={() => setSelection(null)}
        renderDetails={({ event }) => <button>Inspect {event?.id}</button>}
      />
    </>
  );
}

describe("map-free investigation composition", () => {
  it("keeps compact event types in the live announcement without duplicating an unlocated heading", () => {
    render(
      <Composition
        variant="compact"
        observations={[
          {
            id: "accepted",
            label: "Accepted",
            timeLabel: "Oct 22 · 04:04 UTC",
          },
          {
            id: "delivered",
            label: "Delivered",
            locationLabel: "Avondale, AZ",
            timeLabel: "Oct 24 · 11:25 UTC",
            receivedTimeLabel: "Oct 24 · 11:41 UTC",
          },
        ]}
      />,
    );
    const timeline = screen.getByRole("list", { name: "Event timeline" });
    fireEvent.click(within(timeline).getAllByRole("button")[0]);
    const inspector = within(
      screen.getByRole("region", { name: "Selection details" }),
    );
    expect(inspector.getAllByText("Accepted", { exact: true })).toHaveLength(1);
    expect(inspector.getByRole("heading", { name: "Accepted" })).toBeVisible();
    expect(inspector.getByText("Not supplied")).toBeVisible();
    fireEvent.click(inspector.getByRole("button", { name: "Next event" }));
    expect(
      inspector.getByRole("heading", { name: "Avondale, AZ" }),
    ).toBeVisible();
    expect(inspector.getByRole("status")).toHaveTextContent(
      "Delivered · Avondale, AZ · Oct 24 · 11:25 UTC · Received Oct 24 · 11:41 UTC · Event 2 of 2",
    );
  });

  it("coordinates controlled timeline keyboard selection, stepping, rich details and clear", () => {
    render(<Composition />);
    const timeline = screen.getByRole("list", { name: "Event timeline" });
    const rows = within(timeline).getAllByRole("button");
    const inspector = screen.getByRole("region", { name: "Selection details" });
    expect(
      within(inspector).getByText(
        "Select an event, location, or candidate path.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(rows[0]);
    expect(rows[0]).toHaveAttribute("aria-current", "true");
    expect(
      within(inspector).getByRole("button", { name: "Previous event" }),
    ).toBeDisabled();
    expect(
      within(inspector).getByRole("button", { name: "Inspect created" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(inspector).getByRole("button", { name: "Next event" }),
    );
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(
      within(inspector).getByRole("button", { name: "Next event" }),
    ).toBeDisabled();
    rows[1].focus();
    fireEvent.keyDown(rows[1], { key: "Home" });
    expect(rows[0]).toHaveFocus();
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });
    expect(rows[1]).toHaveFocus();
    fireEvent.keyDown(rows[1], { key: "ArrowUp" });
    expect(rows[0]).toHaveFocus();
    fireEvent.keyDown(rows[0], { key: "End" });
    expect(rows[1]).toHaveFocus();
    fireEvent.click(
      within(inspector).getByRole("button", { name: "Previous event" }),
    );
    expect(rows[0]).toHaveAttribute("aria-current", "true");
    fireEvent.click(
      within(inspector).getByRole("button", { name: "Clear selection" }),
    );
    expect(timeline.querySelector('[aria-current="true"]')).toBeNull();
    expect(within(inspector).getByRole("status")).toHaveTextContent(
      "Selection cleared",
    );
  });

  it("detects its own narrow container, preserves mounted detail content and restores hidden focus", () => {
    let width = 900;
    let resize = () => {};
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width,
        height: 600,
        top: 0,
        left: 0,
        right: width,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON() {},
      }));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: () => void) {}
        observe() {
          resize = this.callback;
        }
        disconnect() {}
      },
    );
    try {
      render(
        <InvestigationDetails
          context={resolveSelection(
            { events },
            { type: "event", eventId: "created" },
          )}
          chooseEvent={vi.fn()}
          clear={vi.fn()}
          renderDetails={() => <button>Rich action</button>}
        />,
      );
      const action = screen.getByRole("button", { name: "Rich action" });
      action.focus();
      act(() => {
        width = 360;
        resize();
      });
      const show = screen.getByRole("button", { name: "Show details" });
      expect(show).toHaveFocus();
      expect(
        action.closest("[data-investigation-details-body]"),
      ).toHaveAttribute("hidden");
      fireEvent.click(show);
      expect(screen.getByRole("button", { name: "Rich action" })).toBe(action);
      fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
      screen.getByRole("button", { name: "Show details" }).focus();
      act(() => {
        width = 900;
        resize();
      });
      expect(
        screen.getByRole("region", { name: "Selection details" }),
      ).toHaveFocus();
      expect(screen.getByRole("button", { name: "Rich action" })).toBe(action);
      expect(
        screen.queryByRole("button", { name: "Show details" }),
      ).not.toBeInTheDocument();
    } finally {
      rect.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("restores focus when a parent switches the narrow override", () => {
    const props = {
      context: resolveSelection(
        { events },
        { type: "event" as const, eventId: "created" },
      ),
      chooseEvent: vi.fn(),
      clear: vi.fn(),
      renderDetails: () => <button>Controlled action</button>,
    };
    const { rerender } = render(
      <InvestigationDetails {...props} isNarrow={false} />,
    );
    screen.getByRole("button", { name: "Controlled action" }).focus();
    rerender(<InvestigationDetails {...props} isNarrow />);
    expect(screen.getByRole("button", { name: "Show details" })).toHaveFocus();
  });

  it.each([false, true])(
    "keeps inspector focus when a parent widens a focused disclosure (expanded: %s)",
    (expanded) => {
      const props = {
        context: resolveSelection(
          { events },
          { type: "event" as const, eventId: "created" },
        ),
        chooseEvent: vi.fn(),
        clear: vi.fn(),
        renderDetails: () => <button>Controlled action</button>,
      };
      const { rerender } = render(<InvestigationDetails {...props} isNarrow />);
      const show = screen.getByRole("button", { name: "Show details" });
      if (expanded) fireEvent.click(show);
      screen
        .getByRole("button", {
          name: expanded ? "Hide details" : "Show details",
        })
        .focus();
      rerender(<InvestigationDetails {...props} isNarrow={false} />);
      expect(
        screen.getByRole("region", { name: "Selection details" }),
      ).toHaveFocus();
      expect(
        screen.getByRole("button", { name: "Controlled action" }),
      ).toBeInTheDocument();
    },
  );

  it("does not steal outside focus when widening after leaving the disclosure", () => {
    const props = {
      context: resolveSelection(
        { events },
        { type: "event" as const, eventId: "created" },
      ),
      chooseEvent: vi.fn(),
      clear: vi.fn(),
      renderDetails: () => <button>Controlled action</button>,
    };
    const { rerender } = render(
      <>
        <button>Outside inspector</button>
        <InvestigationDetails {...props} isNarrow />
      </>,
    );
    screen.getByRole("button", { name: "Show details" }).focus();
    const outside = screen.getByRole("button", { name: "Outside inspector" });
    outside.focus();
    rerender(
      <>
        <button>Outside inspector</button>
        <InvestigationDetails {...props} isNarrow={false} />
      </>,
    );
    expect(outside).toHaveFocus();
  });

  it("does not restore stale disclosure focus after clearing selection while narrow", () => {
    const props = {
      chooseEvent: vi.fn(),
      clear: vi.fn(),
      renderDetails: () => <button>Controlled action</button>,
    };
    const selected = resolveSelection(
      { events },
      { type: "event" as const, eventId: "created" },
    );
    const cleared = resolveSelection({ events }, null);
    const { rerender } = render(
      <>
        <button>Outside inspector</button>
        <InvestigationDetails {...props} context={selected} isNarrow />
      </>,
    );
    screen.getByRole("button", { name: "Show details" }).focus();
    rerender(
      <>
        <button>Outside inspector</button>
        <InvestigationDetails {...props} context={cleared} isNarrow />
      </>,
    );
    const outside = screen.getByRole("button", { name: "Outside inspector" });
    outside.focus();
    rerender(
      <>
        <button>Outside inspector</button>
        <InvestigationDetails {...props} context={cleared} isNarrow={false} />
      </>,
    );
    expect(outside).toHaveFocus();
  });

  it("retains missing-selection state and accepts partial labels without geometry", () => {
    render(
      <InvestigationDetails
        context={resolveSelection(
          { events },
          { type: "event", eventId: "removed" },
        )}
        chooseEvent={vi.fn()}
        clear={vi.fn()}
        labels={{ details: "Account details" }}
      />,
    );
    const inspector = screen.getByRole("region", { name: "Account details" });
    expect(
      within(inspector).getByRole("heading", { name: "Selection unavailable" }),
    ).toBeInTheDocument();
    expect(
      within(inspector).getByRole("button", { name: "Clear selection" }),
    ).toBeInTheDocument();
    expect(within(inspector).queryByRole("navigation")).not.toBeInTheDocument();
  });
});
