import React from "react";
import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { render } from "../utilities/test";
import { RiskScore, RiskScoreAssessment, RiskScoreProps } from "./RiskScore";

describe("<RiskScore />", () => {
  it.each([
    { assessment: "low" as const, label: "Low risk" },
    { assessment: "medium" as const, label: "Medium risk" },
    { assessment: "high" as const, label: "High risk" },
  ])(
    "shows the supplied $assessment assessment with the score and scale",
    ({ assessment, label }) => {
      render(<RiskScore value={48} assessment={assessment} />);

      const meter = screen.getByRole("meter", { name: "Risk score" });
      expect(screen.getByText("48")).toBeVisible();
      expect(screen.getByText("/ 100")).toBeVisible();
      expect(screen.getByText(label)).toBeVisible();
      expect(meter).toHaveAttribute("aria-valuemin", "0");
      expect(meter).toHaveAttribute("aria-valuemax", "100");
      expect(meter).toHaveAttribute("aria-valuenow", "48");
      expect(meter).toHaveAttribute(
        "aria-valuetext",
        `48 out of 100; ${label}. Higher scores mean higher risk.`,
      );
    },
  );

  it("does not replace the caller's assessment with inferred thresholds", () => {
    const { rerender } = render(<RiskScore value={12} assessment="high" />);
    expect(screen.getByText("High risk")).toBeVisible();
    expect(screen.queryByText("Low risk")).not.toBeInTheDocument();

    rerender(<RiskScore value={88} assessment="low" />);
    expect(screen.getByText("Low risk")).toBeVisible();
    expect(screen.queryByText("High risk")).not.toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "88");
  });

  it.each([0, 100])("retains the valid scale endpoint %s", (value) => {
    render(<RiskScore value={value} assessment="low" />);

    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      String(value),
    );
    expect(screen.getByText(String(value))).toBeVisible();
    expect(screen.getByText("/ 100")).toBeVisible();
    expect(screen.queryByText("Not scored")).not.toBeInTheDocument();
  });

  it("formats a custom scale without changing the measured value", () => {
    render(
      <RiskScore
        value={0.18765}
        max={1}
        assessment="low"
        formatValue={(value) => value.toFixed(2)}
      />,
    );

    const meter = screen.getByRole("meter");
    expect(screen.getByText("0.19")).toBeVisible();
    expect(screen.getByText("/ 1.00")).toBeVisible();
    expect(meter).toHaveAttribute("aria-valuenow", "0.18765");
    expect(meter).toHaveAttribute("aria-valuemax", "1");
    expect(meter).toHaveAttribute(
      "aria-valuetext",
      "0.19 out of 1.00; Low risk. Higher scores mean higher risk.",
    );
  });

  it("preserves supplied decimal precision by default", () => {
    render(<RiskScore value={12.34567} assessment="medium" />);

    expect(screen.getByText("12.34567")).toBeVisible();
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      "12.34567",
    );
  });

  it.each([
    { state: "omitted", assessment: undefined },
    { state: "null", assessment: null },
    {
      state: "an unknown runtime value",
      assessment: "critical" as RiskScoreAssessment,
    },
  ])(
    "retains the score without inventing an assessment when it is $state",
    ({ assessment }) => {
      render(<RiskScore value={72} assessment={assessment} />);

      expect(screen.getByText("72")).toBeVisible();
      expect(screen.getByText("Not assessed")).toBeVisible();
      expect(
        screen.queryByText(/^(Low|Medium|High) risk$/),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("meter")).toHaveAttribute(
        "aria-valuetext",
        "72 out of 100; Not assessed. Higher scores mean higher risk.",
      );
    },
  );

  it.each([
    { state: "missing score", value: null, max: 100 },
    { state: "NaN score", value: NaN, max: 100 },
    { state: "infinite score", value: Infinity, max: 100 },
    { state: "negative infinite score", value: -Infinity, max: 100 },
    { state: "negative score", value: -1, max: 100 },
    { state: "score above the scale", value: 101, max: 100 },
    { state: "score above a custom scale", value: 1.01, max: 1 },
    { state: "zero maximum", value: 0, max: 0 },
    { state: "negative maximum", value: 0, max: -1 },
    { state: "NaN maximum", value: 72, max: NaN },
    { state: "infinite maximum", value: 72, max: Infinity },
    { state: "negative infinite maximum", value: 72, max: -Infinity },
  ])(
    "does not present a meter or assessment for a $state",
    ({ value, max }) => {
      render(
        <RiskScore
          value={value}
          max={max}
          assessment="high"
          assessmentLabel="Needs investigation"
          accessibilityValueText="A previous risk assessment"
        />,
      );

      expect(screen.queryByRole("meter")).not.toBeInTheDocument();
      expect(screen.getByText("Not scored")).toBeVisible();
      expect(screen.queryByText("Needs investigation")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/^(Low|Medium|High) risk$/),
      ).not.toBeInTheDocument();
      const group = screen.getByRole("group", { name: "Risk score" });
      expect(group).not.toHaveAttribute("aria-valuenow");
      expect(group).not.toHaveAttribute("aria-valuetext");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );

  it("suppresses a stale score and assessment while loading, then restores them", () => {
    const props: RiskScoreProps = {
      value: 72,
      assessment: "high",
      assessmentLabel: "Needs investigation",
      accessibilityLabel: "Parcel risk",
      accessibilityValueText: "72 out of 100; needs investigation",
    };
    const { rerender } = render(<RiskScore {...props} />);
    expect(screen.getByRole("meter", { name: "Parcel risk" })).toBeVisible();
    expect(screen.getByText("Needs investigation")).toBeVisible();

    rerender(<RiskScore {...props} isLoading />);
    const loading = screen.getByRole("group", { name: "Parcel risk" });
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Scoring…");
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText("72")).not.toBeInTheDocument();
    expect(screen.queryByText("/ 100")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs investigation")).not.toBeInTheDocument();
    expect(loading).not.toHaveAttribute("aria-valuetext");

    rerender(<RiskScore {...props} />);
    const meter = screen.getByRole("meter", { name: "Parcel risk" });
    expect(meter).toHaveAttribute("aria-valuenow", "72");
    expect(meter).toHaveAttribute(
      "aria-valuetext",
      props.accessibilityValueText,
    );
    expect(screen.getByText("72")).toBeVisible();
    expect(screen.getByText("Needs investigation")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("accepts localized assessment and accessible labels", () => {
    const valueText =
      "18 sur 100 ; risque élevé. Un score plus élevé indique un risque plus élevé.";
    render(
      <RiskScore
        value={18}
        assessment="high"
        accessibilityLabel="Risque du colis"
        assessmentLabel="Risque élevé"
        accessibilityValueText={valueText}
      />,
    );

    const meter = screen.getByRole("meter", { name: "Risque du colis" });
    expect(meter).toHaveAttribute("aria-valuenow", "18");
    expect(meter).toHaveAttribute("aria-valuetext", valueText);
    expect(screen.getByText("Risque élevé")).toBeVisible();
    expect(screen.queryByText("High risk")).not.toBeInTheDocument();
  });

  it("accepts localized unavailable and loading labels", () => {
    const props: RiskScoreProps = {
      value: null,
      accessibilityLabel: "Risque du colis",
      emptyLabel: "Score indisponible",
      loadingLabel: "Calcul en cours…",
    };
    const { rerender } = render(<RiskScore {...props} />);
    expect(screen.getByText("Score indisponible")).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Risque du colis" }),
    ).toBeVisible();

    rerender(<RiskScore {...props} isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Calcul en cours…");
    expect(screen.queryByText("Score indisponible")).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("adds no keyboard stops in scored, unavailable, or loading states", async () => {
    vi.useFakeTimers();
    try {
      const { user } = render(
        <>
          <button type="button">Before scores</button>
          <RiskScore value={72} assessment="high" />
          <RiskScore value={null} />
          <RiskScore value={72} assessment="high" isLoading />
          <button type="button">After scores</button>
        </>,
      );

      await user.tab();
      expect(
        screen.getByRole("button", { name: "Before scores" }),
      ).toHaveFocus();
      await user.tab();
      expect(
        screen.getByRole("button", { name: "After scores" }),
      ).toHaveFocus();
      await user.tab({ shift: true });
      expect(
        screen.getByRole("button", { name: "Before scores" }),
      ).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });
});
