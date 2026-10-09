import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import {
  HealthIndicator,
  type HealthIndicatorAssessment,
} from "./HealthIndicator";

describe("<HealthIndicator />", () => {
  it("names dot states accessibly and suppresses stale assessments", () => {
    const { rerender } = render(
      <HealthIndicator
        variant="dot"
        assessment="healthy"
        label="As expected"
      />,
    );
    expect(screen.getByRole("img", { name: "As expected" })).toHaveAttribute(
      "title",
      "As expected",
    );
    expect(screen.queryByText("As expected")).not.toBeInTheDocument();
    rerender(
      <HealthIndicator
        variant="dot"
        assessment="healthy"
        availability="unavailable"
      />,
    );
    expect(screen.getByRole("img", { name: "Unavailable" })).toBeVisible();
    rerender(<HealthIndicator variant="dot" assessment="healthy" isLoading />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("img", { name: "Assessing…" })).toBeVisible();
  });
  it.each([
    ["healthy", "Healthy"],
    ["degraded", "Degraded"],
    ["unhealthy", "Unhealthy"],
  ] as const)(
    "displays supplied %s assessment as visible text",
    (assessment, label) => {
      render(<HealthIndicator assessment={assessment} />);
      expect(screen.getByText(label)).toBeVisible();
    },
  );

  it.each([undefined, null, "unknown" as HealthIndicatorAssessment])(
    "does not assume health for missing or unknown assessment %s",
    (assessment) => {
      render(<HealthIndicator assessment={assessment} />);
      expect(screen.getByText("Not assessed")).toBeVisible();
      expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
    },
  );

  it("suppresses a previous assessment while unavailable or loading, then restores it", () => {
    const { rerender } = render(
      <HealthIndicator
        assessment="healthy"
        label="As expected"
        accessibilityLabel="Service health"
      />,
    );
    expect(screen.getByText("As expected")).toBeVisible();
    rerender(
      <HealthIndicator
        assessment="healthy"
        label="As expected"
        availability="unavailable"
        accessibilityLabel="Service health"
      />,
    );
    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("As expected")).not.toBeInTheDocument();
    rerender(
      <HealthIndicator
        assessment="healthy"
        label="As expected"
        availability="unavailable"
        isLoading
        accessibilityLabel="Service health"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Assessing…");
    expect(
      screen.getByRole("group", { name: "Service health" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    rerender(
      <HealthIndicator
        assessment="healthy"
        label="As expected"
        accessibilityLabel="Service health"
      />,
    );
    expect(screen.getByText("As expected")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("localizes each distinct data state", () => {
    const props = {
      label: "Non évalué",
      unavailableLabel: "Indisponible",
      loadingLabel: "Évaluation…",
      accessibilityLabel: "État",
    };
    const { rerender } = render(<HealthIndicator {...props} />);
    expect(screen.getByText("Non évalué")).toBeVisible();
    rerender(<HealthIndicator {...props} availability="unavailable" />);
    expect(screen.getByText("Indisponible")).toBeVisible();
    rerender(<HealthIndicator {...props} isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Évaluation…");
  });
});
