import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { FacilitySummary } from "./FacilitySummary";
const observation = {
  id: "dwell",
  label: "Dwell",
  health: { assessment: "healthy" as const, label: "As expected" },
  observation: { value: 6, unit: "hours" },
  reference: <span>Reference comparison</span>,
};
describe("FacilitySummary", () => {
  it.each([null, NaN, Infinity, -1])(
    "does not imply health for missing or invalid observations %s",
    (value) => {
      render(
        <FacilitySummary
          name="North Harbor"
          observations={[
            { ...observation, observation: { value, unit: "hours" } },
          ]}
        />,
      );
      expect(screen.queryByText("As expected")).not.toBeInTheDocument();
      expect(screen.getByText("North Harbor")).toBeVisible();
    },
  );
  it("keeps identity and independent assessments distinct", () => {
    render(
      <FacilitySummary
        name="North Harbor"
        identifier="FAC-014"
        observations={[
          observation,
          {
            ...observation,
            id: "queue",
            label: "Queue",
            health: { assessment: "degraded", label: "Needs attention" },
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("region", { name: "North Harbor" }),
    ).toBeInTheDocument();
    expect(screen.getByText("As expected")).toBeVisible();
    expect(screen.getByText("Needs attention")).toBeVisible();
  });
  it("preserves identity but suppresses previous observations and details during loading", () => {
    render(
      <FacilitySummary
        name="North Harbor"
        observations={[observation]}
        details={<span>Previous details</span>}
        isLoading
        loadingLabel="Chargement"
      />,
    );
    expect(screen.getByText("North Harbor")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Chargement");
    expect(screen.queryByText("As expected")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference comparison")).not.toBeInTheDocument();
    expect(screen.queryByText("Previous details")).not.toBeInTheDocument();
  });
  it("omits references in compact form and restores them in detailed form", () => {
    const { rerender } = render(
      <FacilitySummary
        name="North Harbor"
        observations={[observation]}
        variant="compact"
      />,
    );
    expect(screen.queryByText("Reference comparison")).not.toBeInTheDocument();
    expect(screen.getByText("Dwell")).toBeVisible();
    rerender(
      <FacilitySummary
        name="North Harbor"
        observations={[observation]}
        variant="detailed"
      />,
    );
    expect(screen.getByText("Reference comparison")).toBeVisible();
  });
  it("shows localized absence without inventing an assessment", () => {
    render(
      <FacilitySummary
        name={<a href="/facility">North Harbor</a>}
        accessibilityLabel="Facility North Harbor"
        emptyLabel="No observations supplied"
      />,
    );
    expect(
      screen.getByRole("region", { name: "Facility North Harbor" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No observations supplied")).toBeVisible();
  });
});
