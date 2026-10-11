import type { SeriesOption } from "echarts";
import type { SeriesChartProps } from "./seriesChart";
import type { ChartExampleProps } from "./Chart.examples";
import type { ChartOption } from "./types";
import { isPlainObject } from "lodash";

/** Show native defaults without the gallery's authored color overrides. */
export function nativeStyleExample<Series>(
  example: SeriesChartProps<Series>,
  color?: ChartOption["color"],
): SeriesChartProps<Series> &
  Required<Pick<SeriesChartProps<Series>, "option">> {
  const withoutColors = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withoutColors);
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/(?:^color|Color)\d*$/.test(key))
        .map(([key, value]) => [
          key,
          key === "value" || key === "source" ? value : withoutColors(value),
        ]),
    );
  };
  return {
    ...example,
    option: { ...example.option, color },
    series: withoutColors(example.series) as Series[],
  };
}

/** Story-only adapter; runtime components never import synthetic fixtures. */
export function seriesExample<Series extends Omit<SeriesOption, "type">>(
  example: ChartExampleProps,
): SeriesChartProps<Series> &
  Required<Pick<SeriesChartProps<Series>, "option">> {
  const { series, ...option } = example.option;
  const entries = (
    Array.isArray(series) ? series : series ? [series] : []
  ) as SeriesOption[];
  return {
    ...example,
    option,
    series: entries.map(({ type: _type, ...entry }) => entry as Series),
  };
}
