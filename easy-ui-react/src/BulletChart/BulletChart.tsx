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
import styles from "./BulletChart.module.scss";

/** A measure, target, and shared zero-based scale with exact labels. */
export type BulletChartProps = {
  /** Visible metric name, also included in the plot's accessible description. */
  label: string;
  /** Finite, non-negative measure; null is unavailable. Values above max retain their exact label. */
  value: number | null;
  /** Target reference; an outside-scale target follows the overflow policy. */
  target: number;
  /** Explicit upper bound. All measures share a zero baseline. */
  max: number;
  /** Formats the measure, target, and scale endpoints; defaults to String. */
  formatValue?: (value: number) => string;
  /** Optional abbreviated scale labels; exact values and accessible descriptions use formatValue. */
  formatAxisValue?: (value: number) => string;
  /** Out-of-scale marks are omitted by default; clamp explicitly draws them at the boundary. */
  overflow?: OverflowPolicy;
  /** Label for invalid values; defaults to "Invalid value". */
  invalidValueLabel?: string;
  /** Label accompanying finite values outside the scale; defaults to "Outside scale". */
  outOfDomainLabel?: string;
  /** Label for invalid max; defaults to "Invalid scale". */
  invalidScaleLabel?: string;
  /** Text sizes in CSS pixels, independently configurable by role. */
  typography?: VisualizationTypography;
  /** Visible and accessible target prefix; defaults to "Target". */
  targetLabel?: string;
  /** Text for unavailable values; defaults to "No data". */
  emptyLabel?: string;
};

/** A compact measure and target on an explicit, zero-based scale. */
export function BulletChart({
  label,
  value,
  target,
  max,
  formatValue = String,
  formatAxisValue = formatValue,
  overflow = "omit",
  invalidValueLabel = "Invalid value",
  outOfDomainLabel = "Outside scale",
  invalidScaleLabel = "Invalid scale",
  typography,
  targetLabel = "Target",
  emptyLabel = "No data",
}: BulletChartProps) {
  const validScale = Number.isFinite(max) && max > 0;
  const domain = [0, max] as const;
  const valueState = observationState(
    value,
    validScale ? domain : undefined,
    0,
  );
  const targetState = observationState(
    target,
    validScale ? domain : undefined,
    0,
  );
  const labels = {
    missing: emptyLabel,
    invalid: invalidValueLabel,
    outside: outOfDomainLabel,
  };
  const valueText = observationLabel(value, valueState, formatValue, labels);
  const targetText = observationLabel(target, targetState, formatValue, labels);
  const measure = validScale
    ? plottedObservation(value, valueState, domain, overflow)
    : null;
  const targetMark = validScale
    ? plottedObservation(target, targetState, domain, overflow)
    : null;
  return (
    <div
      className={styles.root}
      style={visualizationTypographyStyle(typography)}
    >
      <div className={styles.labels}>
        <span>{label}</span>
        <strong className={styles.value} data-value-state={valueState}>
          {valueText}
        </strong>
      </div>
      {!validScale && <p className={styles.caption}>{invalidScaleLabel}</p>}
      {validScale && valueState !== "missing" ? (
        <>
          <div
            className={styles.track}
            role="img"
            aria-label={`${label}: ${valueText}. ${targetLabel}: ${targetText}. ${formatValue(0)}–${formatValue(max)}.`}
          >
            {measure !== null && (
              <div
                className={styles.bar}
                data-overflow={valueState === "out-of-domain"}
                style={{ width: `${(measure / max) * 100}%` }}
              />
            )}
            {targetMark !== null && (
              <div
                className={styles.target}
                data-overflow={targetState === "out-of-domain"}
                style={{ left: `${(targetMark / max) * 100}%` }}
              />
            )}
          </div>
          <div className={styles.scale} aria-hidden="true">
            <span>{formatAxisValue(0)}</span>
            <span>{formatAxisValue(max)}</span>
          </div>
        </>
      ) : null}
      <div className={styles.caption}>
        {targetLabel}: {targetText}
      </div>
    </div>
  );
}
