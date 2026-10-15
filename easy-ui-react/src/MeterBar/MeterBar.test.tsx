import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { MeterBar } from "./MeterBar";

it.each([
  [0, 100, 0],
  [100, 100, 100],
  [0.18765, 1, 18.765],
  [1184, 1659, (1184 / 1659) * 100],
  [1, 10000, 0.01],
  [Number.MAX_VALUE, Number.MAX_VALUE, 100],
])("draws the exact geometry for %s / %s", (value, max, expected) => {
  const { container } = render(<MeterBar value={value} max={max} />);
  const fill = container.querySelector<HTMLElement>("[data-meter-fill]");
  if (fill === null) {
    throw new Error("Expected a meter fill");
  }
  expect(parseFloat(fill.style.inlineSize)).toBeCloseTo(expected, 10);
});

it.each([
  [NaN, 100],
  [Infinity, 100],
  [-Infinity, 100],
  [-1, 100],
  [101, 100],
  [0, 0],
  [1, -1],
  [1, NaN],
  [1, Infinity],
  [1, -Infinity],
])("draws nothing rather than clamping %s / %s", (value, max) => {
  const { container } = render(<MeterBar value={value} max={max} />);
  expect(container.querySelector("[data-meter-bar]")).toBeNull();
});

it("is visual only and does not create duplicate semantics or text", () => {
  const { container } = render(<MeterBar value={72} max={100} />);
  const track = container.querySelector("[data-meter-bar]");
  expect(track).toBeInTheDocument();
  expect(track).toHaveAttribute("aria-hidden", "true");
  expect(track).not.toHaveAttribute("data-color");
  expect(track).toHaveAttribute("data-tone", "neutral");
  expect(track).toHaveAttribute("data-thickness", "md");
  expect(track).toHaveTextContent("");
  expect(container.querySelector("[role], [tabindex]")).toBeNull();
  expect(container.querySelector("[aria-label]")).toBeNull();
  expect(screen.queryByRole("meter")).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
});

it.each(["neutral", "success", "warning", "danger"] as const)(
  "keeps supplied %s styling independent of magnitude",
  (tone) => {
    const { container, rerender } = render(
      <MeterBar value={0} max={100} tone={tone} thickness="sm" />,
    );
    expect(container.querySelector("[data-meter-bar]")).toHaveAttribute(
      "data-tone",
      tone,
    );
    rerender(<MeterBar value={100} max={100} tone={tone} thickness="md" />);
    expect(container.querySelector("[data-meter-bar]")).toHaveAttribute(
      "data-tone",
      tone,
    );
    expect(container.querySelector("[data-meter-bar]")).toHaveAttribute(
      "data-thickness",
      "md",
    );
  },
);
