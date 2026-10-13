import tokens from "@easypost/easy-ui-tokens/js/tokens";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { TokenBrowser } from "./TokenBrowser";
import { mockGetComputedStyle } from "./test";

describe("TokenBrowser", () => {
  let restoreGetComputedStyle: () => void;
  beforeEach(() => {
    restoreGetComputedStyle = mockGetComputedStyle();
  });
  afterEach(() => {
    restoreGetComputedStyle();
  });
  it("renders every generated base token and both values of each theme token", () => {
    const { container } = render(<TokenBrowser />);
    const theme = within(screen.getByRole("region", { name: "Theme tokens" }));
    const text = new Set(
      Array.from(
        container.querySelectorAll("code"),
        (node) => node.textContent,
      ),
    );
    const themeText = new Set(
      theme
        .getAllByRole("listitem")
        .flatMap((node) =>
          Array.from(node.querySelectorAll("code"), (code) => code.textContent),
        ),
    );
    for (const [name, value] of Object.entries(tokens)) {
      if (name.startsWith("theme.")) {
        expect(themeText.has(String(value))).toBe(true);
        expect(themeText.has(name.replace(/^theme\.(light|dark)\./, ""))).toBe(
          true,
        );
      } else {
        expect(text.has(name)).toBe(true);
      }
    }
  });

  it("orders fractional spacing and named breakpoints by their actual size", () => {
    render(<TokenBrowser />);
    const spacing = within(screen.getByRole("region", { name: "Spacing" }));
    expect(
      spacing
        .getAllByRole("listitem")
        .map((item) => item.querySelector("code")?.textContent),
    ).toEqual([
      "space.0",
      "space.0.125",
      "space.0.25",
      "space.0.5",
      "space.1",
      "space.1.5",
      "space.2",
      "space.3",
      "space.3.5",
      "space.4",
      "space.4.5",
      "space.5",
      "space.6",
      "space.7",
      "space.8",
      "space.9",
      "space.10",
    ]);
    const breakpoints = within(
      screen.getByRole("region", { name: "Breakpoints" }),
    );
    expect(
      breakpoints
        .getAllByRole("listitem")
        .map((item) => item.querySelector("code")?.textContent),
    ).toEqual([
      "breakpoint.xs",
      "breakpoint.sm",
      "breakpoint.md",
      "breakpoint.lg",
      "breakpoint.xl",
      "breakpoint.xxl",
    ]);
  });

  it("finds tokens by CSS variable and dark-theme value", async () => {
    render(<TokenBrowser />);
    const user = userEvent.setup();
    const input = screen.getByRole("searchbox", { name: "Find a token" });
    await user.type(input, "--ezui-space-0-125");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("space.0.125", { exact: true })).toBeVisible();
    await user.clear(input);
    await user.type(input, "#6e93ff");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(
      screen.getByText("color.primary.500", { exact: true }),
    ).toBeVisible();
    expect(
      screen.getByText(tokens["theme.light.color.primary.500"], {
        exact: true,
      }),
    ).toBeVisible();
  });

  it("combines group and text filters, then recovers from an empty result", async () => {
    render(<TokenBrowser />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Token group/ }));
    await user.click(screen.getByRole("option", { name: "Shapes" }));
    expect(
      screen.queryByRole("region", { name: "Spacing" }),
    ).not.toBeInTheDocument();
    const input = screen.getByRole("searchbox", { name: "Find a token" });
    await user.type(input, "border_radius");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    await user.type(input, "missing");
    expect(screen.getByText("No tokens match these filters.")).toBeVisible();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    await user.clear(input);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
