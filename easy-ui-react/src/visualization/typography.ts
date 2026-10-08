import type { CSSProperties } from "react";

/** Text roles shared by native plots and the optional analytical/geographic engines.
 * Values are CSS pixels. Explicit engine options override these defaults.
 */
export type VisualizationTypography = {
  title?: number;
  description?: number;
  label?: number;
  control?: number;
  legend?: number;
  detail?: number;
};

export const defaultVisualizationTypography: Required<VisualizationTypography> =
  {
    title: 18,
    description: 14,
    label: 12,
    control: 14,
    legend: 12,
    detail: 12,
  };

/** Reject invalid sizes without propagating NaN/negative values into CSS or engine geometry. */
export function resolveVisualizationTypography(
  typography: VisualizationTypography = {},
): Required<VisualizationTypography> {
  return Object.fromEntries(
    Object.entries(defaultVisualizationTypography).map(([role, fallback]) => {
      const value = typography[role as keyof VisualizationTypography];
      return [
        role,
        typeof value === "number" && Number.isFinite(value) && value > 0
          ? value
          : fallback,
      ];
    }),
  ) as Required<VisualizationTypography>;
}

/** Identical inherited variables work for a composed component or separately placed companions. */
export function visualizationTypographyStyle(
  typography?: VisualizationTypography,
): CSSProperties {
  return Object.fromEntries(
    Object.entries(resolveVisualizationTypography(typography)).map(
      ([role, value]) => [`--ezui-viz-${role}-size`, `${value}px`],
    ),
  ) as CSSProperties;
}
