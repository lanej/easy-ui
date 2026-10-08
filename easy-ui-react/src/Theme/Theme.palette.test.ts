import tokens from "@easypost/easy-ui-tokens/js/tokens";

const paletteTokens: Record<string, string | number> = tokens;

function luminance(color: string) {
  const channels = color
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => {
      const normalized = parseInt(channel, 16) / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
  if (!channels || channels.length !== 3)
    throw new Error(`Expected a hex color: ${color}`);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("Default theme contrast", () => {
  it.each(["light", "dark"])(
    "keeps text and status fills readable in %s mode",
    (scheme) => {
      const color = (alias: string) =>
        String(paletteTokens[`theme.${scheme}.color.${alias}`]);
      for (const [foreground, background] of [
        ["neutral.900", "neutral.000"],
        ["neutral.600", "neutral.000"],
        ["neutral.600", "neutral.050"],
        ["primary.700", "primary.050"],
        ["neutral.000", "primary.500"],
        ["text.on-status", "positive.500"],
        ["text.on-status", "negative.500"],
        ["text.on-warning", "warning.500"],
        ["text.on-warning", "warning.300"],
        ["text.on-status", "warning.300"],
      ]) {
        expect(
          contrast(color(foreground), color(background)),
          `${scheme}: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
