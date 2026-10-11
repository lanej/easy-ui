import React from "react";
import { render } from "@testing-library/react";
import { init, setPlatformAPI } from "echarts";
import type {
  SeriesOption,
  CustomSeriesOption,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
} from "echarts";
import type { ChartProps } from "./Chart";
import { themedOption } from "./theme";

const captured = vi.hoisted(() => ({ props: null as ChartProps | null }));
vi.mock("./Chart", () => ({
  Chart: (props: ChartProps) => {
    captured.props = props;
    return null;
  },
}));
import LineChartStories from "../LineChart/LineChart.stories";
import AreaChartStories from "../AreaChart/AreaChart.stories";
import BarChartStories from "../BarChart/BarChart.stories";
import StackedBarChartStories from "../StackedBarChart/StackedBarChart.stories";
import ScatterChartStories from "../ScatterChart/ScatterChart.stories";
import BubbleChartStories from "../BubbleChart/BubbleChart.stories";
import SankeyChartStories from "../SankeyChart/SankeyChart.stories";
import HeatmapChartStories from "../HeatmapChart/HeatmapChart.stories";
import DonutChartStories from "../DonutChart/DonutChart.stories";
import TreemapChartStories from "../TreemapChart/TreemapChart.stories";
import GraphChartStories from "../GraphChart/GraphChart.stories";
import BoxPlotChartStories from "../BoxPlotChart/BoxPlotChart.stories";
import HistogramChartStories from "../HistogramChart/HistogramChart.stories";
import CumulativeDistributionChartStories from "../CumulativeDistributionChart/CumulativeDistributionChart.stories";
import IntervalChartStories from "../IntervalChart/IntervalChart.stories";
import PredictionBandChartStories from "../PredictionBandChart/PredictionBandChart.stories";
import WaterfallChartStories from "../WaterfallChart/WaterfallChart.stories";
import { IntervalChart } from "../IntervalChart";
import { PredictionBandChart } from "../PredictionBandChart";
import { WaterfallChart } from "../WaterfallChart";
import { AreaChart } from "../AreaChart";
import { StackedBarChart } from "../StackedBarChart";

beforeAll(() =>
  setPlatformAPI({ measureText: (text) => ({ width: text.length * 7 }) }),
);
beforeEach(() => {
  captured.props = null;
});
const examples = [
  ["LineChart", LineChartStories],
  ["AreaChart", AreaChartStories],
  ["BarChart", BarChartStories],
  ["StackedBarChart", StackedBarChartStories],
  ["ScatterChart", ScatterChartStories],
  ["BubbleChart", BubbleChartStories],
  ["SankeyChart", SankeyChartStories],
  ["HeatmapChart", HeatmapChartStories],
  ["DonutChart", DonutChartStories],
  ["TreemapChart", TreemapChartStories],
  ["GraphChart", GraphChartStories],
  ["BoxPlotChart", BoxPlotChartStories],
  ["HistogramChart", HistogramChartStories],
  ["CumulativeDistributionChart", CumulativeDistributionChartStories],
  ["IntervalChart", IntervalChartStories],
  ["PredictionBandChart", PredictionBandChartStories],
  ["WaterfallChart", WaterfallChartStories],
] as const;

it.each(examples)(
  "renders the public %s API with real ECharts geometry",
  (_name, story) => {
    const Component = story.component as React.ComponentType<unknown>;
    render(<Component {...story.args} />);
    expect(captured.props).not.toBeNull();
    const chart = init(null, undefined, {
      renderer: "svg",
      ssr: true,
      width: 720,
      height: 360,
    });
    try {
      chart.setOption(
        themedOption(
          document.createElement("div"),
          captured.props!.option,
          false,
        ),
      );
      const svg = chart.renderToSVGString();
      expect(svg).toContain("<path");
      if (_name === "WaterfallChart") expect(svg).toContain("−$9k");
      if (_name === "PredictionBandChart")
        expect(svg).toContain("Forecast starts");
      expect(svg).not.toMatch(/NaN|Infinity/);
    } finally {
      chart.dispose();
    }
  },
);

it("keeps caller data and style immutable and passes interaction/state props through", () => {
  const onSelect = vi.fn();
  const onRowSelect = vi.fn();
  const series = Object.freeze([
    Object.freeze({
      id: "count",
      data: Object.freeze([1, 2]) as unknown as number[],
      areaStyle: { opacity: 0.6 },
    }),
  ]);
  render(
    <AreaChart
      series={series}
      option={{
        xAxis: { type: "category", data: ["a", "b"] },
        yAxis: { type: "value" },
      }}
      onSelect={onSelect}
      onRowSelect={onRowSelect}
      variant="bare"
      status="loading"
    />,
  );
  const props = captured.props!;
  expect(props).toMatchObject({
    onSelect,
    onRowSelect,
    variant: "bare",
    status: "loading",
  });
  expect((props.option.series as SeriesOption[])[0]).toMatchObject({
    type: "line",
    areaStyle: { opacity: 0.6 },
    data: [1, 2],
  });
  expect(series[0]).not.toHaveProperty("type");
  render(
    <StackedBarChart series={[{ data: [2], stack: "application-stack" }]} />,
  );
  expect((captured.props!.option.series as SeriesOption[])[0]).toHaveProperty(
    "stack",
    "application-stack",
  );
});

function geometry(series: CustomSeriesOption, index = 0) {
  const entry = (series.data as { value: number[] }[])[index] as {
    value: number[];
  };
  const api = {
    value: (dimension: number) =>
      (Array.isArray(entry) ? entry : entry.value)[dimension],
    coord: (values: number[]) => values,
    size: () => [1, 1],
    style: () => ({}),
  } as unknown as CustomSeriesRenderItemAPI;
  return series.renderItem!(
    { dataIndex: index } as CustomSeriesRenderItemParams,
    api,
  );
}

it("draws a waterfall debit crossing zero at its actual endpoints and preserves signed exact values", () => {
  render(
    <WaterfallChart
      steps={[
        { id: "a", label: "Credit", change: 10 },
        { id: "b", label: "Debit", change: -15 },
        { id: "c", label: "Recovery", change: 8 },
      ]}
    />,
  );
  const props = captured.props!;
  const series = (props.option.series as CustomSeriesOption[])[0];
  expect(geometry(series, 1)).toMatchObject({ shape: { y: -5, height: 15 } });
  expect(props.dataTable!.rows.map((row) => row.values)).toEqual([
    ["Credit", 10, 10],
    ["Debit", -15, -5],
    ["Recovery", 8, 3],
    ["Total", null, 3],
  ]);
  expect(
    (series.data as { id: string }[])
      .map((item) => (item as { id: string }).id)
      .slice(0, 3),
  ).toEqual(["a", "b", "c"]);
});

it("keeps shared lanes and exact missing endpoints while omitting invalid spans", () => {
  render(
    <IntervalChart
      intervals={[
        { id: "a", row: "Lane", label: "First", start: -5, end: 2 },
        { id: "b", row: "Lane", label: "Second", start: 3, end: 4 },
        {
          id: "missing",
          row: "Unknown",
          label: "Missing",
          start: 5,
          end: null,
        },
        { id: "reversed", row: "Unknown", label: "Reversed", start: 5, end: 4 },
      ]}
    />,
  );
  const props = captured.props!;
  const series = (props.option.series as CustomSeriesOption[])[0];
  expect(series.data).toHaveLength(2);
  expect(geometry(series)).toMatchObject({ shape: { x: -5, width: 7 } });
  expect(props.dataTable!.rows).toHaveLength(4);
  expect(props.dataTable!.rows[2].values).toEqual([
    "Unknown",
    "Missing",
    5,
    null,
  ]);
});

it("renders negative prediction bounds without connecting across missing bounds", () => {
  render(
    <PredictionBandChart
      points={[
        { id: "a", x: 0, observed: null, predicted: 0, lower: -2, upper: 2 },
        { id: "b", x: 1, observed: null, predicted: 1, lower: -1, upper: 3 },
        {
          id: "c",
          x: 2,
          observed: null,
          predicted: 2,
          lower: null,
          upper: null,
        },
        { id: "d", x: 3, observed: null, predicted: 3, lower: 1, upper: 5 },
      ]}
    />,
  );
  const props = captured.props!;
  const band = (props.option.series as CustomSeriesOption[])[0];
  expect(band.data).toHaveLength(1);
  expect(geometry(band)).toMatchObject({
    shape: {
      points: [
        [0, -2],
        [1, -1],
        [1, 3],
        [0, 2],
      ],
    },
  });
  expect(props.dataTable!.rows).toHaveLength(4);
  expect(props.dataTable!.rows[2].values).toEqual([2, null, 2, null, null]);
});
