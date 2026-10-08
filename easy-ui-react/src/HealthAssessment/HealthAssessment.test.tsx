import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { HealthAssessment } from "./HealthAssessment";

describe("<HealthAssessment />", () => {
  it.each([null, NaN, Infinity, -1])(
    "suppresses a supplied healthy assessment for invalid observation %s",
    (value) => {
      render(
        <HealthAssessment
          health={{ assessment: "healthy", label: "As expected" }}
          observation={{ value, unit: "hours" }}
        />,
      );
      expect(screen.queryByText("As expected")).not.toBeInTheDocument();
      expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
      expect(screen.getAllByText("Unavailable")).toHaveLength(2);
    },
  );

  it("retains zero and the caller assessment without deriving health from duration or freshness", () => {
    render(
      <HealthAssessment
        health={{ assessment: "unhealthy" }}
        observation={{ value: 0, unit: "hours" }}
        freshness={{ state: "stale" }}
      />,
    );
    expect(screen.getByText("0")).toBeVisible();
    expect(screen.getByText("Unhealthy")).toBeVisible();
    expect(screen.getByText("Stale")).toBeVisible();
  });

  it("supports an assessment without a duration observation", () => {
    render(<HealthAssessment health={{ assessment: "healthy" }} />);
    expect(screen.getByText("Healthy")).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Duration" }),
    ).not.toBeInTheDocument();
  });

  it("suppresses previous assessment, observation, and reference while loading", () => {
    const props = {
      health: { assessment: "healthy" as const },
      observation: { value: 6, unit: "hours" },
      reference: "Typical: 9 hours",
    };
    const { rerender } = render(<HealthAssessment {...props} />);
    expect(screen.getByText("Typical: 9 hours")).toBeVisible();
    rerender(<HealthAssessment {...props} isLoading />);
    expect(
      screen.getByRole("group", { name: "Health assessment" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
    expect(screen.queryByText("6")).not.toBeInTheDocument();
    expect(screen.queryByText("Typical: 9 hours")).not.toBeInTheDocument();
  });
});
