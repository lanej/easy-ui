import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import {
  DurationReferenceExample,
  DurationPercentileMetrics,
  type DurationHealthRegion,
} from "./DurationReference.example";
const regions: DurationHealthRegion[] = [
  {
    from: 0,
    to: 10,
    assessment: "healthy",
    label: "As expected",
    shortLabel: "Expected",
  },
  {
    from: 10,
    to: 20,
    assessment: "degraded",
    label: "Needs attention",
    shortLabel: "Attention",
  },
  {
    from: 20,
    to: Infinity,
    assessment: "unhealthy",
    label: "Outside expectations",
    shortLabel: "Outside",
  },
];
describe("Story-only duration reference", () => {
  it("uses the supplied health policy for percentile points even when bands are hidden", () => {
    const { container } = render(
      <DurationReferenceExample
        value={6}
        regions={regions}
        showHealthBands={false}
      />,
    );
    expect(container.querySelector('[data-percentile="P50"]')).toHaveAttribute(
      "data-reference-assessment",
      "healthy",
    );
    expect(container.querySelector('[data-percentile="P90"]')).toHaveAttribute(
      "data-reference-assessment",
      "degraded",
    );
    expect(container.querySelector("[data-assessment]")).toBeNull();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("P90: 18 h · Needs attention"),
    );
  });
  it("honors half-open policy boundaries rather than assigning colors by percentile rank", () => {
    const differentPolicy: DurationHealthRegion[] = [
      { ...regions[0], to: 9 },
      { ...regions[1], from: 9, to: 18 },
      { ...regions[2], from: 18 },
    ];
    const { container } = render(
      <DurationPercentileMetrics regions={differentPolicy} />,
    );
    expect(container.querySelector('[data-percentile="P50"]')).toHaveAttribute(
      "data-reference-assessment",
      "degraded",
    );
    expect(container.querySelector('[data-percentile="P90"]')).toHaveAttribute(
      "data-reference-assessment",
      "unhealthy",
    );
  });
  it("splits crossing bars exactly at the supplied thresholds", () => {
    const { container } = render(
      <DurationReferenceExample value={6} regions={regions} />,
    );
    const bin = container.querySelector('[data-bin-from="9"]');
    const segments = bin?.querySelectorAll("rect");
    expect(segments).toHaveLength(2);
    expect(segments?.[0]).toHaveAttribute("data-segment-to", "10");
    expect(segments?.[0]).toHaveAttribute(
      "data-reference-assessment",
      "healthy",
    );
    expect(segments?.[1]).toHaveAttribute("data-segment-from", "10");
    expect(segments?.[1]).toHaveAttribute(
      "data-reference-assessment",
      "degraded",
    );
  });
  it("keeps landmarks neutral without a policy and omits histogram and sample metadata independently", () => {
    const { container } = render(
      <DurationReferenceExample value={6} showDistribution={false} />,
    );
    expect(container.querySelector('[data-percentile="P50"]')).toHaveAttribute(
      "data-reference-assessment",
      "unassessed",
    );
    expect(container.querySelector("[data-bin-from]")).toBeNull();
    expect(
      screen.queryByText("1,000 synthetic completed durations"),
    ).toBeNull();
  });
  it("supports optional count axis and metadata without a disclosure", () => {
    const { container } = render(
      <DurationReferenceExample
        value={6}
        showCountAxis
        showSampleCount
        showPercentiles={false}
      />,
    );
    expect(screen.getByText("Count")).toBeVisible();
    expect(
      screen.getByText("1,000 synthetic completed durations"),
    ).toBeVisible();
    expect(container.querySelector("[data-percentile]")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
  });
});
