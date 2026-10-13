import React from "react";
import type { BarSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type HistogramChartSeries = Omit<BarSeriesOption, "type">;
export type HistogramChartProps = SeriesChartProps<HistogramChartSeries>;

/** Supplied counts in equal-width buckets. Bin calculation belongs to the application; use DurationDistribution for unequal widths. */
export function HistogramChart(props: HistogramChartProps) {
  return (
    <SeriesChart {...props} type="bar" defaults={{ barCategoryGap: "5%" }} />
  );
}
