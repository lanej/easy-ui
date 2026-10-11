import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { EventTimeline } from "./EventTimeline";
import { EventMetrics } from "../EventMetrics";
import { HealthAssessment } from "../HealthAssessment";
import { DurationDistribution } from "../DurationDistribution";
import type { EventTimelineEvent } from "./EventItem";

const events: EventTimelineEvent[] = [
  {
    id: "first",
    label: "Arrived",
    timeLabel: "10:00",
    locationId: "one",
    tone: "warning",
  },
  {
    id: "second",
    label: "Arrived",
    timeLabel: "10:00",
    locationId: "two",
    tone: "danger",
  },
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
    const { rerender } = render(
      <EventTimeline
        events={events}
        selectedId="first"
        onSelectedIdChange={onSelectedIdChange}
      />,
    );
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelectedIdChange).toHaveBeenCalledWith("second");
    expect(screen.getAllByRole("button")[0]).toHaveAttribute(
      "aria-current",
      "true",
    );
    rerender(
      <EventTimeline
        events={events}
        selectedId="second"
        onSelectedIdChange={onSelectedIdChange}
      />,
    );
    expect(screen.getAllByRole("button")[1]).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("navigates with keyboard while keeping unknown and conflicting events", () => {
    const onSelectedIdChange = vi.fn();
    render(
      <EventTimeline
        events={events}
        defaultSelectedId="first"
        onSelectedIdChange={onSelectedIdChange}
      />,
    );
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
    render(
      <EventTimeline events={events} onLocationSelect={onLocationSelect} />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Show location" })[1],
    );
    expect(onLocationSelect).toHaveBeenCalledWith("two", "second");
    expect(
      screen.getAllByRole("button", { name: "Show location" }),
    ).toHaveLength(2);
  });

  it("retains compact location identity and names an icon-only facility type accessibly", () => {
    const located: EventTimelineEvent[] = [
      {
        id: "arrived",
        label: "Arrived",
        timeLabel: "17:06",
        locationLabel: "Sacramento, CA",
        locationTypeLabel: "Regional hub",
        detailLabel: "Received at 17:14",
        locationIcon: <svg data-testid="facility-icon" />,
      },
    ];
    const { rerender } = render(
      <EventTimeline events={located} size="compact" />,
    );
    const button = screen.getByRole("button", {
      name: /Arrived.*Sacramento, CA/,
    });
    expect(button).toHaveAccessibleDescription(
      "Regional hub. Received at 17:14",
    );
    expect(screen.getByText("Sacramento, CA")).toBeVisible();
    expect(screen.getByTestId("facility-icon").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    rerender(<EventTimeline events={located} />);
    expect(screen.getByText("Regional hub · Sacramento, CA")).toBeVisible();
    expect(screen.getByText("Received at 17:14")).toBeVisible();
  });

  it("renders caller-owned content between events without inventing intervals", () => {
    render(
      <EventTimeline
        events={events}
        renderInterval={(event) => <span>After {event.id}</span>}
      />,
    );
    expect(screen.getByText("After first")).toBeVisible();
    expect(screen.getByText("After second")).toBeVisible();
    expect(screen.queryByText("After third")).not.toBeInTheDocument();
  });

  it("retains metrics on every event, including the final observation, independently of intervals", () => {
    render(
      <EventTimeline
        events={events}
        renderMetrics={(event) => <span>Metrics for {event.id}</span>}
        renderInterval={(event) => <span>After {event.id}</span>}
      />,
    );

    const entries = screen.getAllByRole("listitem");
    for (const [index, event] of events.entries()) {
      const metric = within(entries[index]).getByText(
        `Metrics for ${event.id}`,
      );
      expect(metric).toBeVisible();
      expect(metric.closest("button")).toBeNull();
    }
    expect(screen.getAllByRole("button")).toHaveLength(events.length);
    expect(screen.getByText("After first")).toBeVisible();
    expect(screen.getByText("After second")).toBeVisible();
    expect(screen.queryByText("After third")).not.toBeInTheDocument();
  });

  it("places minimal metric pills in the event row as a sibling of selection without changing keyboard navigation", () => {
    const onSelectedIdChange = vi.fn();
    const { container } = render(
      <EventTimeline
        events={events}
        size="compact"
        defaultSelectedId="first"
        onSelectedIdChange={onSelectedIdChange}
        renderTrailing={(event) => (
          <EventMetrics
            variant="minimal"
            ariaLabel={`${event.id} outcomes`}
            metrics={[
              {
                id: "dwell",
                label: "Dwell time",
                valueLabel: "6 h",
                assessment: "healthy",
              },
              {
                id: "exception",
                label: "Exception rate",
                valueLabel: "2%",
                assessment: "degraded",
                assessmentLabel: "Elevated",
              },
            ]}
          />
        )}
      />,
    );
    const timeline = screen.getByRole("list", { name: "Event timeline" });
    const entries = Array.from(timeline.children) as HTMLElement[];
    const buttons = entries.map((entry) => within(entry).getByRole("button"));
    for (const [index, event] of events.entries()) {
      const outcomes = screen.getByRole("list", {
        name: `${event.id} outcomes`,
      });
      const slot = outcomes.parentElement;
      expect(slot?.parentElement).toBe(buttons[index].parentElement);
      expect(outcomes.closest("button")).toBeNull();
      expect(within(outcomes).getByText("Dwell time 6 h")).toBeVisible();
      const exception = within(outcomes).getByRole("group", {
        name: "Exception rate: 2%; Elevated",
      });
      expect(exception).toHaveTextContent(/^Exception rate 2%$/);
      expect(exception).toHaveAttribute("data-assessment", "degraded");
      expect(exception).not.toHaveTextContent("Elevated");
      expect(
        within(buttons[index]).queryByText("Dwell time 6 h"),
      ).not.toBeInTheDocument();
    }
    expect(container.querySelector("button button")).toBeNull();
    expect(buttons).toHaveLength(events.length);
    fireEvent.keyDown(buttons[0], { key: "ArrowDown" });
    expect(buttons[1]).toHaveFocus();
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("second");
    fireEvent.keyDown(buttons[1], { key: "End" });
    expect(buttons[2]).toHaveFocus();
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("third");
  });

  it("keeps metric controls outside event buttons and out of arrow-key selection", () => {
    const onSelectedIdChange = vi.fn();
    const onMetricClick = vi.fn();
    const { container } = render(
      <EventTimeline
        events={events}
        defaultSelectedId="first"
        onSelectedIdChange={onSelectedIdChange}
        renderMetrics={(event) => (
          <button onClick={onMetricClick}>Inspect {event.id} metric</button>
        )}
      />,
    );
    const entries = screen.getAllByRole("listitem");
    const select = (index: number) =>
      within(entries[index]).getAllByRole("button")[0];

    expect(container.querySelector("button button")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect first metric" }),
    );
    expect(onMetricClick).toHaveBeenCalledOnce();
    expect(onSelectedIdChange).not.toHaveBeenCalled();

    fireEvent.keyDown(select(0), { key: "ArrowDown" });
    expect(select(1)).toHaveFocus();
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("second");
    fireEvent.keyDown(select(1), { key: "End" });
    expect(select(2)).toHaveFocus();
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("third");
    fireEvent.keyDown(select(2), { key: "Home" });
    expect(select(0)).toHaveFocus();
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("first");
  });
  it("composes an optional duration assessment between events without changing chronology", () => {
    const { rerender } = render(
      <EventTimeline
        events={events}
        renderInterval={(event) =>
          event.id === "first" ? (
            <HealthAssessment
              variant="compact"
              observation={{ value: 6, unit: "hours" }}
              health={{ assessment: "healthy", label: "As expected" }}
            />
          ) : null
        }
      />,
    );
    expect(screen.getByRole("group", { name: "Duration" })).toBeVisible();
    expect(screen.getByText("As expected")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    rerender(<EventTimeline events={events} />);
    expect(screen.queryByText("As expected")).not.toBeInTheDocument();
  });

  it("renders inline quantiles and the current value without altering selection controls", () => {
    render(
      <EventTimeline
        events={events}
        renderTrailing={(event) =>
          event.id === "first" ? (
            <HealthAssessment
              variant="default"
              observation={{ value: 6, unit: "hours" }}
              health={{ assessment: "healthy", label: "As expected" }}
              reference={
                <DurationDistribution
                  value={6}
                  unit="h"
                  domain={[0, 30]}
                  quantiles={[
                    { fraction: 0.5, value: 9 },
                    { fraction: 0.9, value: 18 },
                  ]}
                  visualization="points"
                />
              }
            />
          ) : null
        }
      />,
    );
    expect(screen.getByRole("group", { name: "Duration" })).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("img", { name: /P50/ })).toBeVisible();
  });
  it("keeps the current value readable while using a smooth concentration reference without tiny percentile text", () => {
    const { container } = render(
      <EventTimeline
        events={events}
        renderTrailing={(event) =>
          event.id === "first" ? (
            <HealthAssessment
              variant="inline"
              size="sm"
              observation={{ value: 6, unit: "h" }}
              health={{ assessment: "healthy", label: "As expected" }}
              reference={
                <DurationDistribution
                  value={6}
                  unit="h"
                  domain={[0, 30]}
                  quantiles={[
                    { fraction: 0.5, value: 9 },
                    { fraction: 0.9, value: 18 },
                  ]}
                  bins={[
                    { from: 0, to: 10, count: 9 },
                    { from: 10, to: 20, count: 18 },
                    { from: 20, to: 30, count: 3 },
                  ]}
                  visualization="histogram"
                  distributionStyle="smooth"
                  distributionPresentation="concentration"
                  showScale={false}
                  stretch={false}
                />
              }
            />
          ) : null
        }
      />,
    );
    expect(screen.getByText("As expected")).toBeVisible();
    expect(screen.getByText("6")).toBeVisible();
    expect(
      screen.getByRole("img", { name: /P50: 9 h.*P90: 18 h/ }),
    ).toBeVisible();
    expect(
      container.querySelector('[data-concentration-style="smooth"]'),
    ).not.toBeNull();
    expect(screen.queryByText("P50")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
