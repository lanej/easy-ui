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
      expect(screen.getByText("Unavailable")).toBeVisible();
    },
  );

  it("suppresses supporting reference details while loading or without a primary reference", () => {
    const { rerender } = render(
      <HealthAssessment
        health={{ assessment: "healthy" }}
        reference={<span>Primary reference</span>}
        referenceDetails={<span>Supporting details</span>}
      />,
    );
    expect(screen.getByText("Supporting details")).toBeVisible();
    rerender(
      <HealthAssessment
        health={{ assessment: "healthy" }}
        reference={<span>Primary reference</span>}
        referenceDetails={<span>Supporting details</span>}
        isLoading
      />,
    );
    expect(screen.queryByText("Supporting details")).not.toBeInTheDocument();
    rerender(
      <HealthAssessment
        health={{ assessment: "healthy" }}
        referenceDetails={<span>Supporting details</span>}
      />,
    );
    expect(screen.queryByText("Supporting details")).not.toBeInTheDocument();
  });

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
    expect(screen.getByRole("img", { name: "Stale" })).toBeVisible();
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
      freshness: { state: "fresh" as const },
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
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(
      screen.queryByRole("img", { name: "Fresh" }),
    ).not.toBeInTheDocument();
  });

  it("uses the visible observation label as the accessible group name", () => {
    render(
      <HealthAssessment
        label="Elapsed duration"
        health={{ assessment: "healthy" }}
        observation={{ value: 6, unit: "hours" }}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Elapsed duration" }),
    ).toHaveTextContent("6");
  });

  it("consolidates unavailable states while retaining supplied reference context", () => {
    render(
      <HealthAssessment
        health={{ assessment: "healthy" }}
        observation={{
          value: null,
          unit: "hours",
          emptyLabel: "No observation",
        }}
        freshness={{ state: "unavailable" }}
        reference="Typical: 9 hours"
      />,
    );
    expect(screen.getByText("No observation")).toBeVisible();
    expect(screen.getByText("Typical: 9 hours")).toBeVisible();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
  });

  it("preserves explicit freshness context when a measurement is missing", () => {
    render(
      <HealthAssessment
        health={{ assessment: "healthy" }}
        observation={{ value: null, unit: "hours" }}
        freshness={{ state: "stale", observedAt: "2026-01-15T12:00:00Z" }}
      />,
    );
    expect(screen.getByRole("img", { name: "Stale" })).toBeVisible();
    expect(screen.getByText("2026-01-15T12:00:00Z")).toBeVisible();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
  });

  it("keeps compact content to the pill and value even when supporting slots are supplied", () => {
    render(
      <HealthAssessment
        variant="compact"
        label="Elapsed duration"
        health={{ assessment: "healthy", label: "As expected" }}
        observation={{ value: 6, unit: "hours" }}
        observationDetails="Percentile metrics"
        reference="Graph"
        referenceDetails="Reference details"
        freshness={{ state: "stale" }}
      />,
    );
    expect(screen.getByText("As expected")).toBeVisible();
    expect(screen.getByText("6")).toBeVisible();
    for (const text of [
      "Elapsed duration",
      "Percentile metrics",
      "Graph",
      "Reference details",
    ]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    expect(
      screen.queryByRole("img", { name: "Stale" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Elapsed duration" }),
    ).toBeVisible();
  });

  it("keeps status, current value and a supplied reference in its inline variant", () => {
    const { container } = render(
      <HealthAssessment
        variant="inline"
        size="sm"
        health={{ assessment: "healthy", label: "As expected" }}
        observation={{ value: 6, unit: "h" }}
        reference={<span>Reference distribution</span>}
      />,
    );
    expect(container.querySelector('[data-variant="inline"]')).toBeVisible();
    expect(screen.getByText("As expected")).toBeVisible();
    expect(screen.getByText("6")).toBeVisible();
    expect(screen.getByText("Reference distribution")).toBeVisible();
  });

  it("renders only reference content in detailed form and retains a valid loading state", () => {
    const props = {
      variant: "detailed" as const,
      label: "Elapsed duration",
      health: { assessment: "healthy" as const },
      observation: { value: 6, unit: "hours" },
      observationDetails: "Percentile metrics",
      reference: "Graph",
      referenceDetails: "Reference details",
    };
    const { rerender } = render(<HealthAssessment {...props} />);
    expect(screen.getByText("Graph")).toBeVisible();
    expect(screen.queryByText("Reference details")).not.toBeInTheDocument();
    expect(screen.queryByText("6")).not.toBeInTheDocument();
    expect(screen.queryByText("Elapsed duration")).not.toBeInTheDocument();
    expect(screen.queryByText("Percentile metrics")).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Elapsed duration" }),
    ).not.toHaveAttribute("aria-labelledby");
    rerender(<HealthAssessment {...props} isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText("Graph")).not.toBeInTheDocument();
  });
});
