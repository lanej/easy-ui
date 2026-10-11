import React from "react";
import type { CustomSeriesRenderItem, LineSeriesOption } from "echarts";
import { Chart, type ChartProps, type ChartOption } from "../Chart";
import { visualizationColors } from "../visualization/colors";

export type PredictionBandPoint = {
  /** Stable record ID for the default exact-data view. */
  id: string;
  x: number;
  observed: number | null;
  predicted: number | null;
  lower: number | null;
  upper: number | null;
};
export type PredictionBandChartProps = Omit<ChartProps, "option"> & {
  /** Ordered observations and supplied model bounds, in the same axis units. */
  points: readonly PredictionBandPoint[];
  option?: Omit<ChartOption, "series">;
  observedSeries?: Omit<LineSeriesOption, "type" | "data">;
  predictedSeries?: Omit<LineSeriesOption, "type" | "data">;
};

const renderBand: CustomSeriesRenderItem = (_params, api) => ({
  type: "polygon",
  shape: {
    points: [
      api.coord([api.value(0), api.value(1)]),
      api.coord([api.value(3), api.value(4)]),
      api.coord([api.value(3), api.value(5)]),
      api.coord([api.value(0), api.value(2)]),
    ],
  },
  style: api.style(),
});
const validBounds = (point: PredictionBandPoint) =>
  Number.isFinite(point.x) &&
  point.lower !== null &&
  point.upper !== null &&
  Number.isFinite(point.lower) &&
  Number.isFinite(point.upper) &&
  point.lower <= point.upper;

/** Draws supplied prediction bounds, including negative bounds, without fitting or filling missing intervals. */
export function PredictionBandChart({
  points,
  option,
  observedSeries,
  predictedSeries,
  dataTable,
  ...props
}: PredictionBandChartProps) {
  const segments = points.slice(1).flatMap((point, index) => {
    const previous = points[index];
    return validBounds(point) && validBounds(previous) && point.x > previous.x
      ? [
          [
            previous.x,
            previous.lower!,
            previous.upper!,
            point.x,
            point.lower!,
            point.upper!,
          ],
        ]
      : [];
  });
  return (
    <Chart
      {...props}
      dataTable={
        dataTable ?? {
          columns: ["X", "Observed", "Predicted", "Lower bound", "Upper bound"],
          rows: points.map((point) => ({
            id: point.id,
            values: [
              point.x,
              point.observed,
              point.predicted,
              point.lower,
              point.upper,
            ],
          })),
        }
      }
      option={{
        grid: { left: 16, right: 24, top: 40, bottom: 48, containLabel: true },
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        legend: {
          data: [
            String(observedSeries?.name ?? "Observed"),
            String(predictedSeries?.name ?? "Predicted"),
          ],
        },
        tooltip: { trigger: "axis" },
        ...option,
        series: [
          {
            id: "prediction-band",
            type: "custom",
            renderItem: renderBand,
            silent: true,
            clip: true,
            encode: { x: [0, 3], y: [1, 2, 4, 5] },
            tooltip: { show: false },
            itemStyle: { color: visualizationColors.primary, opacity: 0.18 },
            data: segments,
          },
          {
            id: "observed",
            name: "Observed",
            connectNulls: false,
            itemStyle: { color: visualizationColors.primary },
            ...observedSeries,
            type: "line",
            data: points.map((point) => [point.x, point.observed]),
          },
          {
            id: "prediction",
            name: "Predicted",
            connectNulls: false,
            itemStyle: { color: visualizationColors.primary },
            lineStyle: { type: "dashed" },
            ...predictedSeries,
            type: "line",
            data: points.map((point) => [point.x, point.predicted]),
          },
        ],
      }}
    />
  );
}
