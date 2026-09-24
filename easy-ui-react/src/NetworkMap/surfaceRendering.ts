import type {
  ExpressionSpecification,
  FillLayerSpecification,
} from "maplibre-gl";
import type {
  MapSurfaceCell,
  MapSurfaceColorScale,
  MapSurfaceMetric,
} from "./types";

/** A quantitative estimate needs both a finite duration and a positive observation count. */
export function hasSupportedSurfaceEstimate(
  cell: Pick<MapSurfaceCell, "medianMinutes" | "n">,
) {
  return (
    typeof cell.medianMinutes === "number" &&
    Number.isFinite(cell.medianMinutes) &&
    cell.medianMinutes >= 0 &&
    Number.isFinite(cell.n) &&
    cell.n > 0
  );
}

export const deliverySurfaceFilter: ExpressionSpecification = [
  "==",
  ["get", "hasSupportedEstimate"],
  true,
];

export function hasSupportedSurfaceMetric(
  cell: MapSurfaceCell,
  field: MapSurfaceMetric["field"] = "medianMinutes",
) {
  const value = cell[field];
  return (
    hasSupportedSurfaceEstimate(cell) &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

export function buildDeliverySurfaceFilter(
  field: MapSurfaceMetric["field"] = "medianMinutes",
): ExpressionSpecification {
  return field === "iqrMinutes"
    ? [
        "all",
        deliverySurfaceFilter,
        ["==", ["get", "hasSupportedSpread"], true],
      ]
    : deliverySurfaceFilter;
}

/**
 * The exact ramp this component has always used. Do not change these values: a real consumer
 * (`logistics-services`' `TheftPatternsScreen.tsx`) already transforms its own values into a
 * synthetic 0-120 range specifically to fit this default, and changing it would silently break
 * that workaround. Callers whose values don't fit a 0-120-minute elapsed-time range should pass
 * `NetworkMapProps.deliverySurfaceColorScale` (or a per-metric `colorScale`) instead.
 */
export const defaultDeliverySurfaceColorScale: MapSurfaceColorScale = [
  { value: 0, color: "#2c7bb6" },
  { value: 30, color: "#abd9e9" },
  { value: 60, color: "#ffffbf" },
  { value: 90, color: "#fdae61" },
  { value: 120, color: "#d7191c" },
];

/** Missing estimates stay outside the quantitative ramp, regardless of which field/scale is used. */
function colorRampExpression(
  field: MapSurfaceMetric["field"],
  scale: MapSurfaceColorScale,
): ExpressionSpecification {
  const stops = [...scale].sort((a, b) => a.value - b.value);
  return [
    "case",
    buildDeliverySurfaceFilter(field),
    [
      "interpolate",
      ["linear"],
      ["number", ["get", field]],
      ...stops.flatMap((stop) => [stop.value, stop.color]),
    ],
    "rgba(0,0,0,0)",
  ] as ExpressionSpecification;
}

// This is relative observation count within the drawable grid, not statistical confidence.
const sampleCountOpacityExpression: ExpressionSpecification = [
  "case",
  ["==", ["get", "hasSupportedEstimate"], true],
  [
    "interpolate",
    ["linear"],
    ["number", ["get", "relativeSampleCount"]],
    0,
    0.05,
    1,
    0.5,
  ],
  0,
];

/** Legacy single-layer paint: `medianMinutes` drives color, relative `n` drives opacity — the
 *  exact behavior this component has always had, parameterized only by color scale. */
export function buildDeliverySurfacePaint(
  colorScale: MapSurfaceColorScale = defaultDeliverySurfaceColorScale,
): NonNullable<FillLayerSpecification["paint"]> {
  return {
    "fill-color": colorRampExpression("medianMinutes", colorScale),
    "fill-opacity": sampleCountOpacityExpression,
  };
}

/** Missing estimates stay outside the quantitative ramp, even if the paint is used alone. */
export const deliverySurfacePaint: NonNullable<
  FillLayerSpecification["paint"]
> = buildDeliverySurfacePaint();

/**
 * Single-metric paint: color comes from the metric's own field/scale, opacity is a flat, visible
 * constant for any supported cell — no blending with a second metric's values into one channel.
 */
export function buildMetricPaint(
  metric: Pick<MapSurfaceMetric, "field" | "colorScale">,
): NonNullable<FillLayerSpecification["paint"]> {
  return {
    "fill-color": colorRampExpression(
      metric.field,
      metric.colorScale ?? defaultDeliverySurfaceColorScale,
    ),
    "fill-opacity": [
      "case",
      buildDeliverySurfaceFilter(metric.field),
      0.5,
      0,
    ] as ExpressionSpecification,
  };
}
