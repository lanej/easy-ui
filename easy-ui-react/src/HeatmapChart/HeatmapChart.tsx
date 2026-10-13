import React from "react";
import type { HeatmapSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";
import type { ChartOption } from "../Chart";

export type HeatmapChartSeries = Omit<HeatmapSeriesOption, "type">;
export type HeatmapChartProps = Omit<
  SeriesChartProps<HeatmapChartSeries>,
  "option"
> & {
  /** Supply the coordinate system and visualMap for the application's matrix. */
  option: Omit<ChartOption, "series">;
};

/** Matrix observations with caller-supplied axes and visualMap. Missing values and sample policy remain explicit. */
export function HeatmapChart(props: HeatmapChartProps) {
  return <SeriesChart {...props} type="heatmap" defaults={{}} />;
}
