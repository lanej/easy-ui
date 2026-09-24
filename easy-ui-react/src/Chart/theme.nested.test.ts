import { init, setPlatformAPI } from "echarts";
import { themedOption } from "./theme";
import type { ChartOption } from "./types";

setPlatformAPI({ measureText: (text) => ({ width: text.length * 8 }) });
const nested: ChartOption = {
  title: { id: "title", text: "Nested title" },
  legend: { id: "legend" },
  xAxis: { id: "time", type: "category", data: ["A", "B"] },
  yAxis: { type: "value" },
  series: [{ name: "S", type: "bar", data: [1, 2] }],
};

it.each(["timeline", "media"])(
  "applies typography to components introduced in %s options",
  (kind) => {
    const option: ChartOption =
      kind === "timeline"
        ? { baseOption: { timeline: { data: ["Now"] } }, options: [nested] }
        : {
            baseOption: {},
            media: [{ query: { minWidth: 100 }, option: nested }],
          };
    const themed = themedOption(document.createElement("div"), option, false, {
      label: 24,
      legend: 25,
      title: 30,
    });
    const chart = init(null, undefined, {
      renderer: "svg",
      ssr: true,
      width: 700,
      height: 400,
    });
    try {
      chart.setOption(themed);
      const effective = chart.getOption() as {
        title: { textStyle: { fontSize: number } }[];
        legend: { textStyle: { fontSize: number } }[];
        xAxis: { axisLabel: { fontSize: number } }[];
      };
      expect(effective.title[0].textStyle.fontSize).toBe(30);
      expect(effective.legend[0].textStyle.fontSize).toBe(25);
      expect(effective.xAxis[0].axisLabel.fontSize).toBe(24);
      expect(chart.renderToSVGString()).toContain("24px");
    } finally {
      chart.dispose();
    }
  },
);

it.each(["timeline", "media"])(
  "preserves base and explicit native overrides without injecting palettes into %s",
  (kind) => {
    const base: ChartOption = {
      ...nested,
      color: ["#aa0000"],
      title: { id: "title", textStyle: { fontSize: 40 } },
      xAxis: { id: "time", axisLabel: { fontSize: 31 } },
      legend: { id: "legend", textStyle: { fontSize: 28 } },
      ...(kind === "timeline" ? { timeline: { data: ["Now"] } } : {}),
    };
    const override: ChartOption = {
      ...nested,
      legend: { id: "legend", textStyle: { fontSize: 36 } },
    };
    const option: ChartOption =
      kind === "timeline"
        ? { baseOption: base, options: [override] }
        : {
            baseOption: base,
            media: [{ query: { minWidth: 100 }, option: override }],
          };
    const themed = themedOption(document.createElement("div"), option, false, {
      label: 24,
      title: 30,
      legend: 25,
    });
    const overlay =
      kind === "timeline" ? themed.options![0] : themed.media![0].option;
    expect(overlay?.color).toBeUndefined();
    const chart = init(null, undefined, {
      renderer: "svg",
      ssr: true,
      width: 700,
      height: 400,
    });
    try {
      chart.setOption(themed);
      const effective = chart.getOption() as {
        color: string[];
        title: { textStyle: { fontSize: number } }[];
        legend: { textStyle: { fontSize: number } }[];
        xAxis: { axisLabel: { fontSize: number } }[];
      };
      expect(effective.color).toEqual(["#aa0000"]);
      expect(effective.title[0].textStyle.fontSize).toBe(40);
      expect(effective.legend[0].textStyle.fontSize).toBe(36);
      expect(effective.xAxis[0].axisLabel.fontSize).toBe(31);
    } finally {
      chart.dispose();
    }
  },
);
