import React from "react";
import type { SeriesOption } from "echarts";
import { Chart, type ChartProps } from "./Chart";
import type { ChartOption } from "./types";
import { chartDefaults } from "./chartDefaults";

/** Native chart configuration excluding the series owned by the named component. */
export type SeriesChartProps<Series> = Omit<ChartProps, "option"> & {
  /** Native ECharts series; type is supplied by the component. Give series stable IDs. */
  series: readonly Series[];
  /** Native axes, grids, legends, tooltips, zoom, dataset, and media configuration. */
  option?: Omit<ChartOption, "series">;
};

/** Shared composition only; each public entry owns its series type and defaults. */
export function SeriesChart<Series extends Omit<SeriesOption, "type">>({
  series,
  option,
  type,
  defaults,
  ...props
}: SeriesChartProps<Series> & {
  type: SeriesOption["type"];
  defaults?: Partial<Series>;
}) {
  const cartesian =
    ["line", "bar", "scatter", "boxplot"].includes(type ?? "") &&
    series.some((entry) => {
      const coordinateSystem = (entry as { coordinateSystem?: string })
        .coordinateSystem;
      return !coordinateSystem || coordinateSystem === "cartesian2d";
    });
  const configuration = chartDefaults(
    cartesian
      ? {
          xAxis: { type: type === "scatter" ? "value" : "category" },
          yAxis: { type: "value" },
        }
      : {},
    option,
  );
  return (
    <Chart
      {...props}
      option={{
        ...configuration,
        series: series.map((entry) => ({
          ...defaults,
          ...entry,
          type,
        })) as SeriesOption[],
      }}
    />
  );
}
