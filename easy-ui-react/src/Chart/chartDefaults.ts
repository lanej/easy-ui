import { mergeWith } from "lodash";
import type { DataZoomComponentOption } from "echarts";
import type { ChartOption } from "./types";

/** ECharts consumes baseOption instead of outer fields when it is supplied. */
export function withChartSeries(
  option: ChartOption,
  series: ChartOption["series"],
): ChartOption {
  return option.baseOption
    ? { ...option, baseOption: { ...option.baseOption, series } }
    : { ...option, series };
}

/** Retain axis defaults; other authored native components replace their defaults. */
export function chartDefaults(
  defaults: ChartOption,
  option: Omit<ChartOption, "series"> | undefined,
  spanZoom = false,
): ChartOption {
  const result: ChartOption = { ...defaults, ...option };
  // Native component arrays replace the default component list. Retain defaults
  // for the first axis while leaving additional application-owned axes alone.
  const axesWithDefaults = <T>(fallback: T, axes: T): T => {
    if (axes === undefined) return fallback;
    if (fallback && axes) {
      const decorate = (axis: object) =>
        mergeWith({}, fallback, axis, (_previous, authored) =>
          Array.isArray(authored) ? [...authored] : undefined,
        );
      return (
        Array.isArray(axes)
          ? axes.length
            ? [decorate(axes[0]), ...axes.slice(1)]
            : []
          : decorate(axes)
      ) as T;
    }
    return axes;
  };
  const authored = option as ChartOption | undefined;
  result.xAxis = axesWithDefaults(defaults.xAxis, authored?.xAxis);
  result.yAxis = axesWithDefaults(defaults.yAxis, authored?.yAxis);
  if (result.baseOption)
    result.baseOption = chartDefaults(defaults, result.baseOption, spanZoom);
  if (spanZoom) {
    const zoom = result.dataZoom;
    if (zoom) {
      const decorate = (entry: DataZoomComponentOption) => ({
        ...entry,
        filterMode: entry.filterMode ?? ("weakFilter" as const),
      });
      result.dataZoom = Array.isArray(zoom)
        ? zoom.map(decorate)
        : decorate(zoom);
    }
    if (result.media)
      result.media = result.media.map((media) => ({
        ...media,
        option: media.option
          ? chartDefaults({}, media.option, true)
          : media.option,
      }));
    if (result.options)
      result.options = result.options.map((frame) =>
        chartDefaults({}, frame, true),
      );
  }
  return result;
}
