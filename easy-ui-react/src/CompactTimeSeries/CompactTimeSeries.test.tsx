import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { CompactTimeSeries } from "./CompactTimeSeries";

it("preserves elapsed spacing, gaps, exact zeros and shared scales without an engine", () => {
  const props = {
    label: "Volume",
    description: "Four timestamped observations",
    domain: [0, 10] as const,
    timeDomain: [0, 100] as const,
    formatTime: String,
    markers: "all" as const,
  };
  const { container, rerender } = render(
    <CompactTimeSeries
      {...props}
      series={[
        {
          id: "a",
          label: "A",
          points: [
            { time: 0, value: 0 },
            { time: 10, value: 5 },
            { time: 20, value: null },
            { time: 100, value: 10 },
          ],
        },
      ]}
    />,
  );
  const points = [...container.querySelectorAll("circle")]
    .map((point) => Number(point.getAttribute("cx")))
    .sort((a, b) => a - b);
  expect((points[1] - points[0]) / (points[2] - points[0])).toBeCloseTo(0.1);
  expect(container.querySelectorAll("path")).toHaveLength(1);
  expect(container.querySelector("tbody")).toHaveTextContent("A00");
  expect(container.querySelector("tbody")).toHaveTextContent("Unavailable");
  expect(screen.getByRole("img")).toHaveAccessibleName(props.description);
  rerender(
    <CompactTimeSeries
      {...props}
      domain={[0, 20]}
      timeDomain={[0, 3]}
      markers="extrema"
      series={[
        {
          id: "a",
          label: "A",
          points: [0, null, 10, 20].map((value, time) => ({ time, value })),
        },
      ]}
    />,
  );
  const extrema = [...container.querySelectorAll("circle")]
    .map((point) => Number(point.getAttribute("cx")))
    .sort((a, b) => a - b);
  expect(extrema).toEqual([points[0], points[2]]);
  rerender(<CompactTimeSeries {...props} series={[]} />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("No data")).toBeInTheDocument();
});

it("aligns singleton timestamps with centered observations, including multiple series", () => {
  const props = {
    label: "One time",
    description: "One shared timestamp",
    domain: [0, 10] as const,
    formatTime: String,
  };
  const { container, rerender } = render(
    <CompactTimeSeries
      {...props}
      series={[
        { id: "a", label: "A", points: [{ time: 25, value: 2 }] },
        { id: "b", label: "B", points: [{ time: 25, value: 8 }] },
      ]}
    />,
  );
  expect(container.querySelector("[data-chart-time-axis]")).toHaveAttribute(
    "data-single-tick",
    "true",
  );
  expect(
    container.querySelector("[data-chart-time-axis]")?.children,
  ).toHaveLength(1);
  expect(
    [...container.querySelectorAll("circle")].map((point) =>
      point.getAttribute("cx"),
    ),
  ).toEqual(["240", "240"]);
  rerender(
    <CompactTimeSeries
      {...props}
      timeDomain={[0, 100]}
      series={[{ id: "a", label: "A", points: [{ time: 25, value: 2 }] }]}
    />,
  );
  expect(container.querySelector("[data-chart-time-axis]")).toHaveAttribute(
    "data-single-tick",
    "false",
  );
  expect(
    container.querySelector("[data-chart-time-axis]")?.children,
  ).toHaveLength(2);
  expect(container.querySelector("circle")).toHaveAttribute("cx", "123");
});

it("abbreviates axes independently while retaining timestamps, units and precision in exact data", () => {
  const time = Date.UTC(2026, 8, 20, 9);
  const { container } = render(
    <CompactTimeSeries
      label="Precise data"
      description="USD, UTC"
      domain={[0, 2000]}
      series={[{ id: "a", label: "A", points: [{ time, value: 1234.56 }] }]}
      formatTime={(value) => new Date(value).toISOString()}
      formatValue={(value) => `$${value.toFixed(2)}`}
      formatAxisTime={() => "Sep 20"}
      formatAxisValue={(value) => `${value / 1000}k`}
      reference={{ value: 1500.55, label: "Budget" }}
      typography={{ label: 16, detail: 15 }}
    />,
  );
  expect(container.querySelector("[data-chart-time-axis]")).toHaveTextContent(
    "Sep 20",
  );
  expect(container.querySelector("[data-chart-value-axis]")).toHaveTextContent(
    "1k",
  );
  expect(container.querySelector("tbody")).toHaveTextContent(
    "2026-09-20T09:00:00.000Z",
  );
  expect(container.querySelector("tbody")).toHaveTextContent("$1234.56");
  expect(screen.getByText("Budget: $1500.55")).toBeInTheDocument();
  expect(
    container
      .querySelector("figure")
      ?.style.getPropertyValue("--ezui-viz-label-size"),
  ).toBe("16px");
});
