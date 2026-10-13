import React, { useId } from "react";
import { position } from "../visualization/geometry";
import {
  regionAt,
  type DurationHealthRegion,
  type DurationHistogramBin,
} from "./model";
import {
  densityAt,
  densityCurve,
  densityGroups,
  histogramDensity,
} from "./densityGeometry";
import styles from "./DurationDistribution.module.scss";

/** Shared density source for the main curve and compact concentration bar. */
export function HistogramReference({
  bins,
  domain,
  regions,
  style,
  presentation,
}: {
  bins: readonly DurationHistogramBin[];
  domain: readonly [number, number];
  regions: readonly DurationHealthRegion[];
  style: "binned" | "smooth";
  presentation: "plot" | "concentration";
}) {
  const id = useId().replace(/:/g, "");
  const density = histogramDensity(bins),
    groups = densityGroups(density);
  const x = (value: number) => position(value, domain) * 300;
  const assessment = (value: number) =>
    regionAt(regions, value)?.assessment ?? "unassessed";
  if (presentation === "concentration")
    return (
      <svg
        className={styles.concentrationStrip}
        viewBox="0 0 300 8"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-concentration-style={style}
      >
        {style === "binned"
          ? density
              .filter((b) => b.from < domain[1] && b.to > domain[0])
              .map((b) => {
                const from = Math.max(domain[0], b.from),
                  to = Math.min(domain[1], b.to);
                const edges = [
                  ...new Set([
                    from,
                    to,
                    ...regions
                      .flatMap((r) => [r.from, r.to])
                      .filter((v) => v > from && v < to),
                  ]),
                ].sort((a, b) => a - b);
                return edges
                  .slice(0, -1)
                  .map((start, i) => (
                    <rect
                      key={`${b.from}-${start}`}
                      className={styles.concentrationBin}
                      data-reference-assessment={assessment(start)}
                      x={x(start)}
                      y="0"
                      width={x(edges[i + 1]) - x(start)}
                      height="8"
                      fillOpacity={b.level * 0.45}
                    />
                  ));
              })
          : groups.map((group, i) => {
              const curve = densityCurve(group, domain);
              if (!curve) return null;
              const { from, to } = curve;
              const edges = [
                ...new Set([
                  from,
                  to,
                  ...group
                    .flatMap((bin, index) => {
                      const next = group[index + 1];
                      return [
                        bin.center,
                        ...(next
                          ? Array.from(
                              { length: 7 },
                              (_, n) =>
                                bin.center +
                                ((next.center - bin.center) * (n + 1)) / 8,
                            )
                          : []),
                      ];
                    })
                    .filter((value) => value > from && value < to),
                  ...regions
                    .flatMap((r) => [r.from, r.to])
                    .filter((v) => v > from && v < to),
                ]),
              ].sort((a, b) => a - b);
              const gradientId = `${id}-concentration-${i}`;
              return (
                <React.Fragment key={i}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
                      {edges
                        .slice(0, -1)
                        .flatMap((start, j) =>
                          [start, edges[j + 1]].map((value, k) => (
                            <stop
                              key={`${j}-${k}`}
                              className={styles.concentrationStop}
                              data-reference-assessment={assessment(start)}
                              offset={position(value, [from, to])}
                              stopOpacity={
                                densityAt(group, value, domain).level * 0.45
                              }
                            />
                          )),
                        )}
                    </linearGradient>
                  </defs>
                  <rect
                    x={x(from)}
                    y="0"
                    width={x(to) - x(from)}
                    height="8"
                    fill={`url(#${gradientId})`}
                  />
                </React.Fragment>
              );
            })}
      </svg>
    );
  const edges = [
    ...new Set([
      domain[0],
      domain[1],
      ...regions
        .flatMap((r) => [r.from, r.to])
        .filter((v) => v > domain[0] && v < domain[1]),
    ]),
  ].sort((a, b) => a - b);
  return (
    <svg
      className={styles.densityCurve}
      viewBox="0 0 300 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-density-curve="true"
    >
      {groups.map((group, i) => {
        const curve = densityCurve(group, domain);
        if (!curve) return null;
        return (
          <React.Fragment key={i}>
            {edges.slice(0, -1).map((from, j) => {
              const clipId = `${id}-density-${i}-${j}`;
              return (
                <React.Fragment key={j}>
                  <defs>
                    <clipPath id={clipId}>
                      <rect
                        x={x(from)}
                        y="0"
                        width={x(edges[j + 1]) - x(from)}
                        height="100"
                      />
                    </clipPath>
                  </defs>
                  <path
                    className={styles.densityArea}
                    data-reference-assessment={assessment(from)}
                    d={curve.area}
                    clipPath={`url(#${clipId})`}
                  />
                </React.Fragment>
              );
            })}
            <path className={styles.densityLine} d={curve.path} />
          </React.Fragment>
        );
      })}
    </svg>
  );
}
