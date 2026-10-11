import React from "react";
import type { GraphSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type GraphChartSeries = Omit<GraphSeriesOption, "type">;
export type GraphChartProps = SeriesChartProps<GraphChartSeries>;

/** Node-link relationships with native graph layout and roaming options. Stable series IDs preserve camera state. */
export function GraphChart(props: GraphChartProps) {
  return <SeriesChart {...props} type="graph" defaults={{}} />;
}
