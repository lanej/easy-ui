import React from "react";
import type { LineSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type AreaChartSeries = Omit<LineSeriesOption, "type">;
export type AreaChartProps = SeriesChartProps<AreaChartSeries>;

/** Line series with filled areas. Supply stack to show additive totals; values are never normalized. */
export function AreaChart(props: AreaChartProps) {
  return <SeriesChart {...props} type="line" defaults={{ areaStyle: {} }} />;
}
