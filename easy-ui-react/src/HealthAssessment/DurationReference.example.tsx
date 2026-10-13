import React from "react";
import {
  DurationDistribution,
  DurationQuantileMetrics,
  type DurationHealthRegion,
  type DurationDistributionProps,
} from "../DurationDistribution";
import {
  bins,
  cumulative,
  landmarks,
} from "../DurationDistribution/DurationDistribution.fixtures";
export type { DurationHealthRegion } from "../DurationDistribution";
export type ReferenceVisualization =
  "cumulative" | "histogram" | "both" | "none";
const quantiles = landmarks.map(({ label, value }) => ({
  label,
  value,
  fraction: label === "P50" ? 0.5 : 0.9,
}));
/** Synthetic story fixture; production rendering lives in DurationDistribution. */
export function DurationReferenceExample({
  value,
  locale = "en",
  regions = [],
  currentAssessment,
  section = "all",
  visualization = "cumulative",
  showDistribution = true,
  showHealthBands = true,
  showHealthBandLabels = false,
  showPercentiles = true,
  showPercentileLabels = false,
  showCountAxis = false,
  showSampleCount = false,
}: {
  value: number | null;
  locale?: "en" | "fr";
  regions?: readonly DurationHealthRegion[];
  currentAssessment?: DurationDistributionProps["currentAssessment"];
  section?: "all" | "primary" | "details";
  visualization?: ReferenceVisualization;
  showDistribution?: boolean;
  showHealthBands?: boolean;
  showHealthBandLabels?: boolean;
  showPercentiles?: boolean;
  showPercentileLabels?: boolean;
  showCountAxis?: boolean;
  showSampleCount?: boolean;
}) {
  if (visualization === "none" || section === "details") return null;
  const format = (n: number) => new Intl.NumberFormat(locale).format(n);
  const french = locale === "fr";
  return (
    <DurationDistribution
      value={value}
      unit="h"
      domain={[0, 30]}
      quantiles={quantiles}
      bins={bins}
      cumulative={cumulative.map(({ duration, fraction }) => ({
        value: duration,
        fraction,
      }))}
      healthRegions={regions}
      currentAssessment={currentAssessment}
      visualization={
        visualization === "cumulative" && showDistribution
          ? "both"
          : visualization
      }
      showHealthBands={showHealthBands}
      showHealthBandLabels={showHealthBandLabels}
      showPercentiles={showPercentiles}
      showPercentileLabels={showPercentileLabels}
      showCountAxis={showCountAxis}
      stretch={section !== "all"}
      formatValue={format}
      formatCount={format}
      sampleCount={1000}
      label={
        french
          ? "Référence des durées terminées"
          : "Completed-duration reference"
      }
      description={
        showSampleCount
          ? french
            ? "1 000 durées terminées fictives"
            : "1,000 synthetic completed durations"
          : undefined
      }
      labels={
        french
          ? {
              elapsed: "Écoulé",
              missingValue: "Durée indisponible",
              count: "Nombre",
              outsideScale: "Hors échelle",
              observations: "durées terminées",
              cumulative: "Pourcentage cumulé terminé",
            }
          : undefined
      }
    />
  );
}
export function DurationPercentileMetrics({
  locale = "en",
  regions = [],
}: {
  locale?: "en" | "fr";
  regions?: readonly DurationHealthRegion[];
}) {
  return (
    <DurationQuantileMetrics
      quantiles={quantiles}
      unit="h"
      healthRegions={regions}
      formatValue={(n) => new Intl.NumberFormat(locale).format(n)}
      accessibilityLabel={
        locale === "fr" ? "Percentiles de référence" : "Reference percentiles"
      }
    />
  );
}
