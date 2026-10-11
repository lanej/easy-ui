import React from "react";
import type { BoxplotSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type BoxPlotChartSeries = Omit<BoxplotSeriesOption, "type">;
export type BoxPlotChartProps = SeriesChartProps<BoxPlotChartSeries>;

/** Supplied five-number summaries in native min, lower quartile, median, upper quartile, max order. Does not compute statistics. */
export function BoxPlotChart(props: BoxPlotChartProps) {
  return <SeriesChart {...props} type="boxplot" defaults={{}} />;
}
