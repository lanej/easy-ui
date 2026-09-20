import React from "react";
import { markerPoints, type MarkerMode, type PlotPoint } from "./geometry";

/** Shared marks only: callers retain ownership of axes, scales, interpolation, and line styles. */
export function SeriesMarkers({
  segments,
  markers,
  radius,
}: {
  segments: PlotPoint[][];
  markers: MarkerMode;
  radius: number;
}) {
  const points = [
    ...segments.filter((segment) => segment.length === 1).flat(),
    ...markerPoints(segments, markers),
  ];
  return (
    <>
      {points.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={radius} fill="currentColor" />
      ))}
    </>
  );
}
