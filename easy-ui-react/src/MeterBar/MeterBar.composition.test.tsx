import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { ProportionBar } from "../ProportionBar";
import { RiskScore } from "../RiskScore";

it.each([
  ["low", "success"],
  ["medium", "warning"],
  ["high", "danger"],
  [null, "neutral"],
] as const)("maps the supplied %s assessment to the shared bar", (assessment, tone) => {
  const { container } = render(
    <RiskScore value={12} assessment={assessment} />,
  );
  expect(container.querySelectorAll("[role=meter]")).toHaveLength(1);
  expect(container.querySelectorAll("[data-meter-bar]")).toHaveLength(1);
  expect(container.querySelector("[data-meter-bar]")).toHaveAttribute(
    "data-tone",
    tone,
  );
  expect(container.querySelector("[data-meter-bar]")).toHaveAttribute(
    "data-thickness",
    "sm",
  );
  expect(screen.getByRole("meter").getAttribute("aria-valuetext")).not.toContain("%");
});

it.each(["compact", "expanded", "bar"] as const)(
  "uses the shared bar without nesting meters in %s proportions",
  (presentation) => {
    const { container } = render(
      <ProportionBar
        label="Affected records"
        value={1184}
        total={1659}
        tone="warning"
        presentation={presentation}
      />,
    );
    expect(container.querySelectorAll("[role=meter]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-meter-bar]")).toHaveLength(1);
    expect(container.querySelector("[data-meter-bar]")).toHaveAttribute(
      "data-thickness",
      presentation === "expanded" ? "lg" : "md",
    );
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "71.4% (1,184 / 1,659)",
    );
  },
);

it("keeps risk formatting separate from fill geometry and showBar", () => {
  const props = {
    value: 0.18765,
    max: 1,
    assessment: "high" as const,
    formatValue: (value: number) => value.toFixed(2),
  };
  const { container, rerender } = render(<RiskScore {...props} />);
  const fill = container.querySelector<HTMLElement>("[data-meter-fill]");
  expect(parseFloat(fill!.style.inlineSize)).toBeCloseTo(18.765, 10);
  expect(screen.getByText("0.19")).toBeVisible();
  const description = screen.getByRole("meter").getAttribute("aria-valuetext");
  rerender(<RiskScore {...props} showBar={false} />);
  expect(container.querySelector("[data-meter-bar]")).toBeNull();
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", description);
});

it.each([
  [null, 100, false],
  [72, 100, true],
  [101, 100, false],
  [0, 0, false],
] as const)("retains each molecule's non-valid states for %s / %s", (value, max, isLoading) => {
  const { container } = render(
    <>
      <RiskScore value={value} max={max} isLoading={isLoading} />
      <ProportionBar
        label="Share"
        value={value}
        total={max}
        isLoading={isLoading}
      />
    </>,
  );
  expect(container.querySelectorAll("[data-meter-bar]")).toHaveLength(0);
  expect(container.querySelectorAll("[role=meter]")).toHaveLength(0);
  if (isLoading) {
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByText("Scoring…")).toBeVisible();
    expect(screen.getByText("Loading…")).toBeVisible();
  } else {
    expect(screen.getByText("Not scored")).toBeVisible();
    expect(screen.getByText(max === 0 ? "No population" : value === null ? "No data" : "Invalid proportion")).toBeVisible();
  }
});
