export type StorybookColorScheme = "system" | "light" | "dark";

const preferenceKey = "easy-ui-storybook-color-scheme";

export function normalizeColorScheme(value: unknown): StorybookColorScheme {
  return value === "light" || value === "dark" ? value : "system";
}

export function readColorScheme(): StorybookColorScheme {
  try {
    return normalizeColorScheme(window.localStorage.getItem(preferenceKey));
  } catch {
    return "system";
  }
}

export function saveColorScheme(value: StorybookColorScheme) {
  try {
    window.localStorage.setItem(preferenceKey, value);
  } catch {
    return;
  }
}

export function resolveColorScheme(value: StorybookColorScheme) {
  return value === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : value;
}
