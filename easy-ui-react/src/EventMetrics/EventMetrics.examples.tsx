import React from "react";
import { DurationDistribution } from "../DurationDistribution";
import type { EventMetric } from "./EventMetrics";

type ExampleMetricVariant = "minimal" | "compact" | "expanded";

/** Synthetic references for component examples, never measured carrier performance. */
const dwellBins = [
  8, 16, 22, 33, 43, 58, 72, 84, 96, 90, 81, 67, 54, 44, 34, 26, 20, 15, 11, 9,
  8, 7, 6, 5,
].map((count, index) => ({ from: index, to: index + 1, count }));

/** Each observation is a facility window's exception rate, expressed in percent. */
const exceptionBins = [
  34, 50, 74, 89, 97, 99, 94, 85, 72, 59, 48, 37, 28, 21, 17, 14, 11, 9, 7, 5,
  4, 4, 3, 3,
].map((count, index) => ({
  from: (index * 5) / 24,
  to: ((index + 1) * 5) / 24,
  count,
}));

/** The application supplies each metric's independent value, policy and reference. */
export function createExampleEventMetrics(
  variant: ExampleMetricVariant = "compact",
): EventMetric[] {
  const compact = variant === "compact";
  return [
    {
      id: "dwell",
      label: "Dwell time",
      valueLabel: "6 h",
      assessment: "healthy",
      assessmentLabel: "Within expectations",
      reference:
        variant === "minimal" ? undefined : (
          <DurationDistribution
            value={6}
            unit="h"
            domain={[0, 24]}
            bins={dwellBins}
            healthRegions={[
              {
                from: 0,
                to: 10,
                assessment: "healthy",
                label: "Within expectations",
              },
              {
                from: 10,
                to: 20,
                assessment: "degraded",
                label: "Elevated dwell",
              },
              {
                from: 20,
                to: Infinity,
                assessment: "unhealthy",
                label: "High dwell",
              },
            ]}
            currentAssessment="healthy"
            visualization="histogram"
            distributionStyle={compact ? "smooth" : "binned"}
            distributionPresentation={compact ? "concentration" : "plot"}
            healthRegionHighlight="current"
            showPercentiles={false}
            showHealthBands={false}
            showScale={!compact}
            stretch={false}
            label="Completed dwell-time distribution"
            labels={{
              elapsed: "Dwell time",
              healthy: "Within expectations",
            }}
          />
        ),
    },
    {
      id: "exception",
      label: "Exception rate",
      valueLabel: "2%",
      assessment: "degraded",
      assessmentLabel: "Elevated exception rate",
      reference:
        variant === "minimal" ? undefined : (
          <DurationDistribution
            value={2}
            unit="%"
            domain={[0, 5]}
            bins={exceptionBins}
            healthRegions={[
              {
                from: 0,
                to: 1.5,
                assessment: "healthy",
                label: "Within expectations",
              },
              {
                from: 1.5,
                to: 3,
                assessment: "degraded",
                label: "Elevated exception rate",
              },
              {
                from: 3,
                to: Infinity,
                assessment: "unhealthy",
                label: "High exception rate",
              },
            ]}
            currentAssessment="degraded"
            visualization="histogram"
            distributionStyle={compact ? "smooth" : "binned"}
            distributionPresentation={compact ? "concentration" : "plot"}
            healthRegionHighlight="current"
            showPercentiles={false}
            showHealthBands={false}
            showScale={!compact}
            stretch={false}
            label="Exception-rate distribution across comparable facility windows"
            labels={{
              elapsed: "Exception rate",
              missingValue: "Exception rate unavailable",
              invalidValue: "Invalid exception rate",
              invalidScale: "Invalid rate scale",
              emptyDistribution: "No comparable facility windows",
              observations: "comparable facility windows",
              healthy: "Within expectations",
              degraded: "Elevated",
              unhealthy: "High",
            }}
          />
        ),
    },
  ];
}
