import React from "react";
import type { ScatterSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type ScatterChartSeries = Omit<ScatterSeriesOption, "type">;
export type ScatterChartProps = SeriesChartProps<ScatterChartSeries>;

/** Pairs of numeric observations. Supply native symbol sizes, labels, and selection IDs. */
export function ScatterChart(props: ScatterChartProps) {
  return <SeriesChart {...props} type="scatter" defaults={{}} />;
}
