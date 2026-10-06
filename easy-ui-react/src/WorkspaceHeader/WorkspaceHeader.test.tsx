import React from "react";
import { render, screen } from "@testing-library/react";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { PillButton } from "../Pill";

it("renders a compact identity without requiring subtitle or navigation", () => {
  render(<WorkspaceHeader title="Dynamic Pricing" />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Dynamic Pricing",
  );
  expect(screen.queryByRole("button")).toBeNull();
});

it("composes caller-supplied navigation and actions independently", () => {
  render(
    <WorkspaceHeader
      title="Dynamic Pricing"
      navigation={<PillButton isSelected>Rate card</PillButton>}
      actions={<PillButton>Save</PillButton>}
    />,
  );
  expect(screen.getByRole("button", { name: "Rate card" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
});
