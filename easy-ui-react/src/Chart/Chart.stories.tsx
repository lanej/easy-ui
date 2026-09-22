import React, { useState } from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { Chart } from "./Chart";
import { ChartSurface } from "./ChartSurface";
import { ChartProvider } from "./ChartProvider";
import { ChartHeading } from "./ChartHeading";
import { ChartZoomControls } from "./ChartZoomControls";
import { ChartDataView } from "./ChartDataView";
import type { ChartZoomState, ChartLegendState } from "./types";
import {
  timeSeriesExample,
  areaExample,
  barExample,
  scatterExample,
  sankeyExample,
  heatmapExample,
  stackedBarExample,
  donutExample,
  treemapExample,
  allExamples,
} from "./Chart.examples";
import {
  extensionExamples,
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
import styles from "./examples.module.scss";
import { RichChartDataExample } from "./RichDataTable.examples";

const meta: Meta<typeof Chart> = {
  title: "Components/Chart",
  component: Chart,
  excludeStories: ["AnalyticalExamples", "AnalyticalExtensions"],
};
export default meta;
type Story = StoryObj<typeof Chart>;

export const RichDataTable: Story = { render: () => <RichChartDataExample /> };

export const TimeSeries: Story = { args: timeSeriesExample };
export const Area: Story = { args: areaExample };
export const GroupedBars: Story = { args: barExample };
export const StackedBars: Story = { args: stackedBarExample };
export const ScatterAndBubble: Story = { args: scatterExample };
export const Sankey: Story = { args: sankeyExample };
export const Heatmap: Story = { args: heatmapExample };
export const Donut: Story = { args: donutExample };
export const Treemap: Story = { args: treemapExample };
export const Loading: Story = {
  args: { ...timeSeriesExample, status: "loading" },
};
export const NoData: Story = {
  args: { ...timeSeriesExample, status: "empty" },
};
export const Error: Story = {
  args: { ...timeSeriesExample, status: "error", onRetry: () => undefined },
};
export const PartialData: Story = {
  args: {
    ...timeSeriesExample,
    notice:
      "Partial coverage: Carrier A has no observation on Aug 9. Other observations are available.",
  },
};
export const Canvas: Story = {
  args: { ...scatterExample, renderer: "canvas" },
};

export const ExternalComposition: Story = {
  render: () => (
    <ChartProvider>
      <ChartHeading
        title="Application-owned shipping report"
        titleId="shipping-report"
        description="The application places its controls and exact data beside the plot."
      />
      <ChartZoomControls />
      <ChartSurface
        option={timeSeriesExample.option}
        aria-labelledby="shipping-report"
        aria-describedby="shipping-data"
        typography={{ label: 14, legend: 14 }}
      />
      <ChartDataView
        id="shipping-data"
        title="Exact daily counts"
        dataTable={timeSeriesExample.dataTable}
      />
    </ChartProvider>
  ),
};

function CoordinatedChartsExample() {
  const [zoomState, setZoom] = useState<ChartZoomState[]>([
    { index: 0, start: 0, end: 100 },
  ]);
  const [legendState, setLegend] = useState<ChartLegendState[]>([
    { index: 0, selected: {} },
  ]);
  return (
    <div className={styles.gallery}>
      {["Shared window A", "Shared window B"].map((title) => (
        <Chart
          key={title}
          {...timeSeriesExample}
          title={title}
          zoomState={zoomState}
          legendState={legendState}
          onZoomChange={setZoom}
          onLegendChange={setLegend}
        />
      ))}
    </div>
  );
}

export const CoordinatedCharts: Story = {
  render: () => <CoordinatedChartsExample />,
};

export const DescriptionWithoutTitle: Story = {
  args: {
    ...timeSeriesExample,
    title: undefined,
    "aria-label": "Daily shipment counts",
  },
};

export function AnalyticalExamples({
  renderer = "svg",
}: { renderer?: "svg" | "canvas" } = {}) {
  const [selection, setSelection] = useState<string | null>(null);
  return (
    <div className={styles.gallery}>
      {allExamples.map((example, index) => (
        <div
          key={example.title}
          className={index === 0 ? styles.wide : undefined}
        >
          <Chart
            {...example}
            renderer={renderer}
            {...(example === scatterExample
              ? {
                  onSelect: (selected) => setSelection(selected.name),
                  onRowSelect: setSelection,
                  notice: selection
                    ? `Selected cohort: ${selection}`
                    : "Select a bubble or table row to inspect a cohort.",
                }
              : {})}
          />
        </div>
      ))}
    </div>
  );
}
export const ShippingAnalytics: Story = {
  render: () => <AnalyticalExamples />,
};

export const LabeledBars: Story = { args: labeledBarsExample };
export const AnnotatedTimeSeries: Story = { args: annotatedTrendExample };
export const ScenarioResponse: Story = { args: scenarioExample };
export const Histogram: Story = { args: histogramExample };
export const CumulativeDistribution: Story = { args: cumulativeExample };
export const ArrivalSpread: Story = { args: boxPlotExample };
export const PredictionBand: Story = { args: predictionBandExample };
export const ContributionWaterfall: Story = { args: waterfallExample };
export const WeekdayHourHeatmap: Story = { args: periodicHeatmapExample };

export function AnalyticalExtensions({
  renderer = "svg",
}: { renderer?: "svg" | "canvas" } = {}) {
  return (
    <div className={styles.gallery}>
      {extensionExamples.map((example) => (
        <Chart key={example.title} {...example} renderer={renderer} />
      ))}
    </div>
  );
}
export const AnalyticalPatterns: Story = {
  render: () => <AnalyticalExtensions />,
};
