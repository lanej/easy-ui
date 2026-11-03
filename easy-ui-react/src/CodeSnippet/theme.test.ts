import tokens from "@easypost/easy-ui-tokens/js/tokens";
import { renderHook } from "@testing-library/react";
import { useEasyUiSyntaxHighlighterTheme } from "./theme";

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const rgb = hex.match(/[\da-f]{2}/gi)!.map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("CodeSnippet syntax theme", () => {
  it("uses provider-scoped CSS variables for every foreground", () => {
    const { result } = renderHook(() => useEasyUiSyntaxHighlighterTheme());
    const colors = Object.values(result.current)
      .map((style) => style.color)
      .filter(Boolean);
    expect(colors.length).toBeGreaterThan(10);
    for (const color of colors) {
      expect(color).toMatch(/^var\(--ezui-color-[a-z]+-\d+\)$/);
    }
    expect(
      new Set([
        result.current.property.color,
        result.current.string.color,
        result.current.keyword.color,
        result.current.comment.color,
      ]).size,
    ).toBe(4);
  });

  it.each(["light", "dark"] as const)(
    "keeps all syntax foregrounds readable on the %s code surface",
    (scheme) => {
      const { result } = renderHook(() => useEasyUiSyntaxHighlighterTheme());
      const background = tokens[`theme.${scheme}.color.neutral.000`];
      for (const style of Object.values(result.current)) {
        if (!style.color) continue;
        const alias = String(style.color)
          .replace(/^var\(--ezui-/, "")
          .replace(/\)$/, "")
          .replace(/-/g, ".");
        const key = `theme.${scheme}.${alias}` as keyof typeof tokens;
        expect(tokens[key], key).toBeDefined();
        expect(
          contrast(String(tokens[key]), background),
          key,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
