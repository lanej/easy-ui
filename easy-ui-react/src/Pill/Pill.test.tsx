import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pill, PillButton } from "./Pill";

it("keeps a pill label noninteractive", () => {
  render(<Pill tone="warning">Capacity review</Pill>);
  expect(screen.getByText("Capacity review").tagName).toBe("SPAN");
  expect(screen.queryByRole("button")).toBeNull();
});

it("supports controlled selection and single keyboard activation", async () => {
  const user = userEvent.setup();
  const onPress = vi.fn();
  const { rerender } = render(
    <PillButton onPress={onPress}>Needs review</PillButton>,
  );
  const button = screen.getByRole("button", { name: "Needs review" });
  expect(button).toHaveAttribute("type", "button");
  expect(button).toHaveAttribute("aria-pressed", "false");
  await user.tab();
  await user.keyboard("{Enter}");
  expect(onPress).toHaveBeenCalledOnce();
  await user.keyboard(" ");
  expect(onPress).toHaveBeenCalledTimes(2);
  rerender(
    <PillButton isSelected onPress={onPress}>
      Needs review
    </PillButton>,
  );
  expect(button).toHaveAttribute("aria-pressed", "true");
});

it("does not activate a disabled pill", async () => {
  const user = userEvent.setup();
  const onPress = vi.fn();
  render(
    <PillButton isDisabled onPress={onPress}>
      Queued
    </PillButton>,
  );
  await user.click(screen.getByRole("button", { name: "Queued" }));
  expect(onPress).not.toHaveBeenCalled();
});
