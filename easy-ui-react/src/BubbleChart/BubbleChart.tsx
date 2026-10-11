import React from "react";
import type { ScatterSeriesOption } from "echarts";
import { SeriesChart, type SeriesChartProps } from "../Chart/seriesChart";

export type BubbleChartSeries = Omit<ScatterSeriesOption, "type"> &
  Required<Pick<ScatterSeriesOption, "symbolSize">>;
export type BubbleChartProps = SeriesChartProps<BubbleChartSeries>;

/** Scatter observations with an explicit symbolSize mapping. The application defines the magnitude and units. */
export function BubbleChart(props: BubbleChartProps) {
  return <SeriesChart {...props} type="scatter" defaults={{}} />;
}
