import { themedOption } from "./theme";
import tokens from "@easypost/easy-ui-tokens/js/tokens";
import { visualizationColors } from "../visualization/colors";

it("resolves native graphics and candlestick color fields", () => {
  const element = document.createElement("div");
  element.style.setProperty("--ezui-color-primary-600", "#123456");
  document.body.append(element);
  try {
    const result = themedOption(
      element,
      {
        graphic: [
          {
            type: "rect",
            shape: { width: 10, height: 10 },
            style: {
              fill: visualizationColors.primary,
              stroke: visualizationColors.primary,
            },
          },
        ],
        series: [
          {
            type: "candlestick",
            data: [[1, 2, 0, 3]],
            itemStyle: {
              color0: visualizationColors.primary,
              borderColor0: visualizationColors.primary,
            },
          },
        ],
      },
      false,
    );
    expect(result.graphic).toMatchObject([
      { style: { fill: "#123456", stroke: "#123456" } },
    ]);
    expect(result.series).toMatchObject([
      { itemStyle: { color0: "#123456", borderColor0: "#123456" } },
    ]);
  } finally {
    element.remove();
  }
});

it("themes existing visualMap labels without creating components or replacing explicit overrides", () => {
  const element = document.createElement("div");
  element.style.setProperty("--ezui-color-neutral-800", "#abcdef");
  document.body.append(element);
  try {
    expect(themedOption(element, {}, false).visualMap).toBeUndefined();
    const result = themedOption(
      element,
      {
        visualMap: [
          { min: 0, max: 100 },
          { min: 0, max: 1, textStyle: { color: "#aa0088" } },
        ],
      },
      false,
    );
    expect(result.visualMap).toMatchObject([
      { textStyle: { color: "#abcdef" } },
      { textStyle: { color: "#aa0088" } },
    ]);
  } finally {
    element.remove();
  }
});

it.each(["light", "dark"] as const)(
  "uses the %s EasyPost palette for every default series",
  (scheme) => {
    const element = document.createElement("div");
    const names = [
      "primary.600",
      "secondary.600",
      "positive.700",
      "warning.700",
      "negative.600",
      "neutral.600",
    ] as const;
    for (const name of names)
      element.style.setProperty(
        `--ezui-color-${name.replace(".", "-")}`,
        tokens[`theme.${scheme}.color.${name}`],
      );
    document.body.append(element);
    try {
      expect(themedOption(element, {}, false).color).toEqual(
        names.map((name) => tokens[`theme.${scheme}.color.${name}`]),
      );
    } finally {
      element.remove();
    }
  },
);

it("resolves nested color tokens without altering data, callbacks, gradients, or explicit colors", () => {
  const element = document.createElement("div");
  element.style.setProperty("--ezui-color-primary-600", "#123456");
  document.body.append(element);
  const formatter = () => visualizationColors.primary;
  const option = {
    color: [visualizationColors.primary, "#ff0088"],
    dataset: { source: [{ color: visualizationColors.primary }] },
    tooltip: { formatter },
    series: [
      {
        type: "bar" as const,
        data: [
          {
            value: visualizationColors.primary,
            itemStyle: { color: visualizationColors.primary },
          },
        ],
        itemStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: visualizationColors.primary },
              { offset: 1, color: "#ffffff" },
            ],
          },
        },
      },
    ],
    media: [
      {
        query: { maxWidth: 400 },
        option: { color: [visualizationColors.primary] },
      },
    ],
    options: [{ color: [visualizationColors.primary] }],
  };
  try {
    const result = themedOption(element, option, false);
    expect(result.color).toEqual(["#123456", "#ff0088"]);
    expect(result.series).toMatchObject([
      {
        data: [
          {
            value: visualizationColors.primary,
            itemStyle: { color: "#123456" },
          },
        ],
        itemStyle: {
          color: { colorStops: [{ color: "#123456" }, { color: "#ffffff" }] },
        },
      },
    ]);
    expect(result.dataset).toEqual(option.dataset);
    expect(result.tooltip).toMatchObject({ formatter });
    expect(result.media?.[0].option?.color).toEqual(["#123456"]);
    expect(result.options?.[0].color).toEqual(["#123456"]);
    expect(option.series[0].data[0].itemStyle.color).toBe(
      visualizationColors.primary,
    );
  } finally {
    element.remove();
  }
});

it("replaces the default palette with the caller's complete palette without mutating it", () => {
  const element = document.createElement("div");
  const color = Object.freeze(["#ff0000", "#0000ff"]);
  for (const palette of [color, []]) {
    const option = { color: [...palette] };
    expect(themedOption(element, option, false).color).toEqual(palette);
    expect(
      themedOption(element, { baseOption: option }, false).baseOption?.color,
    ).toEqual(palette);
    expect(option.color).toEqual(palette);
  }
  expect(themedOption(element, {}, false).color).toHaveLength(6);
});
