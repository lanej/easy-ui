import React from "react";
import type { LineSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type CumulativeDistributionChartSeries = Omit<LineSeriesOption, "type">;
export type CumulativeDistributionChartProps =
  SeriesChartProps<CumulativeDistributionChartSeries>;

/** Supplied cumulative observations, joined as steps by default. Configure fractions or percentages and their axis explicitly. */
export function CumulativeDistributionChart(
  props: CumulativeDistributionChartProps,
) {
  return <SeriesChart {...props} type="line" defaults={{ step: "end" }} />;
}
