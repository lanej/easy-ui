import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { EventTimeline } from "./EventTimeline";
import { HealthAssessment } from "../HealthAssessment";
import { DurationDistribution } from "../DurationDistribution";
import type { EventTimelineEvent } from "./EventItem";

const events: EventTimelineEvent[] = [
  { id: "first", label: "Arrived", timeLabel: "10:00", locationId: "one", tone: "warning" },
  { id: "second", label: "Arrived", timeLabel: "10:00", locationId: "two", tone: "danger" },
  { id: "third", label: "No time or location", receivedTimeLabel: "11:00" },
];

describe("EventTimeline", () => {
  it("preserves duplicated descriptions and caller order without merging observations", () => {
    render(<EventTimeline events={events} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent("Arrived");
    expect(buttons[1]).toHaveTextContent("Arrived");
    expect(buttons[2]).toHaveTextContent("Time unknown");
  });

  it("supports controlled external selection without mutating it", () => {
    const onSelectedIdChange = vi.fn();
    const { rerender } = render(<EventTimeline events={events} selectedId="first" onSelectedIdChange={onSelectedIdChange} />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelectedIdChange).toHaveBeenCalledWith("second");
    expect(screen.getAllByRole("button")[0]).toHaveAttribute("aria-current", "true");
    rerender(<EventTimeline events={events} selectedId="second" onSelectedIdChange={onSelectedIdChange} />);
    expect(screen.getAllByRole("button")[1]).toHaveAttribute("aria-current", "true");
  });

  it("navigates with keyboard while keeping unknown and conflicting events", () => {
    const onSelectedIdChange = vi.fn();
    render(<EventTimeline events={events} defaultSelectedId="first" onSelectedIdChange={onSelectedIdChange} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.keyDown(buttons[0], { key: "ArrowDown" });
    expect(onSelectedIdChange).toHaveBeenCalledWith("second");
    expect(buttons[1]).toHaveFocus();
    fireEvent.keyDown(buttons[1], { key: "End" });
    expect(buttons[2]).toHaveFocus();
    fireEvent.keyDown(buttons[2], { key: "Home" });
    expect(buttons[0]).toHaveFocus();
  });

  it("keeps location coordination optional and explicit", () => {
    const onLocationSelect = vi.fn();
    render(<EventTimeline events={events} onLocationSelect={onLocationSelect} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Show location" })[1]);
    expect(onLocationSelect).toHaveBeenCalledWith("two", "second");
    expect(screen.getAllByRole("button", { name: "Show location" })).toHaveLength(2);
  });

  it("renders caller-owned content between events without inventing intervals", () => {
    render(<EventTimeline events={events} renderInterval={(event) => <span>After {event.id}</span>} />);
    expect(screen.getByText("After first")).toBeVisible();
    expect(screen.getByText("After second")).toBeVisible();
    expect(screen.queryByText("After third")).not.toBeInTheDocument();
  });
  it("composes an optional duration assessment between events without changing chronology", () => {
    const { rerender } = render(
      <EventTimeline
        events={events}
        renderInterval={(event) => event.id === "first" ? (
          <HealthAssessment
            variant="compact"
            observation={{ value: 6, unit: "hours" }}
            health={{ assessment: "healthy", label: "As expected" }}
          />
        ) : null}
      />,
    );
    expect(screen.getByRole("group", { name: "Duration" })).toBeVisible();
    expect(screen.getByText("As expected")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    rerender(<EventTimeline events={events} />);
    expect(screen.queryByText("As expected")).not.toBeInTheDocument();
  });

  it("renders inline quantiles and the current value without altering selection controls", () => {
    render(<EventTimeline events={events} renderTrailing={(event) => event.id === "first" ? (
      <HealthAssessment variant="default"
        observation={{ value: 6, unit: "hours" }}
        health={{ assessment: "healthy", label: "As expected" }}
        reference={<DurationDistribution value={6} unit="h" domain={[0, 30]}
          quantiles={[{ fraction: 0.5, value: 9 }, { fraction: 0.9, value: 18 }]}
          visualization="points" />} />
    ) : null} />);
    expect(screen.getByRole("group", { name: "Duration" })).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("img", { name: /P50/ })).toBeVisible();
  });
});
