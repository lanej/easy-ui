import type { FillLayerSpecification, FilterSpecification } from "maplibre-gl";
import type { MapSurfaceCell } from "./types";

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

export const deliverySurfaceFilter: FilterSpecification = [
  "==",
  ["get", "hasSupportedEstimate"],
  true,
];

/** Missing estimates stay outside the quantitative ramp, even if the paint is used alone. */
export const deliverySurfacePaint: NonNullable<
  FillLayerSpecification["paint"]
> = {
  "fill-color": [
    "case",
    ["==", ["get", "hasSupportedEstimate"], true],
    [
      "interpolate",
      ["linear"],
      ["number", ["get", "medianMinutes"]],
      0,
      "#2c7bb6",
      30,
      "#abd9e9",
      60,
      "#ffffbf",
      90,
      "#fdae61",
      120,
      "#d7191c",
    ],
    "rgba(0,0,0,0)",
  ],
  // This is relative observation count within the drawable grid, not statistical confidence.
  "fill-opacity": [
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
  ],
};
