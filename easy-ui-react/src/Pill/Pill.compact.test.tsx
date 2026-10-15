import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { Pill, PillButton } from "./Pill";

it("supports compact passive annotations without making them interactive", () => {
  render(
    <Pill size="xs" tone="success">
      4.2% lower
    </Pill>,
  );
  expect(screen.getByText("4.2% lower").className).toContain("sizeXs");
  expect(screen.getByText("4.2% lower").className).toContain("toneSuccess");
  expect(screen.queryByRole("button")).toBeNull();
});

it("retains the existing default and small interactive pill sizes", () => {
  const { rerender } = render(<PillButton>Filter</PillButton>);
  const defaultClass = screen.getByRole("button", { name: "Filter" }).className;
  rerender(<PillButton size="md">Filter</PillButton>);
  expect(screen.getByRole("button", { name: "Filter" }).className).toBe(
    defaultClass,
  );
  expect(defaultClass).not.toContain("sizeXs");
  expect(defaultClass).not.toContain("sizeSm");
  rerender(<PillButton size="sm">Filter</PillButton>);
  expect(screen.getByRole("button", { name: "Filter" }).className).toContain(
    "sizeSm",
  );
});
