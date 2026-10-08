import React from "react";
import { render, screen } from "@testing-library/react";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { PillButton } from "../Pill";

it("renders a compact identity without requiring subtitle or navigation", () => {
  render(<WorkspaceHeader title="Operations Overview" />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Operations Overview",
  );
  expect(screen.queryByRole("button")).toBeNull();
});

it("composes caller-supplied navigation and actions independently", () => {
  render(
    <WorkspaceHeader
      title="Operations Overview"
      navigation={<PillButton isSelected>Overview</PillButton>}
      actions={<PillButton>Save</PillButton>}
    />,
  );
  expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
});
