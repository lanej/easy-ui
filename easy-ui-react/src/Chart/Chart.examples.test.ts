import { color, init, setPlatformAPI } from "echarts";
import type { HeatmapSeriesOption, VisualMapComponentOption } from "echarts";
import { themedOption } from "./theme";
import tokens from "@easypost/easy-ui-tokens/js/tokens";

// Deterministic text metrics for SVG topology checks; browser captures verify typography.
beforeAll(() => {
  setPlatformAPI({ measureText: (text) => ({ width: text.length * 7 }) });
});
import {
  allExamples,
  sankeyExample,
  heatmapExample,
  timeSeriesExample,
  treemapExample,
} from "./Chart.examples";

import { extensionExamples, periodicHeatmapExample } from "./Chart.extensions";

it.each(["light", "dark"] as const)(
  "keeps treemap group and cell labels readable in %s mode",
  (scheme) => {
    const element = document.createElement("div");
    for (const name of [
      "primary.600",
      "secondary.600",
      "positive.700",
      "neutral.000",
    ] as const) {
      element.style.setProperty(
        `--ezui-color-${name.replace(".", "-")}`,
        tokens[`theme.${scheme}.color.${name}`],
      );
    }
    document.body.append(element);
    try {
      const option = themedOption(element, treemapExample.option, false);
      const series = (
        option.series as {
          label: { color: string };
          upperLabel: { color: string };
          data: { itemStyle: { color: string; borderColor: string } }[];
        }[]
      )[0];
      const luminance = (value: string) =>
        color
          .parse(value)!
          .slice(0, 3)
          .reduce((sum, channel, index) => {
            const normalized = channel / 255;
            const linear =
              normalized <= 0.04045
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
            return sum + linear * [0.2126, 0.7152, 0.0722][index];
          }, 0);
      for (const origin of series.data) {
        expect(origin.itemStyle.borderColor).toBe(origin.itemStyle.color);
        for (const label of [series.label, series.upperLabel]) {
          const values = [
            luminance(origin.itemStyle.color),
            luminance(label.color),
          ].sort((first, second) => first - second);
          expect(
            (values[1] + 0.05) / (values[0] + 0.05),
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    } finally {
      element.remove();
    }
  },
);

// Axe cannot reliably resolve SVG text backgrounds. Use the renderer's color
// interpolation to check every labeled cell against its actual scale color.
it.each([heatmapExample, periodicHeatmapExample])(
  "keeps every $title cell label above 4.5:1 contrast",
  (example) => {
    const scale = example.option.visualMap as VisualMapComponentOption;
    const series = (example.option.series as HeatmapSeriesOption[])[0];
    const luminance = (css: string) => {
      const channels = color.parse(css)!;
      return channels.slice(0, 3).reduce((sum, channel, index) => {
        const value = channel / 255;
        const linear =
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        return sum + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0);
    };
    for (const cell of series.data as {
      value: number[];
      label: { color: string };
    }[]) {
      const fraction =
        (cell.value[2] - Number(scale.min)) /
        (Number(scale.max) - Number(scale.min));
      const background = color.lerp(fraction, scale.inRange!.color!) as string;
      const values = [luminance(cell.label.color), luminance(background)].sort(
        (a, b) => a - b,
      );
      expect((values[1] + 0.05) / (values[0] + 0.05)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  },
);

it.each(
  [...allExamples, ...extensionExamples].map(
    (example) => [example.title, example] as const,
  ),
)("renders %s with the real ECharts SVG renderer", (_title, example) => {
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 720,
    height: 360,
  });
  try {
    chart.setOption(
      themedOption(document.createElement("div"), example.option, false),
    );
    const svg = chart.renderToSVGString();
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
    expect(svg).not.toMatch(/(?:NaN|Infinity)/);
  } finally {
    chart.dispose();
  }
});

it("balances Sankey inflows and outflows at each carrier", () => {
  for (const name of ["Carrier A", "Carrier B", "Carrier C"]) {
    const incoming = sankeyExample.dataTable.rows
      .filter(({ values }) => values[1] === name)
      .reduce((sum, { values }) => sum + Number(values[2]), 0);
    const outgoing = sankeyExample.dataTable.rows
      .filter(({ values }) => values[0] === name)
      .reduce((sum, { values }) => sum + Number(values[2]), 0);
    expect(incoming).toBe(outgoing);
    expect(incoming).toBeGreaterThan(0);
  }
});

it("keeps missing observations explicit in both temporal and matrix tables", () => {
  expect(
    timeSeriesExample.dataTable.rows.some(({ values }) =>
      values.includes(null),
    ),
  ).toBe(true);
  expect(heatmapExample.dataTable.rows).toHaveLength(16);
  expect(
    heatmapExample.dataTable.rows.filter(({ values }) => values[2] === null),
  ).toHaveLength(1);
});
