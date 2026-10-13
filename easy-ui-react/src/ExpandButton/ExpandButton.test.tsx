import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { ExpandButton } from "./ExpandButton";
import { CollapseButton } from "../CollapseButton";

describe("Disclosure atoms", () => {
  it("preserves the focused control while its disclosure state changes", () => {
    const press = vi.fn();
    const { rerender } = render(
      <ExpandButton
        accessibilityLabel="Expand details"
        aria-controls="details"
        onPress={press}
      />,
    );
    const button = screen.getByRole("button", { name: "Expand details" });
    button.focus();
    fireEvent.click(button);
    expect(press).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute("aria-expanded", "false");
    rerender(
      <ExpandButton
        expanded
        accessibilityLabel="Collapse details"
        aria-controls="details"
      />,
    );
    expect(screen.getByRole("button", { name: "Collapse details" })).toBe(
      button,
    );
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", "details");
  });
  it("defaults the negative atom to expanded and honors disabled state", () => {
    const press = vi.fn();
    render(
      <CollapseButton
        accessibilityLabel="Collapse branch"
        isDisabled
        onPress={press}
      />,
    );
    const button = screen.getByRole("button", { name: "Collapse branch" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(press).not.toHaveBeenCalled();
  });
});
