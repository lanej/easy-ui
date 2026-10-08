import { addons } from "storybook/manager-api";
import { GLOBALS_UPDATED } from "storybook/internal/core-events";
import {
  normalizeColorScheme,
  readColorScheme,
  resolveColorScheme,
  saveColorScheme,
} from "./colorScheme";
import { themes } from "./theme";

let colorScheme = readColorScheme();

function applyTheme() {
  addons.setConfig({
    panelPosition: "bottom",
    theme: themes[resolveColorScheme(colorScheme)],
  });
}

applyTheme();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", applyTheme);
addons.register("easy-ui/color-scheme", (api) => {
  api.on(
    GLOBALS_UPDATED,
    ({ globals }: { globals: Record<string, unknown> }) => {
      colorScheme = normalizeColorScheme(globals.colorScheme);
      saveColorScheme(colorScheme);
      applyTheme();
    },
  );
});
