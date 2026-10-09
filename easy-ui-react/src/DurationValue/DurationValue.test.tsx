import React from "react";
import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { render } from "../utilities/test";
import { DurationValue } from "./DurationValue";

describe("<DurationValue />", () => {
  it("retains zero in the explicitly supplied unit", () => {
    render(<DurationValue value={0} unit="hours" />);
    expect(screen.getByRole("img", { name: "0 hours" })).toBeVisible();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  });
  it.each([null, -1, NaN, Infinity, -Infinity])(
    "does not format invalid duration %s",
    (value) => {
      const formatValue = vi.fn(String);
      render(
        <DurationValue
          value={value}
          unit="hours"
          formatValue={formatValue}
          accessibilityValueText="Old duration"
        />,
      );
      expect(screen.getByText("Unavailable")).toBeVisible();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(formatValue).not.toHaveBeenCalled();
    },
  );
  it("suppresses previous values while loading, then restores them", () => {
    const { rerender } = render(
      <DurationValue value={6} unit="hours" isLoading />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("6")).not.toBeInTheDocument();
    expect(screen.queryByText("hours")).not.toBeInTheDocument();
    rerender(<DurationValue value={6} unit="hours" />);
    expect(screen.getByRole("img", { name: "6 hours" })).toBeVisible();
  });
  it("localizes numbers, unit, accessible description, and empty/loading labels", () => {
    const props = {
      unit: "heures",
      accessibilityLabel: "Durée",
      accessibilityValueText: "Une heure et demie",
      formatValue: (value: number) =>
        new Intl.NumberFormat("fr-FR").format(value),
      emptyLabel: "Indisponible",
      loadingLabel: "Chargement…",
    };
    const { rerender } = render(<DurationValue value={1.5} {...props} />);
    expect(screen.getByRole("group", { name: "Durée" })).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Une heure et demie" }),
    ).toBeVisible();
    expect(screen.getByText("1,5")).toBeVisible();
    rerender(<DurationValue value={null} {...props} />);
    expect(screen.getByText("Indisponible")).toBeVisible();
    rerender(<DurationValue value={1.5} {...props} isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Chargement…");
  });
});
