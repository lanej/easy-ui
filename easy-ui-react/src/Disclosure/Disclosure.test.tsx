import { fireEvent, screen } from "@testing-library/react";
import React, { StrictMode, useLayoutEffect, useState } from "react";
import { vi } from "vitest";
import {
  mockGetComputedStyle,
  render,
  userClick,
  userTab,
} from "../utilities/test";
import { Disclosure, DisclosureProps } from "./Disclosure";

function LocalForm() {
  const [count, setCount] = useState(0);
  return (
    <>
      <label>
        Rationale
        <input defaultValue="" />
      </label>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Edits: {count}
      </button>
    </>
  );
}

function example(props: Partial<DisclosureProps> = {}) {
  return (
    <Disclosure {...props}>
      <div>
        <Disclosure.Trigger variant="link" size="sm">
          Trends and factors
        </Disclosure.Trigger>
      </div>
      <Disclosure.Content role="region">
        <LocalForm />
      </Disclosure.Content>
    </Disclosure>
  );
}

function trigger() {
  return screen.getByRole("button", { name: "Trends and factors" });
}

function panelFor(button: HTMLElement) {
  return document.getElementById(button.getAttribute("aria-controls")!)!;
}

function FocusOnUnmount({ onUnmount }: { onUnmount: () => void }) {
  useLayoutEffect(() => onUnmount, [onUnmount]);
  return <input aria-label="Unmount note" />;
}

describe("Disclosure", () => {
  let restoreStyle: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    restoreStyle = mockGetComputedStyle();
  });

  afterEach(() => {
    restoreStyle();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("gives independent instances unique, stable trigger and panel relationships", async () => {
    const { user } = render(
      <>
        {example()}
        {example()}
      </>,
    );
    const buttons = screen.getAllByRole("button", {
      name: "Trends and factors",
    });
    const panels = buttons.map(panelFor);
    const ids = [...buttons, ...panels].map((element) => element.id);
    expect(new Set(ids).size).toBe(4);
    for (const [index, button] of buttons.entries()) {
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(panels[index]).toHaveAttribute("aria-labelledby", button.id);
      expect(panels[index]).not.toBeVisible();
    }

    await userClick(user, buttons[0]);
    expect(panels[0]).toBeVisible();
    expect(panels[1]).not.toBeVisible();
    await userClick(user, buttons[1]);
    expect(panels[0]).toBeVisible();
    expect(panels[1]).toBeVisible();
    await userClick(user, buttons[0]);
    expect(panels[0]).not.toBeVisible();
    expect(panels[1]).toBeVisible();
    expect([...buttons, ...panels].map((element) => element.id)).toEqual(ids);
  });

  it.each(["{Enter}", " "])(
    "toggles once per %s keyboard activation",
    async (key) => {
      const onExpandedChange = vi.fn();
      const { user } = render(example({ onExpandedChange }));
      await userTab(user);
      expect(trigger()).toHaveFocus();
      await user.keyboard(key);
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      expect(onExpandedChange.mock.calls).toEqual([[true]]);
      await user.keyboard(key);
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      expect(onExpandedChange.mock.calls).toEqual([[true], [false]]);
    },
  );

  it("waits for controlled props to change after requesting a toggle", async () => {
    const onExpandedChange = vi.fn();
    const { user, rerender } = render(
      example({ isExpanded: false, onExpandedChange }),
    );
    await userClick(user, trigger());
    expect(onExpandedChange.mock.calls).toEqual([[true]]);
    expect(panelFor(trigger())).not.toBeVisible();

    rerender(example({ isExpanded: true, onExpandedChange }));
    expect(
      screen.getByRole("region", { name: "Trends and factors" }),
    ).toBeVisible();
    await userClick(user, trigger());
    expect(onExpandedChange.mock.calls).toEqual([[true], [false]]);
    expect(panelFor(trigger())).toBeVisible();
    rerender(example({ isExpanded: false, onExpandedChange }));
    expect(panelFor(trigger())).not.toBeVisible();
    expect(onExpandedChange).toHaveBeenCalledTimes(2);
  });

  it("uses defaultExpanded only for the initial uncontrolled state", async () => {
    const { user, rerender } = render(example({ defaultExpanded: true }));
    expect(panelFor(trigger())).toBeVisible();
    await userClick(user, trigger());
    rerender(example({ defaultExpanded: true }));
    expect(panelFor(trigger())).not.toBeVisible();
  });

  it("preserves mounted form and component state across closing by default", async () => {
    const { user } = render(example());
    const input = screen.getByLabelText("Rationale");
    expect(input).not.toBeVisible();
    await userClick(user, trigger());
    await user.type(input, "Investigate the forecast");
    await userClick(user, screen.getByRole("button", { name: "Edits: 0" }));
    await userClick(user, trigger());
    expect(input).toBeInTheDocument();
    expect(input).not.toBeVisible();
    await userClick(user, trigger());
    expect(screen.getByLabelText("Rationale")).toBe(input);
    expect(input).toHaveValue("Investigate the forecast");
    expect(screen.getByRole("button", { name: "Edits: 1" })).toBeVisible();
  });

  it("unmounts child content only when requested, keeping its panel shell", async () => {
    const { user } = render(example({ mountPolicy: "unmount" }));
    const panel = panelFor(trigger());
    expect(screen.queryByLabelText("Rationale")).not.toBeInTheDocument();
    await userClick(user, trigger());
    const input = screen.getByLabelText("Rationale");
    await user.type(input, "Temporary note");
    await userClick(user, screen.getByRole("button", { name: "Edits: 0" }));
    await userClick(user, trigger());
    expect(panelFor(trigger())).toBe(panel);
    expect(panel).not.toBeVisible();
    expect(input).not.toBeInTheDocument();
    await userClick(user, trigger());
    expect(screen.getByLabelText("Rationale")).not.toBe(input);
    expect(screen.getByLabelText("Rationale")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Edits: 0" })).toBeVisible();
  });

  it.each(["preserve", "unmount"] as const)(
    "returns owned focus to the trigger after a controlled close with %s content",
    async (mountPolicy) => {
      const { user, rerender } = render(
        example({ isExpanded: true, mountPolicy }),
      );
      const button = trigger();
      await userClick(user, screen.getByLabelText("Rationale"));
      rerender(example({ isExpanded: false, mountPolicy }));
      expect(button).toHaveFocus();
      expect(panelFor(button)).not.toBeVisible();
    },
  );

  it.each(["preserve", "unmount"] as const)(
    "leaves external focus alone when closing %s content",
    async (mountPolicy) => {
      const view = (isExpanded: boolean) => (
        <>
          <button type="button">Outside</button>
          {example({ isExpanded, mountPolicy })}
        </>
      );
      const { user, rerender } = render(view(true));
      await userClick(user, screen.getByLabelText("Rationale"));
      const outside = screen.getByRole("button", { name: "Outside" });
      await userClick(user, outside);
      rerender(view(false));
      expect(outside).toHaveFocus();
    },
  );

  it("respects focus deliberately moved by closing content cleanup", async () => {
    const moveFocusOutside = () =>
      screen.getByRole("button", { name: "Outside" }).focus();
    const view = (isExpanded: boolean) => (
      <>
        <button type="button">Outside</button>
        <Disclosure isExpanded={isExpanded} mountPolicy="unmount">
          <Disclosure.Trigger>Details</Disclosure.Trigger>
          <Disclosure.Content>
            <FocusOnUnmount onUnmount={moveFocusOutside} />
          </Disclosure.Content>
        </Disclosure>
      </>
    );
    const { user, rerender } = render(view(true));
    await userClick(user, screen.getByLabelText("Unmount note"));
    rerender(view(false));
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("does not restore focus when the whole disclosure unmounts", async () => {
    const { user, unmount } = render(example({ defaultExpanded: true }));
    const focus = vi.spyOn(trigger(), "focus");
    await userClick(user, screen.getByLabelText("Rationale"));
    focus.mockClear();
    unmount();
    expect(focus).not.toHaveBeenCalled();
  });

  it("returns focus after closing in StrictMode without requesting a state change", async () => {
    const onExpandedChange = vi.fn();
    const view = (isExpanded: boolean) => (
      <StrictMode>{example({ isExpanded, onExpandedChange })}</StrictMode>
    );
    const { user, rerender } = render(view(true));
    await userClick(user, screen.getByLabelText("Rationale"));
    rerender(view(false));
    expect(trigger()).toHaveFocus();
    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it("does not toggle a disabled trigger", () => {
    const onExpandedChange = vi.fn();
    render(
      <Disclosure onExpandedChange={onExpandedChange}>
        <Disclosure.Trigger isDisabled>Details</Disclosure.Trigger>
        <Disclosure.Content>Evidence</Disclosure.Content>
      </Disclosure>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it("uses a non-submitting trigger inside a form", async () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    const { user } = render(<form onSubmit={onSubmit}>{example()}</form>);
    expect(trigger()).toHaveAttribute("type", "button");
    await userTab(user);
    await user.keyboard("{Enter}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
