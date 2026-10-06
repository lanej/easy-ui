import { merge } from "lodash";
import type { ChartOption } from "./types";
import {
  resolveVisualizationColor,
  resolveVisualizationColors,
  visualizationColors,
  visualizationPalette,
} from "../visualization/colors";
import {
  resolveVisualizationTypography,
  VisualizationTypography,
} from "../visualization/typography";

/** Read resolved CSS values so nested Easy UI themes also style SVG/canvas. */
export function themedOption(
  element: HTMLElement,
  option: ChartOption,
  reducedMotion: boolean,
  typography?: VisualizationTypography,
): ChartOption {
  const sizes = resolveVisualizationTypography(typography);
  const css = getComputedStyle(element);
  const text = resolveVisualizationColor(css, visualizationColors.text);
  const muted = resolveVisualizationColor(css, visualizationColors.muted);
  const line = resolveVisualizationColor(css, visualizationColors.border);
  const axis = {
    axisLabel: {
      color: muted,
      hideOverlap: true,
      margin: 12,
      fontSize: sizes.label,
      lineHeight: sizes.label * 1.5,
    },
    nameTextStyle: { color: muted, fontSize: sizes.label },
    axisLine: { lineStyle: { color: line } },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: line } },
  };
  const defaults = {
    animation: false,
    backgroundColor: "transparent",
    textStyle: {
      fontFamily: css.fontFamily || "sans-serif",
      color: text,
      fontSize: sizes.label,
      lineHeight: sizes.label * 1.5,
    },
    color: resolveVisualizationColors({ color: visualizationPalette }, css)
      .color,
    legend: { textStyle: { color: text, fontSize: sizes.legend } },
    tooltip: {
      confine: true,
      renderMode: "richText",
      backgroundColor: resolveVisualizationColor(
        css,
        visualizationColors.background,
      ),
      borderColor: line,
      textStyle: { color: text, fontSize: sizes.detail },
    },
  };

  // Copy only defaulted style fields from an inherited component. Copying whole base
  // components into media/timeline overrides could reset data, selections or palettes.
  const inheritedDefaults = (policy: object, inherited?: object): object =>
    Object.fromEntries(
      Object.entries(policy).map(([key, fallback]) => {
        const authored = (inherited as Record<string, unknown> | undefined)?.[
          key
        ];
        return [
          key,
          authored === undefined
            ? fallback
            : fallback &&
                typeof fallback === "object" &&
                authored &&
                typeof authored === "object"
              ? inheritedDefaults(fallback, authored)
              : authored,
        ];
      }),
    );
  const withDefaults = <T extends { id?: string | number }>(
    value: T | T[] | undefined,
    policy: object,
    inherited?: T | T[],
  ) => {
    if (!value) return undefined;
    const base = inherited
      ? Array.isArray(inherited)
        ? inherited
        : [inherited]
      : [];
    const decorate = (item: T, index: number) => {
      const previous =
        item.id === undefined
          ? base[index]
          : base.find((candidate) => String(candidate.id) === String(item.id));
      return merge({}, inheritedDefaults(policy, previous), item);
    };
    return Array.isArray(value) ? value.map(decorate) : decorate(value, 0);
  };
  const decorate = (
    input: ChartOption,
    inherited?: ChartOption,
    overlay = false,
  ): ChartOption => {
    const result = merge({}, overlay ? {} : defaults, input) as ChartOption;
    // A supplied palette replaces the default, including an explicitly empty array.
    if (input.color !== undefined)
      result.color = Array.isArray(input.color)
        ? [...input.color]
        : input.color;
    if (input.xAxis)
      result.xAxis = withDefaults(input.xAxis, axis, inherited?.xAxis);
    if (input.yAxis)
      result.yAxis = withDefaults(input.yAxis, axis, inherited?.yAxis);
    if (input.legend)
      result.legend = withDefaults(
        input.legend,
        defaults.legend,
        inherited?.legend,
      );
    if (input.visualMap)
      result.visualMap = withDefaults(
        input.visualMap,
        { textStyle: { color: text, fontSize: sizes.label } },
        inherited?.visualMap,
      );
    if (input.tooltip)
      result.tooltip = merge(
        {},
        inheritedDefaults(defaults.tooltip, inherited?.tooltip as object),
        input.tooltip,
      );
    if (input.title)
      result.title = withDefaults(
        input.title,
        {
          textStyle: { fontSize: sizes.title },
          subtextStyle: { fontSize: sizes.description },
        },
        inherited?.title,
      );
    if (input.dataZoom)
      result.dataZoom = withDefaults(
        input.dataZoom,
        { textStyle: { fontSize: sizes.label } },
        inherited?.dataZoom,
      );
    if (input.textStyle)
      result.textStyle = merge(
        {},
        inheritedDefaults(defaults.textStyle, inherited?.textStyle),
        input.textStyle,
      );
    if (input.baseOption)
      result.baseOption = decorate(input.baseOption as ChartOption);
    const base = (result.baseOption ?? result) as ChartOption;
    if (input.media)
      result.media = input.media.map((media) => ({
        ...media,
        option: media.option
          ? decorate(media.option as ChartOption, base, true)
          : media.option,
      }));
    if (input.options)
      result.options = input.options.map((frame) =>
        decorate(frame as ChartOption, base, true),
      );
    return result;
  };
  const result = resolveVisualizationColors(decorate(option), css);
  if (reducedMotion) disableAnimation(result);
  return result;
}

function disableAnimation(option: ChartOption) {
  option.animation = false;
  const series = Array.isArray(option.series)
    ? option.series
    : option.series
      ? [option.series]
      : [];
  for (const item of series) item.animation = false;
  if (option.baseOption) disableAnimation(option.baseOption as ChartOption);
  for (const media of option.media ?? [])
    if (media.option) disableAnimation(media.option as ChartOption);
  for (const frame of option.options ?? [])
    disableAnimation(frame as ChartOption);
}
