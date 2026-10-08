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
});
