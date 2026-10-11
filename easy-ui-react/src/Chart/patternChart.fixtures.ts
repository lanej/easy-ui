import type { BarSeriesOption, LineSeriesOption } from "echarts";
import {
  forecast,
  bridge,
  predictionBandExample,
  waterfallExample,
} from "./Chart.extensions";
import {
  trackingIntervals,
  shipmentTimelineExample,
  warehouseProgress,
  warehouseProgressExample,
} from "./Chart.logistics";
import type { IntervalChartProps } from "../IntervalChart";
import type { PredictionBandChartProps } from "../PredictionBandChart";
import type { WaterfallChartProps } from "../WaterfallChart";
import { visualizationColors } from "../visualization/colors";

const withoutSeries = ({
  series: _series,
  ...option
}: typeof predictionBandExample.option) => option;
const predictionSeries = predictionBandExample.option
  .series as LineSeriesOption[];
const {
  data: _observedData,
  type: _observedType,
  ...observedSeries
} = predictionSeries[2];
const {
  data: _predictedData,
  type: _predictedType,
  ...predictedSeries
} = predictionSeries[3];
export const predictionBandProps: PredictionBandChartProps = {
  ...predictionBandExample,
  observedSeries,
  predictedSeries,
  option: withoutSeries(predictionBandExample.option),
  points: forecast.map((point) => ({
    ...point,
    id: String(point.time),
    x: point.time,
  })),
};
export const waterfallProps: WaterfallChartProps = {
  ...waterfallExample,
  option: {
    ...withoutSeries(waterfallExample.option),
    tooltip: { trigger: "item" },
  },
  steps: bridge.map((step) => ({
    id: step.name,
    label: step.name,
    change: step.change,
  })),
  totalLabel: "Net",
  showValues: true,
  formatValue: (value) => `${value < 0 ? "−" : ""}$${Math.abs(value) / 1000}k`,
};
export const intervalProps: IntervalChartProps = {
  ...shipmentTimelineExample,
  option: {
    ...withoutSeries(shipmentTimelineExample.option),
    tooltip: { trigger: "item" },
  },
  intervalSeries: {
    markLine: (shipmentTimelineExample.option.series as BarSeriesOption[])[1]
      .markLine,
  },
  intervals: trackingIntervals.map((interval) => ({
    id: interval.id,
    row: interval.label,
    label: interval.evidence,
    start: interval.start,
    end: interval.end,
    itemStyle: {
      color: interval.color,
      opacity: interval.id === "arrival" ? 0.45 : 1,
      borderColor: interval.color,
      borderWidth: 2,
      borderType:
        interval.id === "arrival" || interval.id === "gap" ? "dashed" : "solid",
    },
  })),
};
export const warehouseIntervalProps: IntervalChartProps = {
  ...warehouseProgressExample,
  option: {
    ...withoutSeries(warehouseProgressExample.option),
    legend: { show: false },
    tooltip: { trigger: "item" },
  },
  intervalSeries: {
    markLine: (warehouseProgressExample.option.series as BarSeriesOption[])[3]
      .markLine,
  },
  intervals: warehouseProgress.flatMap((parcel) => [
    {
      id: parcel.id,
      row: `${parcel.origin}\n${parcel.id}`,
      label: "Observed span",
      start: parcel.accepted,
      end: parcel.last,
      itemStyle: {
        color: parcel.delivered
          ? visualizationColors.tertiary
          : visualizationColors.primary,
      },
    },
    ...(parcel.low === null
      ? []
      : [
          {
            id: `${parcel.id}-prediction`,
            row: `${parcel.origin}\n${parcel.id}`,
            label: "Arrival window",
            start: parcel.low,
            end: parcel.high,
            itemStyle: {
              color: visualizationColors.secondarySurface,
              borderColor: visualizationColors.secondary,
              borderWidth: 1,
              borderType: "dashed" as const,
            },
          },
        ]),
  ]),
};
