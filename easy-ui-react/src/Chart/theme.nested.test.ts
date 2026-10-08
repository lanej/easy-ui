import { init, setPlatformAPI } from "echarts";
import { themedChartTheme, themedOption } from "./theme";
import type { ChartOption } from "./types";
import tokens from "@easypost/easy-ui-tokens/js/tokens";

setPlatformAPI({ measureText: (text) => ({ width: text.length * 8 }) });
const nested: ChartOption = {
  title: { id: "title", text: "Nested title" },
  legend: { id: "legend" },
  xAxis: { id: "time", type: "category", data: ["A", "B"] },
  yAxis: { type: "value" },
  series: [{ name: "S", type: "bar", data: [1, 2] }],
};

it.each(["light", "dark"] as const)(
  "uses resolved %s colors for native title and subtitle defaults",
  (scheme) => {
    const element = document.createElement("div");
    const text = tokens[`theme.${scheme}.color.neutral.800`];
    const muted = tokens[`theme.${scheme}.color.neutral.600`];
    element.style.setProperty("--ezui-color-neutral-800", text);
    element.style.setProperty("--ezui-color-neutral-600", muted);
    document.body.append(element);
    const chart = init(null, themedChartTheme(element), {
      renderer: "svg",
      ssr: true,
      width: 700,
      height: 400,
    });
    try {
      chart.setOption(
        themedOption(
          element,
          { ...nested, title: { text: "Title", subtext: "Subtitle" } },
          false,
        ),
      );
      expect(chart.getOption().title).toMatchObject([
        {
          textStyle: { color: text },
          subtextStyle: { color: muted },
        },
      ]);
    } finally {
      chart.dispose();
      element.remove();
    }
  },
);

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
    const element = document.createElement("div");
    element.style.setProperty("--ezui-color-neutral-800", "#e0e6f0");
    element.style.setProperty("--ezui-color-neutral-600", "#a3b2ce");
    const typography = {
      label: 24,
      legend: 25,
      title: 30,
    };
    const themed = themedOption(element, option, false, typography);
    const chart = init(null, themedChartTheme(element, typography), {
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
      expect(effective.title[0]).toMatchObject({
        textStyle: { color: "#e0e6f0" },
        subtextStyle: { color: "#a3b2ce" },
      });
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
      title: {
        id: "title",
        textStyle: { fontSize: 40, color: "#aa0088" },
        subtextStyle: { color: "#0088aa" },
      },
      xAxis: { id: "time", axisLabel: { fontSize: 31 } },
      legend: { id: "legend", textStyle: { fontSize: 28 } },
      ...(kind === "timeline" ? { timeline: { data: ["Now"] } } : {}),
    };
    const override: ChartOption = {
      ...nested,
      legend: { id: "legend", textStyle: { fontSize: 36 } },
      title: {
        id: "title",
        text: "Nested title",
        subtextStyle: { color: "#006633" },
      },
    };
    const option: ChartOption =
      kind === "timeline"
        ? { baseOption: base, options: [override] }
        : {
            baseOption: base,
            media: [{ query: { minWidth: 100 }, option: override }],
          };
    const element = document.createElement("div");
    const typography = {
      label: 24,
      title: 30,
      legend: 25,
    };
    const themed = themedOption(element, option, false, typography);
    const overlay =
      kind === "timeline" ? themed.options![0] : themed.media![0].option;
    expect(overlay?.color).toBeUndefined();
    const chart = init(null, themedChartTheme(element, typography), {
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
      expect(effective.title[0]).toMatchObject({
        textStyle: { color: "#aa0088" },
        subtextStyle: { color: "#006633" },
      });
      expect(effective.legend[0].textStyle.fontSize).toBe(36);
      expect(effective.xAxis[0].axisLabel.fontSize).toBe(31);
    } finally {
      chart.dispose();
    }
  },
);

it.each(["timeline", "media"])(
  "preserves the matching named title's authored styles in %s",
  (kind) => {
    const base: ChartOption = {
      title: [
        {
          name: "A",
          text: "A",
          textStyle: { color: "#aa0000", fontSize: 31 },
          subtextStyle: { color: "#00aa00" },
        },
        {
          name: "B",
          text: "B",
          textStyle: { color: "#0000aa", fontSize: 37 },
          subtextStyle: { color: "#00aaaa" },
        },
      ],
      ...(kind === "timeline" ? { timeline: { data: ["Now"] } } : {}),
    };
    const override: ChartOption = {
      title: [{ name: "B", text: "B updated" }],
    };
    const option: ChartOption =
      kind === "timeline"
        ? { baseOption: base, options: [override] }
        : {
            baseOption: base,
            media: [{ query: { minWidth: 100 }, option: override }],
          };
    const element = document.createElement("div");
    const chart = init(null, themedChartTheme(element), {
      renderer: "svg",
      ssr: true,
      width: 700,
      height: 400,
    });
    try {
      chart.setOption(themedOption(element, option, false));
      expect(chart.getOption().title).toMatchObject([
        { text: "A", textStyle: { color: "#aa0000", fontSize: 31 } },
        {
          text: "B updated",
          textStyle: { color: "#0000aa", fontSize: 37 },
          subtextStyle: { color: "#00aaaa" },
        },
      ]);
    } finally {
      chart.dispose();
    }
  },
);

it.each([true, false])(
  "preserves colors from an earlier active media rule (base title: %s)",
  (hasBaseTitle) => {
    const option: ChartOption = {
      baseOption: hasBaseTitle
        ? {
            title: {
              id: "t",
              text: "Base",
              textStyle: { color: "#0000aa" },
            },
          }
        : {},
      media: [
        {
          query: { maxWidth: 1000 },
          option: {
            title: {
              id: "t",
              text: "First rule",
              textStyle: { color: "#aa0000" },
              subtextStyle: { color: "#00aa00" },
            },
          },
        },
        {
          query: { minWidth: 500 },
          option: { title: { id: "t", text: "Changed text only" } },
        },
      ],
    };
    const element = document.createElement("div");
    const chart = init(null, themedChartTheme(element), {
      renderer: "svg",
      ssr: true,
      width: 700,
      height: 400,
    });
    try {
      chart.setOption(themedOption(element, option, false));
      expect(chart.getOption().title).toMatchObject([
        {
          text: "Changed text only",
          textStyle: { color: "#aa0000" },
          subtextStyle: { color: "#00aa00" },
        },
      ]);
    } finally {
      chart.dispose();
    }
  },
);

it("updates default title colors without replacing authored colors on theme changes", () => {
  const element = document.createElement("div");
  document.body.append(element);
  element.style.setProperty("--ezui-color-neutral-800", "#112233");
  element.style.setProperty("--ezui-color-neutral-600", "#445566");
  const chart = init(null, themedChartTheme(element), {
    renderer: "svg",
    ssr: true,
    width: 700,
    height: 400,
  });
  const option: ChartOption = {
    title: [
      { text: "Default", subtext: "Default subtitle" },
      {
        text: "Authored",
        textStyle: { color: "#aa0000" },
        subtextStyle: { color: "#00aa00" },
      },
    ],
  };
  try {
    chart.setOption(themedOption(element, option, false));
    element.style.setProperty("--ezui-color-neutral-800", "#e0e6f0");
    element.style.setProperty("--ezui-color-neutral-600", "#a3b2ce");
    chart.setTheme(themedChartTheme(element), { silent: true });
    chart.setOption(themedOption(element, option, false), { notMerge: true });
    expect(chart.getOption().title).toMatchObject([
      {
        textStyle: { color: "#e0e6f0" },
        subtextStyle: { color: "#a3b2ce" },
      },
      {
        textStyle: { color: "#aa0000" },
        subtextStyle: { color: "#00aa00" },
      },
    ]);
  } finally {
    chart.dispose();
    element.remove();
  }
});
