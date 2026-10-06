import { create } from "storybook/theming";
import tokens from "../easy-ui-tokens/dist/js/tokens";

export const gridCellSize = 8;
export const backgrounds = { dark: "#131b2a", light: tokens["color.gray.000"] };

function createStorybookTheme(colorScheme: "light" | "dark") {
  const prefix = `theme.${colorScheme}.`;
  const palette = Object.fromEntries(
    Object.entries(tokens)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), String(value)]),
  );
  return create({
    base: colorScheme,
    gridCellSize,
    brandTitle: "EasyPost Easy UI Storybook",
    brandUrl: "./",
    brandImage:
      colorScheme === "dark"
        ? "./easypost-logo-dark.svg"
        : "./easypost-logo.svg?v=20230308",
    brandTarget: "_self",
    appBg: palette["color.neutral.000"],
    appContentBg: palette["color.neutral.000"],
    appPreviewBg: palette["color.neutral.000"],
    appBorderColor: palette["color.neutral.200"],
    appBorderRadius: parseInt(tokens["shape.border_radius.md"], 10),
    colorPrimary: palette["color.primary.500"],
    colorSecondary: palette["color.primary.500"],
    textColor: palette["color.neutral.900"],
    textInverseColor: palette["color.neutral.000"],
    textMutedColor: palette["color.neutral.600"],
    fontBase: 'Poppins, "Poppins Fallback"',
    barTextColor: palette["color.neutral.700"],
    barSelectedColor: palette["color.primary.500"],
    barBg: palette["color.neutral.050"],
    inputBg: palette["color.neutral.050"],
    inputBorder: palette["color.neutral.300"],
    inputTextColor: palette["color.neutral.900"],
    inputBorderRadius: parseInt(tokens["shape.border_radius.md"], 10),
  });
}

export const themes = {
  light: createStorybookTheme("light"),
  dark: createStorybookTheme("dark"),
};
