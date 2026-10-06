import React from "react";
import { Text, type TextProps, type TextColor } from "../Text";

export type SignedValueProps = Omit<TextProps, "children"> & {
  /** Numeric value; formatting remains separate from its sign. */
  value: number;
  /** Defaults to a leading plus for positive values. */
  formatValue?: (value: number) => string;
  /** Opt into sign-based colors; defaults to false. Explicit color takes precedence. */
  colorBySign?: boolean;
  /** Color for positive values; defaults to positive.700. */
  positiveColor?: TextColor;
  /** Color for negative values; defaults to negative.600. */
  negativeColor?: TextColor;
  /** Color for zero or non-finite values; defaults to neutral.800. */
  zeroColor?: TextColor;
};

export function SignedValue({
  value,
  formatValue = (amount) => (amount > 0 ? `+${amount}` : String(amount)),
  colorBySign = false,
  positiveColor = "positive.700",
  negativeColor = "negative.600",
  zeroColor = "neutral.800",
  color,
  ...text
}: SignedValueProps) {
  const signColor =
    Number.isFinite(value) && value !== 0
      ? value > 0
        ? positiveColor
        : negativeColor
      : zeroColor;
  return (
    <Text {...text} color={color ?? (colorBySign ? signColor : undefined)}>
      {formatValue(value)}
    </Text>
  );
}
