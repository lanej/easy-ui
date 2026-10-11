import type { SeriesOption } from "echarts";
import type { SeriesChartProps } from "./seriesChart";
import type { ChartExampleProps } from "./Chart.examples";

/** Story-only adapter; runtime components never import synthetic fixtures. */
export function seriesExample<Series extends Omit<SeriesOption, "type">>(
  example: ChartExampleProps,
): SeriesChartProps<Series> {
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
