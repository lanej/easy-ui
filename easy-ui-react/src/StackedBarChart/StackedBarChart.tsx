import React from "react";
import type { BarSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type StackedBarChartSeries = Omit<BarSeriesOption, "type">;
export type StackedBarChartProps = SeriesChartProps<StackedBarChartSeries>;

/** Additive bar series sharing a default stack. Supply already normalized values for percentage charts. */
export function StackedBarChart(props: StackedBarChartProps) {
  return <SeriesChart {...props} type="bar" defaults={{ stack: "total" }} />;
}
