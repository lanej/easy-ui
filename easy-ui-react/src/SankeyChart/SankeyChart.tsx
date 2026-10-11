import React from "react";
import type { SankeySeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type SankeyChartSeries = Omit<SankeySeriesOption, "type">;
export type SankeyChartProps = SeriesChartProps<SankeyChartSeries>;

/** Directed weighted flows from supplied nodes and links. The application owns aggregation and conservation. */
export function SankeyChart(props: SankeyChartProps) {
  return <SeriesChart {...props} type="sankey" defaults={{}} />;
}
