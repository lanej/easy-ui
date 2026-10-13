import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

it("requests the opposite mode and waits for the controlled value", async () => {
  const user = userEvent.setup();
  const onModeChange = vi.fn();
  const { rerender } = render(
    <ThemeToggle mode="light" onModeChange={onModeChange} />,
  );
  const button = screen.getByRole("button", { name: "Switch to dark mode" });
  expect(button).toHaveAttribute("type", "button");
  const moon = button.querySelector("svg")?.innerHTML;
  await user.click(button);
  expect(onModeChange).toHaveBeenCalledExactlyOnceWith("dark");
  expect(button).toHaveAccessibleName("Switch to dark mode");

  rerender(<ThemeToggle mode="dark" onModeChange={onModeChange} />);
  expect(button).toHaveAccessibleName("Switch to light mode");
  expect(button.querySelector("svg")?.innerHTML).not.toBe(moon);
  await user.click(button);
  expect(onModeChange.mock.calls).toEqual([["dark"], ["light"]]);
});

it("activates once with Enter and Space without submitting its form", async () => {
  const user = userEvent.setup();
  const onModeChange = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <ThemeToggle mode="light" onModeChange={onModeChange} />
    </form>,
  );
  await user.tab();
  expect(screen.getByRole("button")).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onModeChange).toHaveBeenCalledExactlyOnceWith("dark");
  await user.keyboard(" ");
  expect(onModeChange.mock.calls).toEqual([["dark"], ["dark"]]);
  expect(onSubmit).not.toHaveBeenCalled();
});

it("does not change mode when disabled", async () => {
  const user = userEvent.setup();
  const onModeChange = vi.fn();
  render(<ThemeToggle mode="dark" onModeChange={onModeChange} isDisabled />);
  const button = screen.getByRole("button", { name: "Switch to light mode" });
  expect(button).toBeDisabled();
  button.click();
  await user.tab();
  expect(button).not.toHaveFocus();
  expect(onModeChange).not.toHaveBeenCalled();
});
