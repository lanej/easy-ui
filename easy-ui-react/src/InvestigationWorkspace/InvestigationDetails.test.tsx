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
function Composition() {
  const [selection, setSelection] = useState<InvestigationSelection>(null);
  const context = resolveSelection({ events }, selection);
  const chooseEvent = (id: string) => setSelection(selectEvent(context, id));
  return (
    <>
      <EventTimeline
        events={events}
        selectedId={context.event?.id ?? null}
        onSelectedIdChange={chooseEvent}
      />
      <InvestigationDetails
        context={context}
        chooseEvent={chooseEvent}
        clear={() => setSelection(null)}
        renderDetails={({ event }) => <button>Inspect {event?.id}</button>}
      />
    </>
  );
}

describe("map-free investigation composition", () => {
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
      act(() => {
        width = 900;
        resize();
      });
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
