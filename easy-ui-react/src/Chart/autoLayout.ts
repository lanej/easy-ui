import type { ChartOption } from "./types";
import type { ChartLegendItem } from "./ChartLegend";

type AutomaticLayout = {
  entries: (Pick<ChartLegendItem, "name" | "symbol"> & {
    seriesIndex: number;
  })[];
  interactive: boolean;
  option: ChartOption;
};

/** Only supply layout for ordinary, unpositioned Cartesian charts. Native
 * geometry, formatting, multiple panels and non-Cartesian keys stay engine-owned.
 */
export function automaticChartLayout(
  option: ChartOption,
): AutomaticLayout | null {
  if (
    option.grid ||
    option.baseOption ||
    option.media ||
    option.options ||
    option.title ||
    option.toolbox ||
    option.graphic ||
    option.dataZoom ||
    option.visualMap ||
    !option.xAxis ||
    Array.isArray(option.xAxis) ||
    !option.yAxis ||
    Array.isArray(option.yAxis) ||
    !option.legend ||
    Array.isArray(option.legend) ||
    option.legend.show === false ||
    Object.keys(option.legend).some(
      (key) =>
        !["id", "data", "selected", "selectedMode", "show"].includes(key),
    )
  )
    return null;
  const series = Array.isArray(option.series)
    ? option.series
    : option.series
      ? [option.series]
      : [];
  if (
    !series.length ||
    (Array.isArray(option.color) &&
      option.color.some((color) => typeof color !== "string")) ||
    series.some(
      (item) =>
        !["bar", "line", "scatter"].includes(item.type ?? "") ||
        ("coordinateSystem" in item &&
          item.coordinateSystem &&
          item.coordinateSystem !== "cartesian2d") ||
        item.colorBy === "data" ||
        ("itemStyle" in item &&
          item.itemStyle?.color !== undefined &&
          typeof item.itemStyle.color !== "string"),
    )
  )
    return null;
  const names = option.legend.data ?? series.map((item) => item.name);
  const entries: AutomaticLayout["entries"] = [];
  for (const name of names) {
    if (typeof name !== "string" || !name) return null;
    const seriesIndex = series.findIndex((item) => item.name === name);
    if (seriesIndex < 0) return null;
    if (!entries.some((entry) => entry.name === name))
      entries.push({
        name,
        seriesIndex,
        symbol:
          series[seriesIndex].type === "scatter"
            ? "circle"
            : series[seriesIndex].type === "line"
              ? "line"
              : "bar",
      });
  }
  if (!entries.length) return null;
  return {
    entries,
    interactive: option.legend.selectedMode !== false,
    option: {
      ...option,
      // ECharts still owns selection and filtering; HTML owns legend layout.
      legend: { ...option.legend, show: false },
      grid: {
        left: 0,
        right: 0,
        top: 24,
        bottom: 8,
        outerBoundsMode: "same",
        outerBoundsContain: "all",
      },
      yAxis:
        option.yAxis.type === "value"
          ? {
              splitNumber: 4,
              ...option.yAxis,
              axisLabel: { margin: 8, ...option.yAxis.axisLabel },
            }
          : option.yAxis,
    } satisfies ChartOption,
  };
}
