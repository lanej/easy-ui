import React from "react";
import {
  regionAt,
  validQuantiles,
  validHealthRegions,
  type DurationQuantile,
  type DurationHealthRegion,
} from "./model";
import styles from "./DurationDistribution.module.scss";

export type DurationQuantileMetricsProps = {
  quantiles: readonly DurationQuantile[];
  unit: string;
  /** Inline places comparisons in one wrapping row above a reference graphic. */
  layout?: "stacked" | "inline";
  healthRegions?: readonly DurationHealthRegion[];
  formatValue?: (value: number) => string;
  formatQuantileLabel?: (fraction: number) => string;
  accessibilityLabel?: string;
  invalidQuantilesLabel?: string;
  invalidHealthRegionsLabel?: string;
};
/** Exact supplied quantiles, usable independently or in HealthAssessment.observationDetails. */
export function DurationQuantileMetrics({
  quantiles,
  unit,
  layout = "stacked",
  healthRegions = [],
  formatValue = String,
  formatQuantileLabel = (fraction) => `P${fraction * 100}`,
  accessibilityLabel = "Reference percentiles",
  invalidQuantilesLabel = "Invalid quantiles",
  invalidHealthRegionsLabel = "Invalid health ranges",
}: DurationQuantileMetricsProps) {
  if (!validQuantiles(quantiles)) return <p>{invalidQuantilesLabel}</p>;
  const regionsValid = validHealthRegions(healthRegions);
  const regions = regionsValid ? healthRegions : [];
  return (
    <>
      {!regionsValid && <p>{invalidHealthRegionsLabel}</p>}
      <dl
        className={styles.metrics}
        data-layout={layout}
        aria-label={accessibilityLabel}
      >
        {quantiles.map((q) => {
          const region = regionAt(regions, q.value);
          const label = q.label ?? formatQuantileLabel(q.fraction);
          return (
            <div
              key={q.fraction}
              data-percentile={label}
              data-reference-assessment={region?.assessment ?? "unassessed"}
              title={region?.label}
            >
              <dt>
                <span className={styles.legendDot} aria-hidden="true" />
                {label}
              </dt>
              <dd>
                {formatValue(q.value)} <span>{unit}</span>
                {region && (
                  <span className={styles.srOnly}> · {region.label}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </>
  );
}
