import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { render } from "../utilities/test";
import {
  DurationDistribution,
  type DurationDistributionProps,
} from "./DurationDistribution";
import { DurationQuantileMetrics } from "./DurationQuantileMetrics";
import {
  cumulativeFractionAt,
  clippedCumulative,
  type DurationHealthRegion,
} from "./model";

import {
  histogramDensity,
  densityGroups,
  densityAt,
  densityCurve,
} from "./densityGeometry";

const quantiles = [
  { fraction: 0.5, value: 9 },
  { fraction: 0.9, value: 18 },
];
const cumulative = [
  { value: 0, fraction: 0 },
  { value: 9, fraction: 0.5 },
  { value: 18, fraction: 0.9 },
  { value: 30, fraction: 1 },
];
const regions: DurationHealthRegion[] = [
  { from: 0, to: 10, assessment: "healthy", label: "Expected" },
  { from: 10, to: 20, assessment: "degraded", label: "Attention" },
  { from: 20, to: Infinity, assessment: "unhealthy", label: "Outside" },
];
const defaults: DurationDistributionProps = {
  value: 6,
  domain: [0, 30],
  unit: "hours",
  quantiles,
};

describe("DurationDistribution", () => {
  it("does not fabricate a curve, histogram, or sample count from quantiles", () => {
    const { container } = render(<DurationDistribution {...defaults} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll("[data-percentile]")).toHaveLength(2);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("P50: 9 hours"),
    );
    expect(screen.getByRole("img")).not.toHaveAccessibleName(
      expect.stringContaining("completed observations"),
    );
  });
  it.each(
    [
      [
        { fraction: 0.9, value: 18 },
        { fraction: 0.5, value: 9 },
      ],
      [
        { fraction: 0.5, value: 18 },
        { fraction: 0.9, value: 9 },
      ],
      [
        { fraction: 0.5, value: 9 },
        { fraction: 0.5, value: 10 },
      ],
      [{ fraction: 1.1, value: 9 }],
      [{ fraction: 0.5, value: NaN }],
    ].map((points) => [points]),
  )(
    "rejects unordered, duplicate, or invalid quantiles without discarding a valid supplied curve",
    (points) => {
      const { container } = render(
        <DurationDistribution
          {...defaults}
          quantiles={points}
          cumulative={cumulative}
        />,
      );
      expect(screen.getByText("Invalid quantiles")).toBeVisible();
      expect(container.querySelector("[data-percentile]")).toBeNull();
      expect(container.querySelector("path")).not.toBeNull();
    },
  );
  it("allows tied quantile durations and assigns health by half-open policy boundaries", () => {
    const points = [
      { fraction: 0.5, value: 10 },
      { fraction: 0.9, value: 10 },
    ];
    const { container } = render(
      <DurationDistribution
        {...defaults}
        quantiles={points}
        healthRegions={regions}
        showHealthBands={false}
      />,
    );
    expect(
      container.querySelectorAll('[data-reference-assessment="degraded"]'),
    ).toHaveLength(2);
    expect(container.querySelector("[data-assessment]")).toBeNull();
    expect(screen.queryByText("Invalid quantiles")).not.toBeInTheDocument();
  });
  it("uses an independent supplied current assessment and preserves neutral historical landmarks without policy", () => {
    const { container } = render(
      <DurationDistribution {...defaults} currentAssessment="unhealthy" />,
    );
    expect(
      container.querySelector('[data-current-assessment="unhealthy"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll('[data-reference-assessment="unassessed"]'),
    ).toHaveLength(2);
  });
  it("exposes the independently supplied current assessment in localized accessible and exact text", () => {
    render(
      <DurationDistribution
        {...defaults}
        currentAssessment="unhealthy"
        healthRegions={regions}
        showDataTable
        labels={{
          currentAssessment: "Évaluation actuelle",
          unhealthy: "Critique",
        }}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("Évaluation actuelle: Critique"),
    );
    expect(screen.getByText("Évaluation actuelle")).toBeInTheDocument();
    expect(screen.getByText("Critique")).toBeInTheDocument();
  });
  it.each([null, NaN, -1])(
    "does not announce a stale current assessment for unavailable or invalid elapsed values",
    (value) => {
      render(
        <DurationDistribution
          {...defaults}
          value={value}
          currentAssessment="healthy"
        />,
      );
      expect(screen.getByRole("img")).not.toHaveAccessibleName(
        expect.stringContaining("Current assessment: Healthy"),
      );
    },
  );
  it("labels both ends of gapped policy ranges and deduplicates adjoining boundaries", () => {
    const { container } = render(
      <DurationDistribution
        {...defaults}
        healthRegions={[
          { from: 0, to: 10, assessment: "healthy", label: "Expected" },
          { from: 15, to: 20, assessment: "degraded", label: "Attention" },
          { from: 20, to: Infinity, assessment: "unhealthy", label: "Outside" },
        ]}
      />,
    );
    const ticks = container.querySelectorAll('[class*="thresholdLabel_"]');
    expect(Array.from(ticks, (tick) => tick.textContent)).toEqual([
      "10 hours",
      "15 hours",
      "20 hours",
    ]);
  });
  it("splits supplied bins at exact policy thresholds without fabricating count geometry from quantiles", () => {
    const { container } = render(
      <DurationDistribution
        {...defaults}
        healthRegions={regions}
        bins={[{ from: 9, to: 12, count: 7 }]}
      />,
    );
    const rectangles = container.querySelectorAll("rect");
    expect(rectangles).toHaveLength(2);
    expect(rectangles[0]).toHaveAttribute("data-segment-to", "10");
    expect(rectangles[1]).toHaveAttribute("data-segment-from", "10");
    expect(rectangles[0]).toHaveAttribute(
      "data-reference-assessment",
      "healthy",
    );
    expect(rectangles[1]).toHaveAttribute(
      "data-reference-assessment",
      "degraded",
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("9–12 hours: 7"),
    );
  });
  it.each(
    [
      [
        { from: 0, to: 4, count: 3 },
        { from: 3, to: 5, count: 2 },
      ],
      [{ from: 4, to: 2, count: 3 }],
      [{ from: 0, to: 4, count: -1 }],
      [{ from: 0, to: 4, count: 1.5 }],
    ].map((bins) => [bins]),
  )("rejects overlapping or invalid histogram bins", (bins) => {
    const { container } = render(
      <DurationDistribution {...defaults} bins={bins} />,
    );
    expect(screen.getByText("Invalid histogram")).toBeVisible();
    expect(container.querySelector("rect")).toBeNull();
  });
  it("keeps gaps in the histogram and represents an explicitly empty sample without division by zero", () => {
    const { container } = render(
      <DurationDistribution
        {...defaults}
        bins={[
          { from: 0, to: 3, count: 0 },
          { from: 9, to: 12, count: 0 },
        ]}
        sampleCount={0}
        showSampleCount
        showCountAxis
      />,
    );
    expect(screen.getByText("No completed observations")).toBeVisible();
    expect(screen.getByText("0 completed observations")).toBeVisible();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.innerHTML).not.toContain("NaN");
  });
  it.each(
    [
      [
        { value: 9, fraction: 0.5 },
        { value: 6, fraction: 0.8 },
      ],
      [
        { value: 9, fraction: 0.5 },
        { value: 12, fraction: 0.4 },
      ],
      [{ value: 9, fraction: 2 }],
      [{ value: 9, fraction: 0.5 }],
    ].map((points) => [points]),
  )("rejects malformed cumulative inputs", (points) => {
    const { container } = render(
      <DurationDistribution {...defaults} cumulative={points} />,
    );
    expect(screen.getByText("Invalid cumulative reference")).toBeVisible();
    expect(container.querySelector("path")).toBeNull();
  });
  it("retains exact outside values while omitting marks unless clamping is requested", () => {
    const props = {
      ...defaults,
      value: 42.125,
      quantiles: [{ fraction: 0.9, value: 35.75 }],
    };
    const { container, rerender } = render(<DurationDistribution {...props} />);
    expect(
      screen.getByText("Elapsed: 42.125 hours · Outside scale"),
    ).toBeVisible();
    expect(screen.getByText("P90: 35.75 hours · Outside scale")).toBeVisible();
    expect(container.querySelector("[data-current-assessment]")).toBeNull();
    expect(container.querySelector("[data-percentile]")).toBeNull();
    rerender(<DurationDistribution {...props} overflow="clamp" />);
    expect(container.querySelector("[data-current-assessment]")).toHaveStyle({
      left: "100%",
    });
    expect(container.querySelector("[data-percentile]")).toHaveAttribute(
      "data-overflow",
      "true",
    );
  });
  it.each([null, NaN, -1])(
    "makes missing and invalid elapsed values explicit without suppressing valid reference data",
    (value) => {
      const { container } = render(
        <DurationDistribution
          {...defaults}
          value={value}
          cumulative={cumulative}
        />,
      );
      expect(container.querySelector("[data-current-assessment]")).toBeNull();
      expect(container.querySelector("path")).not.toBeNull();
      expect(
        screen.getByText(
          value === null
            ? "Elapsed: Elapsed unavailable"
            : value === -1
              ? "Elapsed: -1 hours · Invalid elapsed duration"
              : "Elapsed: Invalid elapsed duration",
        ),
      ).toBeVisible();
    },
  );
  it("makes missing references and invalid domains explicit", () => {
    const { container, rerender } = render(
      <DurationDistribution {...defaults} quantiles={null} />,
    );
    expect(screen.getByText("Reference unavailable")).toBeVisible();
    rerender(<DurationDistribution {...defaults} domain={[30, 0]} />);
    expect(screen.getByText("Invalid duration scale")).toBeVisible();
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
  it("reports an invalid scale without sending invalid bounds to the value formatter", () => {
    const formatValue = (n: number) => {
      if (!Number.isFinite(n)) throw Error("Invalid formatter input");
      return String(n);
    };
    render(
      <DurationDistribution
        {...defaults}
        domain={[NaN, 30]}
        formatValue={formatValue}
      />,
    );
    expect(screen.getByText("Invalid duration scale")).toBeVisible();
  });
  it("draws the elapsed line without inventing a CDF value outside the supplied coverage", () => {
    const { container } = render(
      <DurationDistribution
        {...defaults}
        value={2}
        cumulative={[
          { value: 5, fraction: 0.25 },
          { value: 15, fraction: 0.75 },
        ]}
      />,
    );
    expect(container.querySelector("[data-current-assessment]")).not.toBeNull();
    expect(container.querySelector('[class*="marker_"]')).toBeNull();
  });

  it("rejects ambiguous health ranges and sample metadata without deriving health", () => {
    const { container } = render(
      <DurationDistribution
        {...defaults}
        healthRegions={[regions[0], { ...regions[1], from: 9 }]}
        sampleCount={-1}
        showSampleCount
      />,
    );
    expect(screen.getByText("Invalid health ranges")).toBeVisible();
    expect(screen.getByText("Invalid sample count")).toBeVisible();
    expect(
      container.querySelectorAll('[data-reference-assessment="unassessed"]'),
    ).toHaveLength(2);
    expect(container.querySelector("[data-assessment]")).toBeNull();
  });
  it("keeps exact units, localized labels, and optional source data independently available", () => {
    render(
      <DurationDistribution
        {...defaults}
        unit="min"
        value={6.125}
        label="Référence"
        cohort="Cohorte A"
        showDataTable
        sampleCount={20}
        labels={{ elapsed: "Écoulé", referenceValues: "Données" }}
      />,
    );
    expect(screen.getByText("Cohorte A")).toBeVisible();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("Écoulé: 6.125 min"),
    );
    expect(
      screen.queryByText("20 completed observations"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Données"));
    expect(screen.getByText("6.125 min")).toBeVisible();
  });
  it("suppresses previous values, reference, policy, and metadata while loading", () => {
    const { container } = render(
      <DurationDistribution
        {...defaults}
        cumulative={cumulative}
        cohort="Previous cohort"
        isLoading
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText("Previous cohort")).not.toBeInTheDocument();
    expect(container.querySelector("figure")).toBeNull();
  });
});

describe("Inline references", () => {
  it("hides the scale labels but preserves an accessible quantiles-only reference", () => {
    const { container } = render(
      <DurationDistribution
        value={6}
        unit="h"
        domain={[0, 30]}
        quantiles={[
          { fraction: 0.5, value: 9 },
          { fraction: 0.9, value: 18 },
        ]}
        visualization="points"
        showScale={false}
        stretch={false}
      />,
    );
    expect(container.querySelector('[class*="axisFrame_"]')).toBeNull();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("P90: 18 h"),
    );
  });

  it("renders a smooth density from supplied bins, not inferred percentile landmarks", () => {
    const { container } = render(
      <DurationDistribution
        value={6}
        unit="h"
        domain={[0, 30]}
        quantiles={[{ fraction: 0.5, value: 9 }]}
        bins={[
          { from: 0, to: 10, count: 8 },
          { from: 10, to: 20, count: 16 },
          { from: 20, to: 30, count: 4 },
        ]}
        visualization="histogram"
        distributionStyle="smooth"
        showScale={false}
      />,
    );
    expect(
      container.querySelector('[data-density-curve="true"]'),
    ).not.toBeNull();
    expect(container.querySelector('[class*="axisFrame_"]')).toBeNull();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("0–10 h: 8"),
    );
  });
});

describe("CDF projection", () => {
  it("does not extrapolate or synthesize boundary probabilities", () => {
    const points = [
      { value: 9, fraction: 0.5 },
      { value: 18, fraction: 0.9 },
    ];
    expect(cumulativeFractionAt(points, 6, "linear")).toBeNull();
    expect(clippedCumulative(points, [0, 30], "linear")).toEqual(points);
  });
  it("preserves supplied CDF jumps at both viewport boundaries", () => {
    const points = [
      { value: 0, fraction: 0 },
      { value: 0, fraction: 0.2 },
      { value: 30, fraction: 0.9 },
      { value: 30, fraction: 1 },
    ];
    expect(clippedCumulative(points, [0, 30], "step")).toEqual(points);
    expect(cumulativeFractionAt(points, 0, "step")).toBe(0.2);
    expect(cumulativeFractionAt(points, 30, "step")).toBe(1);
  });
  it("supports right-continuous steps and clips extreme finite values before SVG projection", () => {
    const points = [
      { value: 0, fraction: 0 },
      { value: 9, fraction: 0.3 },
      { value: 9, fraction: 0.5 },
      { value: 1e308, fraction: 1 },
    ];
    expect(cumulativeFractionAt(points, 9, "step")).toBe(0.5);
    expect(cumulativeFractionAt(points, 12, "step")).toBe(0.5);
    expect(cumulativeFractionAt(points, 8, "step")).toBe(0);
    const result = clippedCumulative(points, [0, 30], "linear");
    expect(
      result.every(
        (p) => Number.isFinite(p.value) && Number.isFinite(p.fraction),
      ),
    ).toBe(true);
    expect(result[result.length - 1].value).toBe(30);
  });
});

describe("DurationQuantileMetrics", () => {
  it("uses supplied values and policy independently from any graph", () => {
    const { container } = render(
      <DurationQuantileMetrics
        quantiles={quantiles}
        unit="hours"
        healthRegions={regions}
      />,
    );
    expect(container.querySelector('[data-percentile="P90"]')).toHaveAttribute(
      "data-reference-assessment",
      "degraded",
    );
    expect(screen.getByText("18")).toBeVisible();
  });
});

describe("Histogram density representations", () => {
  it("retains narrow concentration peaks between viewport sampling positions", () => {
    const { container } = render(
      <DurationDistribution
        {...defaults}
        domain={[0, 1000]}
        bins={[
          { from: 0, to: 500.99, count: 0 },
          { from: 500.99, to: 501, count: 0 },
          { from: 501, to: 501.01, count: 1 },
          { from: 501.01, to: 501.02, count: 0 },
          { from: 501.02, to: 1000, count: 0 },
        ]}
        distributionStyle="smooth"
        distributionPresentation="concentration"
      />,
    );
    const stops = Array.from(container.querySelectorAll("stop"));
    expect(
      stops.some((stop) => Number(stop.getAttribute("stop-opacity")) === 0.45),
    ).toBe(true);
    expect(
      stops.some(
        (stop) =>
          Math.abs(Number(stop.getAttribute("offset")) - 0.501005) < 1e-12,
      ),
    ).toBe(true);
  });

  const bins = [
    { from: 0, to: 10, count: 20 },
    { from: 10, to: 15, count: 20 },
    { from: 20, to: 30, count: 0 },
  ];
  it("normalizes concentration by interval width and preserves missing intervals", () => {
    const density = histogramDensity(bins);
    expect(density[0].level).toBeCloseTo(0.5);
    expect(density[1].level).toBe(1);
    expect(density[2].level).toBe(0);
    const groups = densityGroups(density);
    expect(groups).toHaveLength(2);
    expect(densityCurve(groups[0], [0, 30])?.to).toBe(15);
    expect(densityCurve(groups[1], [0, 30])?.from).toBe(20);
  });
  it("uses bounded cubic interpolation without inventing concentration outside coverage", () => {
    const group = densityGroups(histogramDensity(bins))[0];
    for (let value = 0; value <= 15; value += 0.1) {
      const density = densityAt(group, value, [0, 30]);
      expect(density.level).toBeGreaterThanOrEqual(0.5 - 1e-12);
      expect(density.level).toBeLessThanOrEqual(1);
    }
    const curve = densityCurve(group, [7, 30]);
    expect(curve?.from).toBe(7);
    expect(curve?.path).toContain(" C ");
    expect(curve?.path).not.toMatch(/NaN|Infinity/);
    expect(densityCurve(group, [20, 30])).toBeNull();
  });
  it("normalizes extreme finite widths without overflowing density", () => {
    const density = histogramDensity([
      { from: 0, to: 1e-300, count: 1e15 },
      { from: 1e-300, to: 1e308, count: 1 },
    ]);
    expect(density.every((b) => Number.isFinite(b.level))).toBe(true);
    expect(density[0].level).toBe(1);
    expect(densityCurve(density, [0, 30])?.path).not.toMatch(/NaN|Infinity/);
  });
  it.each(["binned", "smooth"] as const)(
    "renders a compact %s concentration bar with exact original counts",
    (distributionStyle) => {
      const { container } = render(
        <DurationDistribution
          {...defaults}
          bins={bins}
          distributionStyle={distributionStyle}
          distributionPresentation="concentration"
          showCountAxis
          showDataTable
        />,
      );
      expect(
        container.querySelector('[data-visualization="points"]'),
      ).not.toBeNull();
      expect(
        container.querySelector("[data-concentration-style]"),
      ).toHaveAttribute("data-concentration-style", distributionStyle);
      expect(container.querySelector('[class*="countAxis_"]')).toBeNull();
      expect(screen.getByRole("img")).toHaveAccessibleName(
        expect.stringContaining("0–10 hours: 20"),
      );
      expect(screen.getAllByText("20 completed observations")).toHaveLength(2);
    },
  );
  it("renders density independently of the cumulative curve and never infers it from quantiles", () => {
    const { container, rerender } = render(
      <DurationDistribution
        {...defaults}
        bins={bins}
        distributionStyle="smooth"
      />,
    );
    expect(container.querySelector("[data-density-curve]")).not.toBeNull();
    expect(container.querySelector('[class*="curve_"]')).toBeNull();
    rerender(
      <DurationDistribution
        {...defaults}
        distributionStyle="smooth"
        distributionPresentation="concentration"
      />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });
});
