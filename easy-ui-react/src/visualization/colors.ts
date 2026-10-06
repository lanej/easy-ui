import tokens from "@easypost/easy-ui-tokens/js/tokens";
import { isPlainObject } from "lodash";

export const visualizationColors = {
  primary: "var(--ezui-color-primary-600)",
  secondary: "var(--ezui-color-secondary-600)",
  tertiary: "var(--ezui-color-positive-700)",
  warning: "var(--ezui-color-warning-700)",
  negative: "var(--ezui-color-negative-600)",
  muted: "var(--ezui-color-neutral-600)",
  text: "var(--ezui-color-neutral-800)",
  background: "var(--ezui-color-neutral-000)",
  border: "var(--ezui-color-neutral-200)",
  primarySurface: "var(--ezui-color-primary-100)",
  secondarySurface: "var(--ezui-color-secondary-200)",
};

export const visualizationPalette = [
  visualizationColors.primary,
  visualizationColors.secondary,
  visualizationColors.tertiary,
  visualizationColors.warning,
  visualizationColors.negative,
  visualizationColors.muted,
];

export const sequentialPalette = [
  tokens["color.blue.050"],
  tokens["color.blue.300"],
  tokens["color.blue.600"],
];

export const divergingPalette = [
  tokens["color.blue.300"],
  tokens["color.gray.000"],
  tokens["color.yellow.300"],
];

export function resolveVisualizationColor(
  css: CSSStyleDeclaration,
  value: string,
) {
  const match = /^var\(--ezui-(color-[a-z]+-\d+)\)$/.exec(value);
  if (!match) return value;
  const name = match[1];
  return (
    css.getPropertyValue(`--ezui-${name}`).trim() ||
    tokens[`theme.light.${name.replace(/-/g, ".")}` as keyof typeof tokens] ||
    value
  );
}

export function resolveVisualizationColors<T>(
  value: T,
  css: CSSStyleDeclaration,
  key = "",
): T {
  if (typeof value === "string") {
    return (
      key === "fill" || key === "stroke" || /(?:^color|Color)\d*$/.test(key)
        ? resolveVisualizationColor(css, value)
        : value
    ) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveVisualizationColors(item, css, key)) as T;
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([name, item]) => [
        name,
        name === "source" || name === "value"
          ? item
          : resolveVisualizationColors(item, css, name),
      ]),
    ) as T;
  }
  return value;
}
