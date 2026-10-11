import { mergeWith } from "lodash";
import type { DataZoomComponentOption } from "echarts";
import type { ChartOption } from "./types";

/** Retain axis defaults; other authored native components replace their defaults. */
export function chartDefaults(
  defaults: ChartOption,
  option: Omit<ChartOption, "series"> | undefined,
  spanZoom = false,
): ChartOption {
  const result: ChartOption = { ...defaults, ...option };
  // Native component arrays replace the default component list. Retain defaults
  // for the first axis while leaving additional application-owned axes alone.
  for (const key of ["xAxis", "yAxis"] as const) {
    const axes = option?.[key];
    const fallback = defaults[key];
    if (axes === undefined) result[key] = fallback;
    else if (fallback) {
      const decorate = (axis: object) =>
        mergeWith({}, fallback, axis, (_previous, authored) =>
          Array.isArray(authored) ? [...authored] : undefined,
        );
      result[key] = Array.isArray(axes)
        ? axes.length
          ? [decorate(axes[0]), ...axes.slice(1)]
          : []
        : decorate(axes);
    }
  }
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
