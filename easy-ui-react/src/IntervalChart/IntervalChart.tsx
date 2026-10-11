import React from "react";
import type { CustomSeriesOption } from "echarts";
import { Chart, type ChartProps, type ChartOption } from "../Chart";
import { horizontalInterval } from "../Chart/intervalRenderer";

export type ChartInterval = {
  id: string;
  /** Shared lane label. Multiple intervals may occupy the same lane. */
  row: string;
  label: string;
  /** Numeric coordinates in the supplied axis unit; time axes use epoch milliseconds. */
  start: number | null;
  end: number | null;
  /** Native datum styling, including token references. */
  itemStyle?: CustomSeriesOption["itemStyle"];
};
export type IntervalChartProps = Omit<ChartProps, "option"> & {
  intervals: readonly ChartInterval[];
  /** Native annotations and styling; data and interval geometry remain component-owned. */
  intervalSeries?: Omit<
    CustomSeriesOption,
    "type" | "data" | "renderItem" | "encode"
  >;
  option?: Omit<ChartOption, "series">;
};

/** Supplied spans on shared lanes. Missing endpoints stay in exact data without an invented span. */
export function IntervalChart({
  intervals,
  intervalSeries,
  option,
  dataTable,
  ...props
}: IntervalChartProps) {
  const rows = [...new Set(intervals.map((interval) => interval.row))];
  const valid = intervals.filter(
    (interval) =>
      interval.start !== null &&
      interval.end !== null &&
      Number.isFinite(interval.start) &&
      Number.isFinite(interval.end) &&
      interval.end >= interval.start,
  );
  return (
    <Chart
      {...props}
      dataTable={
        dataTable ?? {
          columns: ["Lane", "Interval", "Start", "End"],
          rows: intervals.map((interval) => ({
            id: interval.id,
            values: [
              interval.row,
              interval.label,
              interval.start,
              interval.end,
            ],
          })),
        }
      }
      option={{
        grid: { left: 16, right: 24, top: 24, bottom: 48, containLabel: true },
        tooltip: { trigger: "item" },
        xAxis: { type: "value" },
        yAxis: { type: "category", data: rows, inverse: true },
        ...option,
        series: [
          {
            id: "intervals",
            ...intervalSeries,
            type: "custom",
            renderItem: horizontalInterval,
            clip: true,
            encode: { x: [1, 2], y: 0, tooltip: [1, 2] },
            data: valid.map((interval) => ({
              id: interval.id,
              name: interval.label,
              value: [
                rows.indexOf(interval.row),
                interval.start!,
                interval.end!,
              ],
              itemStyle: interval.itemStyle,
            })),
          },
        ],
      }}
    />
  );
}
