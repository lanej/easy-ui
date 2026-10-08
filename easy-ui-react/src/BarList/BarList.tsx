import React from "react";
import {
  observationLabel,
  observationState,
  plottedObservation,
  type OverflowPolicy,
} from "../visualization/valueState";
import {
  visualizationTypographyStyle,
  type VisualizationTypography,
} from "../visualization/typography";
import styles from "./BarList.module.scss";

/** One category in a compact comparison. */
export type BarListItem = {
  /** Stable application identifier used as the row key. */
  id: string;
  /** Visible category name. */
  label: string;
  /** Finite, non-negative magnitude. null means unavailable. */
  value: number | null;
};

/** Ordered categories compared on one zero-based scale. */
export type BarListProps = {
  /** Name of the comparison, including period and units where relevant. */
  label: string;
  /** Display order is preserved; applications own ranking and aggregation. */
  data: readonly BarListItem[];
  /** Formats valid magnitudes, including units; defaults to String. */
  formatValue?: (value: number) => string;
  /** Shared positive, finite upper bound. Omit to scale each list to its own largest magnitude. */
  max?: number;
  /** Out-of-scale marks are omitted by default; clamp explicitly draws them at the boundary. */
  overflow?: OverflowPolicy;
  /** Label for invalid values; defaults to "Invalid value". */
  invalidValueLabel?: string;
  /** Label accompanying values above max; defaults to "Outside scale". */
  outOfDomainLabel?: string;
  /** Label for an invalid supplied max; defaults to "Invalid scale". */
  invalidScaleLabel?: string;
  /** Text sizes in CSS pixels, independently configurable by role. */
  typography?: VisualizationTypography;
  /** Text for an empty list or unavailable value; defaults to "No data". */
  emptyLabel?: string;
};

/** A compact, zero-based comparison with exact values in a semantic list. */
export function BarList({
  label,
  data,
  formatValue = String,
  max,
  overflow = "omit",
  invalidValueLabel = "Invalid value",
  outOfDomainLabel = "Outside scale",
  invalidScaleLabel = "Invalid scale",
  typography,
  emptyLabel = "No data",
}: BarListProps) {
  let maximum = 0;
  for (const { value } of data) {
    if (isMagnitude(value)) maximum = Math.max(maximum, value);
  }
  const automaticMax = maximum || 1;
  const upper = max ?? automaticMax;
  const validScale = Number.isFinite(upper) && upper > 0;
  const domain = [0, upper] as const;
  const labels = {
    missing: emptyLabel,
    invalid: invalidValueLabel,
    outside: outOfDomainLabel,
  };
  return (
    <div
      className={styles.root}
      style={visualizationTypographyStyle(typography)}
    >
      {!validScale && <p>{invalidScaleLabel}</p>}
      {data.length ? (
        <ul role="list" className={styles.list} aria-label={label}>
          {data.map(({ id, label: itemLabel, value }) => {
            const state = observationState(
              value,
              validScale ? domain : undefined,
              0,
            );
            const mark = validScale
              ? plottedObservation(value, state, domain, overflow)
              : null;
            return (
              <li key={id} className={styles.item}>
                <div className={styles.labels}>
                  <span>{itemLabel}</span>
                  <span className={styles.value} data-value-state={state}>
                    {observationLabel(value, state, formatValue, labels)}
                  </span>
                </div>
                <div className={styles.track} aria-hidden="true">
                  {mark !== null && (
                    <div
                      className={styles.bar}
                      data-overflow={state === "out-of-domain"}
                      style={{
                        width: `${(mark / upper) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p aria-label={label}>{emptyLabel}</p>
      )}
    </div>
  );
}

function isMagnitude(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}
