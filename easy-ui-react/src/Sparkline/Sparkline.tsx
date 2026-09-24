import React from "react";
import {
  continuousSegments,
  MarkerMode,
  position,
} from "../visualization/geometry";
import { SeriesMarkers } from "../visualization/SeriesMarkers";
import { usePlotWidth } from "../visualization/usePlotWidth";
import styles from "./Sparkline.module.scss";

/** Equally spaced observations and the accessible description of their trend. */
export type SparklineProps = {
  /** Equally spaced observations. Use null for a missing bucket, never zero. */
  values: readonly (number | null)[];
  /** Describe the metric, period, trend, and any missing observations. */
  accessibilityLabel: string;
  /** Observation markers; defaults to endpoints of each continuous segment. Use none for unmarked lines. */
  markers?: MarkerMode;
};

const WIDTH = 160;
const HEIGHT = 40;
const PADDING = 4;

/**
 * A compact trend for equally spaced observations. Each sparkline scales to
 * its own extent; use a chart with labelled axes to compare magnitudes.
 */
export function Sparkline({
  values,
  accessibilityLabel,
  markers = "endpoints",
}: SparklineProps) {
  const { ref, width } = usePlotWidth<SVGSVGElement>(WIDTH);
  const segments = getSegments(values, width);

  return (
    <svg
      ref={ref}
      className={styles.root}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label={
        segments.length ? accessibilityLabel : `${accessibilityLabel}. No data.`
      }
      focusable="false"
    >
      {segments
        .filter((points) => points.length > 1)
        .map((points, index) => (
          <polyline
            key={index}
            points={points.map((point) => point.join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      <SeriesMarkers segments={segments} markers={markers} radius={2} />
    </svg>
  );
}

function isObservation(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function getSegments(values: SparklineProps["values"], width: number) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (isObservation(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  if (min === Infinity) return [];

  return continuousSegments(values, (value, index) => {
    if (!isObservation(value)) return null;
    const x =
      values.length === 1
        ? width / 2
        : PADDING + (index / (values.length - 1)) * (width - PADDING * 2);
    const y =
      min === max
        ? HEIGHT / 2
        : HEIGHT -
          PADDING -
          position(value, [min, max]) * (HEIGHT - PADDING * 2);
    return [x, y];
  });
}
