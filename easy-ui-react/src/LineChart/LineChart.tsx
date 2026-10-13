import React from "react";
import type { LineSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type LineChartSeries = Omit<LineSeriesOption, "type">;
export type LineChartProps = SeriesChartProps<LineChartSeries>;

/** Trends or numeric response curves from supplied observations. Missing values remain gaps. */
export function LineChart(props: LineChartProps) {
  return <SeriesChart {...props} type="line" defaults={{}} />;
}
