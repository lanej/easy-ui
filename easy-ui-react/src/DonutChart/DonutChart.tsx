import React from "react";
import type { PieSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type DonutChartSeries = Omit<PieSeriesOption, "type">;
export type DonutChartProps = SeriesChartProps<DonutChartSeries>;

/** Part-to-whole observations with a default inner radius. The application supplies the denominator. */
export function DonutChart(props: DonutChartProps) {
  return (
    <SeriesChart {...props} type="pie" defaults={{ radius: ["45%", "70%"] }} />
  );
}
