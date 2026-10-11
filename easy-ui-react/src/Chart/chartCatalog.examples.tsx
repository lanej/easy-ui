import React from "react";
import { Chart, type ChartProps } from "./Chart";
import type { ChartExampleProps } from "./Chart.examples";
import { seriesExample } from "./chartCatalog.fixtures";
import {
  timeSeriesExample,
  areaExample,
  barExample,
  stackedBarExample,
  scatterExample,
  sankeyExample,
  heatmapExample,
  donutExample,
  treemapExample,
} from "./Chart.examples";
import {
  labeledBarsExample,
  annotatedTrendExample,
  scenarioExample,
  histogramExample,
  cumulativeExample,
  boxPlotExample,
  predictionBandExample,
  waterfallExample,
  periodicHeatmapExample,
} from "./Chart.extensions";
import {
  reliabilityExample,
  priceResponseExample,
  capacityExample,
  competitivenessExample,
  shipmentTimelineExample,
  warehouseProgressExample,
} from "./Chart.logistics";
import {
  predictionBandProps,
  waterfallProps,
  intervalProps,
  warehouseIntervalProps,
} from "./patternChart.fixtures";
import { PredictionBandChart } from "../PredictionBandChart";
import { WaterfallChart } from "../WaterfallChart";
import { IntervalChart } from "../IntervalChart";
import { LineChart, type LineChartSeries } from "../LineChart";
import { AreaChart, type AreaChartSeries } from "../AreaChart";
import { BarChart, type BarChartSeries } from "../BarChart";
import {
  StackedBarChart,
  type StackedBarChartSeries,
} from "../StackedBarChart";
import { BubbleChart, type BubbleChartSeries } from "../BubbleChart";
import { SankeyChart, type SankeyChartSeries } from "../SankeyChart";
import { HeatmapChart, type HeatmapChartSeries } from "../HeatmapChart";
import { DonutChart, type DonutChartSeries } from "../DonutChart";
import { TreemapChart, type TreemapChartSeries } from "../TreemapChart";
import { HistogramChart, type HistogramChartSeries } from "../HistogramChart";
import {
  CumulativeDistributionChart,
  type CumulativeDistributionChartSeries,
} from "../CumulativeDistributionChart";
import { BoxPlotChart, type BoxPlotChartSeries } from "../BoxPlotChart";

/** Existing gallery routes now exercise the public components. Story IDs remain stable. */
export function ChartExample({
  example,
  overrides = {},
}: {
  example: ChartExampleProps;
  overrides?: Partial<ChartProps>;
}) {
  const chartProps = { ...example, ...overrides };
  if (
    example === timeSeriesExample ||
    example === annotatedTrendExample ||
    example === scenarioExample ||
    example === reliabilityExample ||
    example === priceResponseExample ||
    example === capacityExample
  )
    return <LineChart {...seriesExample<LineChartSeries>(chartProps)} />;
  if (example === areaExample)
    return <AreaChart {...seriesExample<AreaChartSeries>(chartProps)} />;
  if (example === barExample || example === labeledBarsExample)
    return <BarChart {...seriesExample<BarChartSeries>(chartProps)} />;
  if (example === stackedBarExample)
    return (
      <StackedBarChart {...seriesExample<StackedBarChartSeries>(chartProps)} />
    );
  if (example === scatterExample)
    return <BubbleChart {...seriesExample<BubbleChartSeries>(chartProps)} />;
  if (example === sankeyExample)
    return <SankeyChart {...seriesExample<SankeyChartSeries>(chartProps)} />;
  if (
    example === heatmapExample ||
    example === periodicHeatmapExample ||
    example === competitivenessExample
  )
    return <HeatmapChart {...seriesExample<HeatmapChartSeries>(chartProps)} />;
  if (example === donutExample)
    return <DonutChart {...seriesExample<DonutChartSeries>(chartProps)} />;
  if (example === treemapExample)
    return <TreemapChart {...seriesExample<TreemapChartSeries>(chartProps)} />;
  if (example === histogramExample)
    return (
      <HistogramChart {...seriesExample<HistogramChartSeries>(chartProps)} />
    );
  if (example === cumulativeExample)
    return (
      <CumulativeDistributionChart
        {...seriesExample<CumulativeDistributionChartSeries>(chartProps)}
      />
    );
  if (example === boxPlotExample)
    return <BoxPlotChart {...seriesExample<BoxPlotChartSeries>(chartProps)} />;
  const { series: _series, ...option } = chartProps.option;
  if (example === predictionBandExample)
    return (
      <PredictionBandChart
        {...predictionBandProps}
        {...chartProps}
        option={option}
      />
    );
  if (example === waterfallExample)
    return (
      <WaterfallChart
        {...waterfallProps}
        {...chartProps}
        option={{ ...option, tooltip: { trigger: "item" } }}
      />
    );
  if (example === shipmentTimelineExample)
    return (
      <IntervalChart
        {...intervalProps}
        {...chartProps}
        option={{ ...option, tooltip: { trigger: "item" } }}
      />
    );
  if (example === warehouseProgressExample)
    return (
      <IntervalChart
        {...warehouseIntervalProps}
        {...chartProps}
        option={{
          ...option,
          legend: { show: false },
          tooltip: { trigger: "item" },
        }}
      />
    );
  return <Chart {...chartProps} />;
}
