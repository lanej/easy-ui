import React from "react";
import type { HeatmapSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type HeatmapChartSeries = Omit<HeatmapSeriesOption, "type">;
export type HeatmapChartProps = SeriesChartProps<HeatmapChartSeries>;

/** Matrix observations with caller-supplied axes and visualMap. Missing values and sample policy remain explicit. */
export function HeatmapChart(props: HeatmapChartProps) {
  return <SeriesChart {...props} type="heatmap" defaults={{}} />;
}
