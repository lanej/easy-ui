import React from "react";
import { screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { EventMetrics, type EventMetric } from "./EventMetrics";

const metrics: EventMetric[] = [
  {
    id: "dwell",
    label: "Dwell time",
    valueLabel: "6 h",
    assessment: "healthy",
    assessmentLabel: "Within expected dwell",
    reference: <span role="img" aria-label="Dwell distribution" />,
  },
  {
    id: "exception",
    label: "Exception rate",
    valueLabel: "2%",
    assessment: "degraded",
    assessmentLabel: "Elevated",
    reference: <span role="img" aria-label="Exception distribution" />,
  },
];

describe("EventMetrics", () => {
  it.each(["minimal", "compact", "expanded"] as const)(
    "keeps the metric label and independent assessment inside each %s pill without an outside duplicate",
    (variant) => {
      render(<EventMetrics metrics={metrics} variant={variant} />);

      const dwell = screen.getByRole("group", {
        name: "Dwell time: 6 h; Within expected dwell",
      });
      const exception = screen.getByRole("group", {
        name: "Exception rate: 2%; Elevated",
      });
      expect(dwell).toHaveAttribute("data-assessment", "healthy");
      expect(dwell).toHaveTextContent(/^Dwell time 6 h$/);
      expect(exception).toHaveAttribute("data-assessment", "degraded");
      expect(exception).toHaveTextContent(/^Exception rate 2%$/);
      expect(exception).not.toHaveTextContent("Elevated");
      expect(
        screen.queryByText("Within expected dwell"),
      ).not.toBeInTheDocument();
      const entries = screen.getAllByRole("listitem");
      expect(entries[0].textContent?.match(/Dwell time/g)).toHaveLength(1);
      expect(entries[1].textContent?.match(/Exception rate/g)).toHaveLength(1);
    },
  );

  it("retains both minimal outcomes without rendering their accessible assessment or references", () => {
    render(<EventMetrics metrics={metrics} variant="minimal" />);

    const list = screen.getByRole("list", { name: "Event metrics" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Dwell time 6 h")).toBeVisible();
    expect(screen.getByText("Exception rate 2%")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  it.each(["compact", "expanded"] as const)(
    "places each supplied reference with its own %s metric and shows each headline once",
    (variant) => {
      render(<EventMetrics metrics={metrics} variant={variant} />);

      const entries = screen.getAllByRole("listitem");
      expect(
        within(entries[0]).getByRole("img", { name: "Dwell distribution" }),
      ).toBeVisible();
      expect(
        within(entries[1]).getByRole("img", { name: "Exception distribution" }),
      ).toBeVisible();
      expect(
        within(entries[0]).queryByRole("img", {
          name: "Exception distribution",
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.getAllByText("Dwell time 6 h", { exact: true }),
      ).toHaveLength(1);
      expect(
        screen.getAllByText("Exception rate 2%", { exact: true }),
      ).toHaveLength(1);
    },
  );

  it.each(["minimal", "compact", "expanded"] as const)(
    "suppresses stale values, assessments, and references during unavailable or loading %s states",
    (variant) => {
      const { rerender } = render(
        <EventMetrics metrics={[metrics[0]]} variant={variant} />,
      );
      const state = (overrides: Partial<EventMetric>) => (
        <EventMetrics
          metrics={[{ ...metrics[0], ...overrides }]}
          variant={variant}
        />
      );

      rerender(state({ availability: "unavailable" }));
      const unavailable = screen.getByRole("group", {
        name: "Dwell time: Unavailable",
      });
      expect(unavailable).toHaveAttribute("data-assessment", "unavailable");
      expect(unavailable).toHaveTextContent(/^Dwell time Unavailable$/);
      expect(unavailable).not.toHaveTextContent("6 h");
      expect(
        screen.queryByRole("img", { name: "Dwell distribution" }),
      ).not.toBeInTheDocument();

      rerender(state({ availability: "unavailable", isLoading: true }));
      const loading = screen.getByRole("group", {
        name: "Dwell time: Assessing…",
      });
      expect(loading).toHaveAttribute("data-assessment", "loading");
      expect(loading).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("status")).toHaveTextContent(
        /^Dwell time Assessing…$/,
      );
      expect(loading).not.toHaveTextContent("6 h");
      expect(screen.queryByText(/Unavailable/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("img", { name: "Dwell distribution" }),
      ).not.toBeInTheDocument();

      rerender(state({}));
      expect(
        screen.getByRole("group", {
          name: "Dwell time: 6 h; Within expected dwell",
        }),
      ).toHaveAttribute("data-assessment", "healthy");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      if (variant !== "minimal")
        expect(
          screen.getByRole("img", { name: "Dwell distribution" }),
        ).toBeVisible();
    },
  );

  it("retains an observed value without assuming health when no assessment was supplied", () => {
    render(
      <EventMetrics
        metrics={[
          {
            id: "dwell",
            label: "Dwell time",
            valueLabel: "6 h",
            assessment: null,
          },
        ]}
      />,
    );
    const value = screen.getByRole("group", {
      name: "Dwell time: 6 h; Not assessed",
    });
    expect(value).toHaveAttribute("data-assessment", "unassessed");
    expect(value).toHaveTextContent(/^Dwell time 6 h$/);
  });

  it.each([null, "", "   "])(
    "does not show a healthy assessment or a reference for missing value %s",
    (valueLabel) => {
      render(<EventMetrics metrics={[{ ...metrics[0], valueLabel }]} />);
      expect(
        screen.getByRole("group", { name: "Dwell time: Unavailable" }),
      ).toHaveAttribute("data-assessment", "unavailable");
      expect(
        screen.queryByRole("group", { name: /Within expected dwell/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("img", { name: "Dwell distribution" }),
      ).not.toBeInTheDocument();
    },
  );

  it("uses caller-supplied data-state labels and leaves an empty metric set absent", () => {
    const { rerender } = render(
      <EventMetrics
        metrics={[
          {
            ...metrics[0],
            availability: "unavailable",
            unavailableLabel: "No observation",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Dwell time: No observation" }),
    ).toHaveTextContent(/^Dwell time No observation$/);
    rerender(<EventMetrics metrics={[]} />);
    expect(
      screen.queryByRole("list", { name: "Event metrics" }),
    ).not.toBeInTheDocument();
  });
});
