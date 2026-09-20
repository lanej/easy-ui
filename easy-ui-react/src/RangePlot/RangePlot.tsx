import React from "react";
import { isDomain, position } from "../visualization/geometry";
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
import styles from "./RangePlot.module.scss";

/** Named observations and an optional supplied interval on a shared signed scale. */
export type RangePlotProps = {
  /** Figure's visible heading and accessible name. */
  label: string;
  /** Visible context describing units, coverage, and the meaning of the interval. */
  description: string;
  /** Explicit scale; may include negative values. */
  domain: readonly [number, number];
  /** Named benchmarks or observations; null is unavailable. */
  points: readonly {
    /** Stable application identifier used as the row key. */
    id: string;
    /** Visible name of the observation or benchmark. */
    label: string;
    /** Finite observation, or null when unavailable. Outside-domain values retain exact labels. */
    value: number | null;
  }[];
  /** Bounds are supplied by the application, not calculated or inferred. */
  interval?: {
    /** Inclusive supplied lower bound. */
    from: number;
    /** Inclusive supplied upper bound; may equal from. */
    to: number;
    /** Visible interval name, including its statistical meaning where relevant. */
    label: string;
  };
  /** Formats observations, interval bounds, and axis endpoints; defaults to String. */
  formatValue?: (value: number) => string;
  /** Optional abbreviated axis endpoints; exact observations and intervals keep formatValue. */
  formatAxisValue?: (value: number) => string;
  /** Out-of-scale marks are omitted by default; clamp explicitly draws them at the boundary. */
  overflow?: OverflowPolicy;
  /** Label for invalid observations; defaults to "Invalid value". */
  invalidValueLabel?: string;
  /** Label for invalid or reversed intervals; defaults to "Invalid interval". */
  invalidIntervalLabel?: string;
  /** Label for invalid domains; defaults to "Invalid scale". */
  invalidScaleLabel?: string;
  /** Label accompanying finite values outside domain; defaults to "Outside scale". */
  outOfDomainLabel?: string;
  /** Text sizes in CSS pixels, independently configurable by role. */
  typography?: VisualizationTypography;
  /** Text for an empty plot or unavailable observations; defaults to "No data". */
  emptyLabel?: string;
  /** Visible axis prefix; defaults to "Scale". */
  scaleLabel?: string;
};

/** Named points and an optional interval, aligned to the same native CSS scale. */
export function RangePlot({
  label,
  description,
  domain,
  points,
  interval,
  formatValue = String,
  formatAxisValue = formatValue,
  overflow = "omit",
  invalidValueLabel = "Invalid value",
  invalidIntervalLabel = "Invalid interval",
  invalidScaleLabel = "Invalid scale",
  outOfDomainLabel = "Outside scale",
  typography,
  emptyLabel = "No data",
  scaleLabel = "Scale",
}: RangePlotProps) {
  const valid = isDomain(domain);
  const labels = {
    missing: emptyLabel,
    invalid: invalidValueLabel,
    outside: outOfDomainLabel,
  };
  const intervalState =
    interval &&
    (!Number.isFinite(interval.from) ||
    !Number.isFinite(interval.to) ||
    interval.from > interval.to
      ? "invalid"
      : valid && (interval.from < domain[0] || interval.to > domain[1])
        ? "out-of-domain"
        : "valid");
  const intervalBounds =
    valid &&
    interval &&
    (intervalState === "valid" ||
      (intervalState === "out-of-domain" && overflow === "clamp"))
      ? [
          Math.max(domain[0], Math.min(domain[1], interval.from)),
          Math.max(domain[0], Math.min(domain[1], interval.to)),
        ]
      : null;
  const intervalText =
    interval &&
    (!Number.isFinite(interval.from) || !Number.isFinite(interval.to)
      ? invalidIntervalLabel
      : `${interval.from === interval.to ? formatValue(interval.from) : `${formatValue(interval.from)}–${formatValue(interval.to)}`}${intervalState === "invalid" ? ` · ${invalidIntervalLabel}` : intervalState === "out-of-domain" ? ` · ${outOfDomainLabel}` : ""}`);
  const offset = (value: number) => `${position(value, domain) * 100}%`;
  return (
    <figure
      className={styles.root}
      aria-label={label}
      style={visualizationTypographyStyle(typography)}
    >
      <figcaption>
        <strong>{label}</strong>
        <p className={styles.description}>{description}</p>
      </figcaption>
      {!valid && <p>{invalidScaleLabel}</p>}
      {!points.length && !interval ? (
        <p>{emptyLabel}</p>
      ) : (
        <>
          <ul className={styles.rows} role="list" aria-label={label}>
            {interval && (
              <li className={styles.row}>
                <span>{interval.label}</span>
                <span className={styles.track} aria-hidden="true">
                  {intervalBounds &&
                    (intervalBounds[0] === intervalBounds[1] ? (
                      <span
                        className={styles.bound}
                        data-overflow={intervalState === "out-of-domain"}
                        style={{ left: offset(intervalBounds[0]) }}
                      />
                    ) : (
                      <span
                        className={styles.interval}
                        data-overflow={intervalState === "out-of-domain"}
                        style={{
                          left: offset(intervalBounds[0]),
                          width: `${(position(intervalBounds[1], domain) - position(intervalBounds[0], domain)) * 100}%`,
                        }}
                      />
                    ))}
                </span>
                <span className={styles.value} data-value-state={intervalState}>
                  {intervalText}
                </span>
              </li>
            )}
            {points.map((point) => {
              const state = observationState(
                point.value,
                valid ? domain : undefined,
              );
              const mark = valid
                ? plottedObservation(point.value, state, domain, overflow)
                : null;
              return (
                <li key={point.id} className={styles.row}>
                  <span>{point.label}</span>
                  <span className={styles.track} aria-hidden="true">
                    {mark !== null && (
                      <span
                        className={styles.point}
                        data-overflow={state === "out-of-domain"}
                        style={{ left: offset(mark) }}
                      />
                    )}
                  </span>
                  <span className={styles.value} data-value-state={state}>
                    {observationLabel(point.value, state, formatValue, labels)}
                  </span>
                </li>
              );
            })}
          </ul>
          {valid && (
            <div className={styles.row}>
              <span className={styles.description}>{scaleLabel}</span>
              <span className={styles.axis}>
                <span>{formatAxisValue(domain[0])}</span>
                <span>{formatAxisValue(domain[1])}</span>
              </span>
              <span />
            </div>
          )}
        </>
      )}
    </figure>
  );
}
