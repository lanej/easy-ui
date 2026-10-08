import React from "react";
import { render, screen } from "@testing-library/react";
import { SignedValue } from "./SignedValue";
import { getComponentThemeToken } from "../utilities/css";
import type { TextColor } from "../Text";

it.each<[number, string, TextColor]>([
  [25, "+25", "positive.700"],
  [-20, "-20", "negative.600"],
  [0, "0", "neutral.800"],
  [-0, "0", "neutral.800"],
  [NaN, "NaN", "neutral.800"],
  [Infinity, "+Infinity", "neutral.800"],
])("colors %s from its numeric sign", (value, label, token) => {
  render(<SignedValue value={value} colorBySign />);
  expect(screen.getByText(label)).toHaveStyle(
    getComponentThemeToken("text", "color", "color", token),
  );
});

it("supports neutral presentation, custom formatting, inverted semantics and explicit colors", () => {
  const { rerender } = render(<SignedValue value={5} />);
  expect(screen.getByText("+5").getAttribute("style")).toBeFalsy();
  rerender(
    <SignedValue
      value={5}
      formatValue={(value) => `+$${value.toFixed(2)}`}
      colorBySign
      positiveColor="negative.600"
    />,
  );
  expect(screen.getByText("+$5.00")).toHaveStyle(
    getComponentThemeToken("text", "color", "color", "negative.600"),
  );
  rerender(<SignedValue value={5} colorBySign color="primary.600" />);
  expect(screen.getByText("+5")).toHaveStyle(
    getComponentThemeToken("text", "color", "color", "primary.600"),
  );
});
