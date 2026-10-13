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
import type { ChartOption } from "./types";
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
import { LineChart } from "../LineChart";
import { chartDefaults } from "./chartDefaults";

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

it.each(examples)("shares presentation controls through %s", (_name, story) => {
  const Component = story.component as React.ComponentType<
    Record<string, unknown>
  >;
  const table = { columns: ["Value"], rows: [{ id: "a", values: [1] }] };
  const props = {
    title: null,
    description: null,
    "aria-label": "External chart heading",
    variant: "bare",
    showDataTable: false,
    dataTable: table,
    height: 240,
    typography: { label: 14 },
    renderer: "canvas",
    status: "ready",
  };
  render(<Component {...story.args} {...props} />);
  expect(captured.props).toMatchObject(props);
  expect(captured.props!.dataTable).toBe(table);
});

const points = [0, 1].map((x) => ({
  id: String(x),
  x,
  observed: x + 1,
  predicted: x + 2,
  lower: x,
  upper: x + 3,
}));
const steps = [
  { id: "a", label: "Credit", change: 10 },
  { id: "b", label: "Debit", change: -2 },
];
it.each(["root", "baseOption", "media", "timeline"])(
  "uses the effective %s palette for prediction bounds and waterfall directions",
  (kind) => {
    const color = ["#112233", "#445566", "#778899"];
    const option: ChartOption =
      kind === "root"
        ? { color }
        : kind === "baseOption"
          ? { baseOption: { color } }
          : kind === "media"
            ? {
                baseOption: { color: ["#ff0000", "#ff0000", "#ff0000"] },
                media: [
                  { query: { maxWidth: 600 }, option: { color } },
                  { option: { color: ["#ff0000", "#ff0000", "#ff0000"] } },
                ],
              }
            : {
                baseOption: {
                  timeline: {
                    data: ["Now", "Next"],
                    currentIndex: 1,
                    autoPlay: false,
                  },
                  color: ["#ff0000"],
                },
                options: [{ color: ["#ff0000"] }, { color }],
              };
    for (const Component of [PredictionBandChart, WaterfallChart]) {
      render(
        Component === PredictionBandChart ? (
          <PredictionBandChart points={points} option={option} />
        ) : (
          <WaterfallChart steps={steps} option={option} />
        ),
      );
      const chart = init(null, undefined, {
        renderer: "svg",
        ssr: true,
        width: 390,
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
        const series = chart.getOption().series as SeriesOption[];
        const colors = series.map((_series, index) =>
          chart.getVisual({ seriesIndex: index }, "color"),
        );
        expect(colors).toEqual(
          Component === PredictionBandChart
            ? [color[0], color[1], color[1]]
            : color,
        );
        expect(chart.renderToSVGString()).toContain(color[1]);
        if (kind === "media") {
          chart.resize({ width: 720 });
          expect(
            series.map((_series, index) =>
              chart.getVisual({ seriesIndex: index }, "color"),
            ),
          ).toEqual(["#ff0000", "#ff0000", "#ff0000"]);
          chart.resize({ width: 390 });
          expect(
            series.map((_series, index) =>
              chart.getVisual({ seriesIndex: index }, "color"),
            ),
          ).toEqual(
            Component === PredictionBandChart
              ? [color[0], color[1], color[1]]
              : color,
          );
        }
        // The band is below the prediction and legend selection hides both.
        if (Component === PredictionBandChart) {
          chart.dispatchAction({ type: "legendUnSelect", name: "Predicted" });
          expect(chart.renderToSVGString()).not.toContain(
            'fill-opacity="0.18"',
          );
        }
      } finally {
        chart.dispose();
      }
    }
  },
);

it.each([steps.slice(0, 1), steps.slice(1), []].map((steps) => ({ steps })))(
  "keeps waterfall palette roles when one or both directions are absent",
  ({ steps }) => {
    render(
      <WaterfallChart
        steps={steps}
        option={{ color: ["#112233", "#445566", "#778899"] }}
      />,
    );
    const chart = init(null, undefined, {
      renderer: "svg",
      ssr: true,
      width: 720,
      height: 360,
    });
    try {
      chart.setOption(captured.props!.option);
      expect(
        [0, 1, 2].map((seriesIndex) =>
          chart.getVisual({ seriesIndex }, "color"),
        ),
      ).toEqual(["#112233", "#445566", "#778899"]);
    } finally {
      chart.dispose();
    }
  },
);

it("retains explicit pattern colors, and lets the band follow or override the predicted line", () => {
  const predictedSeries = Object.freeze({
    lineStyle: Object.freeze({ color: "#009988" }),
  });
  render(
    <PredictionBandChart points={points} predictedSeries={predictedSeries} />,
  );
  expect(
    (captured.props!.option.series as CustomSeriesOption[])[2].itemStyle,
  ).toMatchObject({ color: "#009988", opacity: 0.18 });
  render(
    <PredictionBandChart
      points={points}
      predictedSeries={predictedSeries}
      bandItemStyle={{ color: "#aa33bb", opacity: 0.3 }}
    />,
  );
  expect(
    (captured.props!.option.series as CustomSeriesOption[])[2].itemStyle,
  ).toMatchObject({ color: "#aa33bb", opacity: 0.3 });
  render(
    <WaterfallChart
      steps={steps}
      increaseItemStyle={{ color: "#009988" }}
      decreaseItemStyle={{ color: "#aa33bb" }}
      totalItemStyle={{ color: "#336699" }}
    />,
  );
  expect(
    (captured.props!.option.series as CustomSeriesOption[]).map(
      (series) => series.itemStyle?.color,
    ),
  ).toEqual(["#009988", "#aa33bb", "#336699"]);
  expect(predictedSeries.lineStyle.color).toBe("#009988");
});

it.each(examples)(
  "renders the public %s API with real ECharts geometry",
  (_name, story) => {
    const Component = story.component as React.ComponentType<
      Record<string, unknown>
    >;
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

it.each(examples)(
  "renders %s series from immutable baseOption with native media overrides",
  (name, story) => {
    const args = story.args as Record<string, unknown>;
    const option = Object.freeze({
      baseOption: Object.freeze((args.option ?? {}) as ChartOption),
      media: [
        {
          query: { maxWidth: 600 },
          option: { textStyle: { fontSize: 15 } },
        },
      ],
    });
    const Component = story.component as React.ComponentType<
      Record<string, unknown>
    >;
    render(<Component {...args} option={option} />);
    const count = Array.isArray(args.series)
      ? args.series.length
      : name === "PredictionBandChart"
        ? 3
        : name === "WaterfallChart"
          ? 3
          : 1;
    for (const width of [720, 390]) {
      const chart = init(null, undefined, {
        renderer: "svg",
        ssr: true,
        width,
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
        expect(chart.getOption().series).toHaveLength(count);
        expect(chart.renderToSVGString()).toContain("<path");
        expect(chart.renderToSVGString()).not.toMatch(/NaN|Infinity/);
        if (width === 390)
          expect(chart.getOption().textStyle).toMatchObject({ fontSize: 15 });
      } finally {
        chart.dispose();
      }
    }
    expect(option.baseOption).not.toHaveProperty("series");
  },
);

it("keeps default axes when a minimal line chart supplies an empty baseOption", () => {
  render(
    <LineChart series={[{ data: [1, 3, 2] }]} option={{ baseOption: {} }} />,
  );
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 720,
    height: 360,
  });
  try {
    chart.setOption(captured.props!.option);
    expect(chart.getOption().series).toHaveLength(1);
    expect(chart.getOption().xAxis).toMatchObject([{ type: "category" }]);
    expect(chart.getOption().yAxis).toMatchObject([{ type: "value" }]);
  } finally {
    chart.dispose();
  }
});

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

it.each(
  examples.filter(([name]) =>
    [
      "LineChart",
      "AreaChart",
      "BarChart",
      "StackedBarChart",
      "ScatterChart",
      "BubbleChart",
      "BoxPlotChart",
      "HistogramChart",
      "CumulativeDistributionChart",
    ].includes(name),
  ),
)("renders %s with only its required series", (_name, story) => {
  const Component = story.component as React.ComponentType<{ series: unknown }>;
  render(<Component series={(story.args as { series: unknown }).series} />);
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 720,
    height: 360,
  });
  try {
    chart.setOption(captured.props!.option);
    expect(chart.renderToSVGString()).toContain("<path");
    expect(chart.renderToSVGString()).not.toMatch(/NaN|Infinity/);
  } finally {
    chart.dispose();
  }
});

it("retains generated categories under partial axis styling without mutating overrides", () => {
  const option = Object.freeze({
    xAxis: Object.freeze({ name: "Time" }),
    yAxis: Object.freeze({
      name: "Lane",
      axisLabel: Object.freeze({ fontSize: 14 }),
    }),
  });
  render(
    <IntervalChart
      intervals={[{ id: "a", row: "Lane A", label: "Span", start: 0, end: 20 }]}
      option={option}
    />,
  );
  expect(captured.props!.option.yAxis).toMatchObject({
    type: "category",
    data: ["Lane A"],
    inverse: true,
    name: "Lane",
    axisLabel: { fontSize: 14 },
  });
  render(
    <WaterfallChart
      steps={[{ id: "a", label: "Credit", change: 10 }]}
      option={{ xAxis: [{ name: "Step" }], grid: { top: 60 } }}
    />,
  );
  expect(captured.props!.option.xAxis).toEqual([
    { type: "category", data: ["Credit", "Total"], name: "Step" },
  ]);
  expect(captured.props!.option.grid).toEqual({ top: 60 });
  const replaced = chartDefaults(
    { xAxis: { type: "category", data: ["a", "b", "c"] } },
    { xAxis: { data: ["replacement"] } },
  );
  expect(replaced.xAxis).toEqual({ type: "category", data: ["replacement"] });
  expect(option.yAxis).not.toHaveProperty("data");
});

it("retains overlapping custom geometry when zoom boundaries cross its endpoints", () => {
  const option = {
    dataZoom: { type: "inside" as const, startValue: 5, endValue: 15 },
  };
  render(
    <IntervalChart
      intervals={[{ id: "a", row: "Lane A", label: "Span", start: 0, end: 20 }]}
      option={option}
    />,
  );
  const intervalOption = captured.props!.option;
  render(
    <PredictionBandChart
      points={[0, 10, 20].map((x) => ({
        id: String(x),
        x,
        observed: x,
        predicted: x,
        lower: x - 2,
        upper: x + 2,
      }))}
      option={option}
    />,
  );
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 720,
    height: 360,
  });
  try {
    chart.setOption(intervalOption);
    expect(chart.renderToSVGString()).toContain('ecmeta_data_index="0"');
    chart.setOption(captured.props!.option, { notMerge: true });
    expect(chart.renderToSVGString()).toContain('fill-opacity="0.18"');
  } finally {
    chart.dispose();
  }
  expect(option.dataZoom).not.toHaveProperty("filterMode");
  expect(
    chartDefaults(
      {},
      {
        dataZoom: [{ type: "inside", filterMode: "none" }, { type: "slider" }],
        media: [{ option: { dataZoom: { type: "inside" } } }],
      },
      true,
    ),
  ).toMatchObject({
    dataZoom: [{ filterMode: "none" }, { filterMode: "weakFilter" }],
    media: [{ option: { dataZoom: { filterMode: "weakFilter" } } }],
  });
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
  const series = props.option.series as CustomSeriesOption[];
  expect(geometry(series[1])).toMatchObject({ shape: { y: -5, height: 15 } });
  expect(props.dataTable!.rows.map((row) => row.values)).toEqual([
    ["Credit", 10, 10],
    ["Debit", -15, -5],
    ["Recovery", 8, 3],
    ["Total", null, 3],
  ]);
  expect(
    series
      .slice(0, 2)
      .flatMap((entry) =>
        (entry.data as { id: string }[]).map((item) => item.id),
      )
      .sort(),
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
  const band = (props.option.series as CustomSeriesOption[]).find(
    (series) => series.id === "prediction-band",
  )!;
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
