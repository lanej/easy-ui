import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import {
  MetricCard,
  MetricContent,
  MetricComparisonContent,
  MetricGroup,
} from "./MetricCard";

it("defaults to a summary without adding a frame or landmark", () => {
  const { container } = render(<MetricContent label="Cost" value="$5.20" />);
  expect(container.querySelector("[data-metric-content]")).toHaveAttribute(
    "data-layout",
    "summary",
  );
  expect(container.querySelector("[data-metric-value]")).toHaveStyle({
    fontSize: "24px",
  });
  expect(screen.queryByRole("region")).toBeNull();
});

it.each(["summary", "row"] as const)(
  "keeps %s layout independent of typography",
  (layout) => {
    const { container, rerender } = render(
      <MetricCard label="Cost" value="$5.20" layout={layout} size="lg" />,
    );
    expect(container.querySelector("[data-metric-content]")).toHaveAttribute(
      "data-layout",
      layout,
    );
    expect(container.querySelector("[data-metric-value]")).toHaveStyle({
      fontSize: "28px",
    });
    rerender(
      <MetricCard
        label="Cost"
        value="$5.20"
        layout={layout}
        size="lg"
        valueSize={16}
      />,
    );
    expect(container.querySelector("[data-metric-value]")).toHaveStyle({
      fontSize: "16px",
    });
  },
);

it.each([0, -1, NaN, Infinity, -Infinity])(
  "uses the selected preset for invalid valueSize %s",
  (valueSize) => {
    const { container } = render(
      <MetricContent
        label="Cost"
        value="$5.20"
        size="sm"
        valueSize={valueSize}
      />,
    );
    expect(container.querySelector("[data-metric-value]")).toHaveStyle({
      fontSize: "20px",
    });
  },
);

it("inherits group defaults and preserves explicit child overrides", () => {
  const { container } = render(
    <MetricGroup layout="row" size="sm">
      <MetricContent label="Cost" value="$5.20" />
      <MetricContent label="Transit" value="2.4" unit="days" size="lg" />
    </MetricGroup>,
  );
  const metrics = container.querySelectorAll("[data-metric-content]");
  expect(metrics[0]).toHaveAttribute("data-layout", "row");
  expect(metrics[1]).toHaveAttribute("data-layout", "row");
  expect(metrics[0].querySelector("[data-metric-value]")).toHaveStyle({
    fontSize: "20px",
  });
  expect(metrics[1].querySelector("[data-metric-value]")).toHaveStyle({
    fontSize: "28px",
  });
  expect(screen.queryByRole("region")).toBeNull();
});

it("does not infer direction or sentiment from formatted values", () => {
  const { container } = render(
    <MetricContent
      label="Volume"
      value="24,810"
      comparison={{ label: "8.3%", direction: "increase", baseline: "vs May" }}
    />,
  );
  expect(
    screen.getByRole("group", { name: "Increased by 8.3%" }),
  ).toHaveAttribute("data-sentiment", "neutral");
  expect(screen.getByRole("group")).toHaveAccessibleDescription("vs May");
  expect(container.querySelector("[data-metric-pill]")).toHaveTextContent(
    "↑8.3%",
  );
});

it("supports favorable decreases and localized accessible descriptions", () => {
  render(
    <MetricContent
      label="Cost"
      value="$5.20"
      comparison={{
        label: "4.2%",
        direction: "decrease",
        sentiment: "positive",
        baseline: "vs mayo",
        accessibilityLabel: "Disminuyó un 4.2 por ciento",
      }}
    />,
  );
  expect(
    screen.getByRole("group", { name: "Disminuyó un 4.2 por ciento" }),
  ).toHaveAttribute("data-direction", "decrease");
  expect(screen.getByRole("group")).toHaveAttribute(
    "data-sentiment",
    "positive",
  );
});

it("retains text-only comparisons and displays explicit unchanged comparisons", () => {
  const { rerender } = render(
    <MetricComparisonContent label="4.2% lower" baseline="vs May" />,
  );
  expect(screen.getByRole("group", { name: "4.2% lower" })).not.toHaveAttribute(
    "data-direction",
  );
  rerender(
    <MetricComparisonContent
      label="0 days"
      direction="unchanged"
      baseline="vs May"
    />,
  );
  expect(
    screen.getByRole("group", { name: "Unchanged 0 days" }),
  ).toHaveTextContent("=0 days");
});

it("references shared visible context without repeating it", () => {
  render(
    <section>
      <p id="period">June 1–30 · vs previous 30 days</p>
      <MetricGroup>
        <MetricContent
          label="Cost"
          value="$5.20"
          comparison={{
            label: "4.2%",
            direction: "decrease",
            baselineId: "period",
            sentiment: "positive",
          }}
        />
        <MetricContent
          label="Volume"
          value="24,810"
          comparison={{
            label: "8.3%",
            direction: "increase",
            baselineId: "period",
          }}
        />
      </MetricGroup>
    </section>,
  );
  expect(screen.getAllByText("June 1–30 · vs previous 30 days")).toHaveLength(
    1,
  );
  for (const comparison of screen.getAllByRole("group"))
    expect(comparison).toHaveAccessibleDescription(
      "June 1–30 · vs previous 30 days",
    );
});

it("keeps local baselines unique", () => {
  render(
    <>
      <MetricComparisonContent label="4.2% lower" baseline="vs May" />
      <MetricComparisonContent label="8.3% higher" baseline="vs last week" />
    </>,
  );
  const first = screen.getByRole("group", { name: "4.2% lower" });
  const second = screen.getByRole("group", { name: "8.3% higher" });
  expect(first).toHaveAccessibleDescription("vs May");
  expect(second).toHaveAccessibleDescription("vs last week");
  expect(first.getAttribute("aria-describedby")).not.toBe(
    second.getAttribute("aria-describedby"),
  );
});

it.each(["summary", "row"] as const)(
  "keeps units and pills with the reading in %s",
  (layout) => {
    const props = {
      label: "Transit",
      value: "2.4",
      unit: "days",
      supportingText: "Delivered parcels only",
      comparison: {
        label: "0.2 days",
        baseline: "vs May",
        direction: "decrease" as const,
      },
    };
    const { container, rerender } = render(
      <MetricContent {...props} layout={layout} />,
    );
    const pair = container.querySelector("[data-metric-value-group]");
    expect(pair?.children[0]).toHaveAttribute("data-metric-value");
    expect(pair?.children[1]).toHaveAttribute("data-metric-comparison");
    expect(pair).toHaveTextContent("2.4 days");
    expect(pair).not.toHaveTextContent("vs May");
    expect(
      container.querySelector("[data-metric-number]"),
    ).not.toHaveTextContent("days");
    expect(screen.getByRole("group")).toHaveAccessibleDescription("vs May");
    rerender(<MetricContent {...props} layout={layout} value={null} />);
    expect(container.querySelector("[data-metric-unit]")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByText("vs May")).toBeNull();
    expect(screen.getByText("No data")).toBeInTheDocument();
    rerender(<MetricContent {...props} layout={layout} isLoading />);
    expect(container.querySelector("[data-metric-unit]")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    rerender(<MetricContent {...props} layout={layout} value="0" />);
    expect(container.querySelector("[data-metric-value]")).toHaveTextContent(
      "0 days",
    );
  },
);
