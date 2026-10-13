import React from "react";
import type { BarSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type BarChartSeries = Omit<BarSeriesOption, "type">;
export type BarChartProps = SeriesChartProps<BarChartSeries>;

/** Category comparisons with one or more native bar series. Supports horizontal and vertical axes. */
export function BarChart(props: BarChartProps) {
  return <SeriesChart {...props} type="bar" defaults={{}} />;
}
