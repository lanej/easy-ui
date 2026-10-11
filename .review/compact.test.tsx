import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { RiskScore, type RiskScoreAssessment } from "./RiskScore";
import pillStyles from "../Pill/Pill.module.scss";

it.each([
  ["low", "Low risk", "positive.800"],
  ["medium", "Medium risk", "warning.800"],
  ["high", "High risk", "negative.800"],
  [null, "Not assessed", "neutral.900"],
] as const)("colors the compact score by the supplied %s assessment without a pill", (assessment, label, color) => {
  const { container } = render(<RiskScore value={12} assessment={assessment} size="sm" />);
  const meter = screen.getByRole("meter");
  expect(container.querySelector(`.${pillStyles.pill}`)).toBeNull();
  expect(screen.getByText("12").style.getPropertyValue("--ezui-c-text-color"))
    .toBe(`var(--ezui-color-${color.replace(".", "-")})`);
  expect(screen.getByText("/ 100").style.getPropertyValue("--ezui-c-text-color"))
    .toBe("var(--ezui-color-neutral-600)");
  expect(meter).toHaveAttribute("title", label);
  expect(meter).toHaveAttribute("aria-valuetext", `12 out of 100; ${label}. Higher scores mean higher risk.`);
  expect(meter).not.toHaveAttribute("tabindex");
  expect(container.querySelectorAll('[role="meter"]')).toHaveLength(1);
});

it("keeps unknown compact assessments neutral and localizes their description", () => {
  render(<RiskScore value={88} size="sm" assessment={"unknown" as RiskScoreAssessment} assessmentLabel="Non évalué" />);
  expect(screen.getByRole("meter")).toHaveAttribute("data-assessment", "unassessed");
  expect(screen.getByRole("meter")).toHaveAttribute("title", "Non évalué");
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "88 out of 100; Non évalué. Higher scores mean higher risk.");
});

it("preserves default-size pills when switching between sizes", () => {
  const { container, rerender } = render(<RiskScore value={72} assessment="high" />);
  expect(container.querySelector(`.${pillStyles.pill}`)).toHaveTextContent("High risk");
  rerender(<RiskScore value={72} assessment="high" size="sm" />);
  expect(container.querySelector(`.${pillStyles.pill}`)).toBeNull();
  rerender(<RiskScore value={72} assessment="high" />);
  expect(container.querySelector(`.${pillStyles.pill}`)).toHaveTextContent("High risk");
  expect(screen.getByRole("meter")).not.toHaveAttribute("title");
});

it.each([null, NaN, Infinity, -1, 101])("keeps an unavailable compact %s explicit without stale score styling", (value) => {
  const { container } = render(<RiskScore value={value} assessment="high" size="sm" assessmentLabel="Old assessment" />);
  expect(screen.getByText("Not scored")).toBeVisible();
  expect(screen.queryByRole("meter")).toBeNull();
  expect(container.querySelector(`.${pillStyles.pill}`)).toBeNull();
  expect(container.querySelector("[data-meter-bar]")).toBeNull();
  expect(screen.getByRole("group")).not.toHaveAttribute("title");
  expect(screen.queryByText("Old assessment")).toBeNull();
});

it("clears and restores compact descriptions across loading, with no invented percentage", () => {
  const { container, rerender } = render(<RiskScore value={0.18} max={1} size="sm" assessment="low" showBar={false} />);
  const description = screen.getByRole("meter").getAttribute("aria-valuetext");
  expect(description).not.toContain("%");
  expect(container.querySelector("[data-meter-bar]")).toBeNull();
  rerender(<RiskScore value={0.18} max={1} size="sm" assessment="low" isLoading loadingLabel="Calcul…" />);
  expect(screen.getByRole("status")).toHaveTextContent("Calcul…");
  expect(screen.queryByText("0.18")).toBeNull();
  expect(screen.getByRole("group")).not.toHaveAttribute("title");
  expect(container.querySelector(`.${pillStyles.pill}`)).toBeNull();
  rerender(<RiskScore value={0.18} max={1} size="sm" assessment="low" />);
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", description);
});

it.each(["sm", "md"] as const)("isolates the entire %s numeric score without reversing the surrounding RTL bar", (size) => {
  const { container } = render(<div dir="rtl"><RiskScore value={72} assessment="high" size={size} /></div>);
  expect(container.querySelector("[data-risk-score-expression]")).toHaveAttribute("dir", "ltr");
  expect(screen.getByRole("meter")).not.toHaveAttribute("dir");
  expect(container.querySelector("[data-meter-bar]")).not.toHaveAttribute("dir");
});
