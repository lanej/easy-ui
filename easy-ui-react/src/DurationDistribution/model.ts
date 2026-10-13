import type { HealthIndicatorAssessment } from "../HealthIndicator";
import { isDomain, position } from "../visualization/geometry";

export type DurationQuantile = {
  fraction: number;
  value: number;
  label?: string;
};
export type DurationHistogramBin = { from: number; to: number; count: number };
export type DurationCumulativePoint = { value: number; fraction: number };
/** Half-open policy intervals [from, to); the upper end may be Infinity. */
export type DurationHealthRegion = {
  from: number;
  to: number;
  assessment: HealthIndicatorAssessment;
  label: string;
  shortLabel?: string;
};
const duration = (n: number) => Number.isFinite(n) && n >= 0;
const fraction = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
export const validDurationDomain = (domain: readonly [number, number]) =>
  isDomain(domain) && domain[0] >= 0;
export function validQuantiles(points: readonly DurationQuantile[]) {
  return points.every(
    (p, i) =>
      duration(p.value) &&
      fraction(p.fraction) &&
      (!i ||
        (p.fraction > points[i - 1].fraction &&
          p.value >= points[i - 1].value)),
  );
}
export function validHistogram(bins: readonly DurationHistogramBin[]) {
  return bins.every(
    (b, i) =>
      duration(b.from) &&
      duration(b.to) &&
      b.to > b.from &&
      Number.isSafeInteger(b.count) &&
      b.count >= 0 &&
      (!i || b.from >= bins[i - 1].to),
  );
}
export function validCumulative(points: readonly DurationCumulativePoint[]) {
  return points.every(
    (p, i) =>
      duration(p.value) &&
      fraction(p.fraction) &&
      (!i ||
        (p.value >= points[i - 1].value &&
          p.fraction >= points[i - 1].fraction)),
  );
}
export function validHealthRegions(regions: readonly DurationHealthRegion[]) {
  return regions.every(
    (r, i) =>
      duration(r.from) &&
      (duration(r.to) || r.to === Infinity) &&
      r.to > r.from &&
      ["healthy", "degraded", "unhealthy"].includes(r.assessment) &&
      (!i || r.from >= regions[i - 1].to),
  );
}
export function regionAt(
  regions: readonly DurationHealthRegion[],
  value: number,
) {
  return regions.find((r) => value >= r.from && value < r.to);
}
/** Interpolation is only between supplied CDF points, never extrapolation. Step is right-continuous. */
export function cumulativeFractionAt(
  points: readonly DurationCumulativePoint[],
  value: number,
  interpolation: "linear" | "step",
) {
  if (
    !points.length ||
    value < points[0].value ||
    value > points[points.length - 1].value
  )
    return null;
  let previous = points[0];
  for (const next of points.slice(1)) {
    if (next.value > value) {
      return interpolation === "step"
        ? previous.fraction
        : previous.fraction +
            position(value, [previous.value, next.value]) *
              (next.fraction - previous.fraction);
    }
    previous = next;
  }
  return previous.fraction;
}
/** Clip before projection to avoid infinite SVG coordinates for distant finite values. */
export function clippedCumulative(
  points: readonly DurationCumulativePoint[],
  domain: readonly [number, number],
  interpolation: "linear" | "step",
) {
  const left = cumulativeFractionAt(points, domain[0], interpolation);
  const right = cumulativeFractionAt(points, domain[1], interpolation);
  const visible = points.filter(
    (p) => p.value >= domain[0] && p.value <= domain[1],
  );
  return [
    ...(left === null || visible[0]?.value === domain[0]
      ? []
      : [{ value: domain[0], fraction: left }]),
    ...visible,
    ...(right === null || visible[visible.length - 1]?.value === domain[1]
      ? []
      : [{ value: domain[1], fraction: right }]),
  ];
}
