import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { StatusDot } from "./StatusDot";

describe("<StatusDot />", () => {
  it("exposes the caller's status name without a visible text label", () => {
    render(<StatusDot tone="warning" label="Delayed" />);
    expect(screen.getByRole("img", { name: "Delayed" })).toHaveAttribute(
      "title",
      "Delayed",
    );
    expect(screen.queryByText("Delayed")).not.toBeInTheDocument();
  });

  it("marks current separately from status tone", () => {
    const { rerender } = render(<StatusDot tone="warning" label="Delayed" />);
    const dot = screen.getByRole("img", { name: "Delayed" });
    expect(dot).not.toHaveAttribute("aria-current");
    expect(dot).toHaveAttribute("data-tone", "warning");
    rerender(<StatusDot tone="warning" label="Delayed" current />);
    expect(dot).toHaveAttribute("aria-current", "true");
    expect(dot).toHaveAttribute("data-tone", "warning");
    expect(dot).toHaveAttribute("data-animate", "true");
    rerender(<StatusDot tone="warning" label="Delayed" current={false} />);
    expect(dot).not.toHaveAttribute("aria-current");
    expect(dot).not.toHaveAttribute("data-animate");
  });

  it("allows motion to be disabled while retaining the current highlight", () => {
    render(
      <StatusDot
        label="Current event"
        tone="danger"
        current
        animate={false}
        size="sm"
      />,
    );
    const dot = screen.getByRole("img", { name: "Current event" });
    expect(dot).toHaveAttribute("data-current", "true");
    expect(dot).not.toHaveAttribute("data-animate");
    expect(dot).toHaveAttribute("data-size", "sm");
    expect(dot).toHaveAttribute("data-tone", "danger");
  });
});
