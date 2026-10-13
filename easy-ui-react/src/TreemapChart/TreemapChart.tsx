import React from "react";
import type { TreemapSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type TreemapChartSeries = Omit<TreemapSeriesOption, "type">;
export type TreemapChartProps = SeriesChartProps<TreemapChartSeries>;

/** Hierarchical magnitudes from supplied nested records. Node values and hierarchy remain application-owned. */
export function TreemapChart(props: TreemapChartProps) {
  return <SeriesChart {...props} type="treemap" defaults={{}} />;
}
