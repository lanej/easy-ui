import { position } from "../visualization/geometry";
import type { DurationHistogramBin } from "./model";

/** Relative count per duration unit, normalized in log space to avoid overflow. */
export function histogramDensity(bins: readonly DurationHistogramBin[]) {
  const logs = bins.map((b) =>
    b.count ? Math.log(b.count) - Math.log(b.to - b.from) : -Infinity,
  );
  const peak = logs.reduce((max, value) => Math.max(max, value), -Infinity);
  return bins.map((b, i) => ({
    ...b,
    center: b.from + (b.to - b.from) / 2,
    level: Number.isFinite(logs[i]) ? Math.exp(logs[i] - peak) : 0,
  }));
}
type Bin = ReturnType<typeof histogramDensity>[number];
export function densityGroups(bins: readonly Bin[]) {
  const groups: Bin[][] = [];
  bins.forEach((bin, i) => {
    if (!i || bins[i - 1].to !== bin.from) groups.push([]);
    groups[groups.length - 1].push(bin);
  });
  return groups;
}
/** Smoothstep interpolation between bin centers, constant only within the outer half-bins. */
export function densityAt(
  group: readonly Bin[],
  value: number,
  domain: readonly [number, number],
) {
  let previous = group[0];
  if (value <= previous.center) return { level: previous.level, slope: 0 };
  for (const next of group.slice(1)) {
    if (value < next.center) {
      const t = position(value, [previous.center, next.center]);
      const width =
        (position(next.center, domain) - position(previous.center, domain)) *
        300;
      return {
        level:
          previous.level + t * t * (3 - 2 * t) * (next.level - previous.level),
        slope:
          Number.isFinite(width) && width > 0
            ? (-100 * 6 * t * (1 - t) * (next.level - previous.level)) / width
            : 0,
      };
    }
    previous = next;
  }
  return { level: previous.level, slope: 0 };
}
/** Cubic geometry is clipped before projection. Missing bin intervals remain gaps. */
export function densityCurve(
  group: readonly Bin[],
  domain: readonly [number, number],
) {
  const from = Math.max(group[0].from, domain[0]),
    to = Math.min(group[group.length - 1].to, domain[1]);
  if (from >= to) return null;
  const values = [
    ...new Set([
      from,
      ...group.map((b) => b.center).filter((v) => v > from && v < to),
      to,
    ]),
  ];
  const points = values.map((value) => {
    const density = densityAt(group, value, domain);
    return {
      x: position(value, domain) * 300,
      y: 100 - density.level * 100,
      slope: density.slope,
    };
  });
  let path = `M ${points[0].x} ${points[0].y}`;
  points.slice(1).forEach((next, i) => {
    const previous = points[i],
      third = (next.x - previous.x) / 3;
    path += ` C ${previous.x + third} ${previous.y + previous.slope * third} ${next.x - third} ${next.y - next.slope * third} ${next.x} ${next.y}`;
  });
  return {
    from,
    to,
    path,
    area: `${path} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`,
  };
}
