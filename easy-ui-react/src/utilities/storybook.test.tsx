import { render, screen } from "@testing-library/react";
import React from "react";
import { ThemeProvider } from "../Theme";
import { EasyPostLogo as LayoutLogo } from "./EasyPostLogo";
import {
  EasyPostFullLogo,
  EasyPostLogo,
  FakeSidebarNav,
  PlaceholderBox,
} from "./storybook";

describe("themed template story helpers", () => {
  it.each(["light", "dark"] as const)(
    "pairs placeholder foreground and background in %s mode",
    (colorScheme) => {
      render(
        <ThemeProvider colorScheme={colorScheme}>
          <PlaceholderBox>Content</PlaceholderBox>
        </ThemeProvider>,
      );

      const placeholder = screen.getByText("Content");
      expect(placeholder.style.background).toBe(
        "var(--ezui-color-neutral-100)",
      );
      expect(placeholder.style.color).toBe("var(--ezui-color-neutral-900)");
    },
  );

  it("preserves explicit placeholder styling", () => {
    render(
      <PlaceholderBox style={{ background: "black", color: "white" }}>
        Custom content
      </PlaceholderBox>,
    );

    const placeholder = screen.getByText("Custom content");
    expect(placeholder.style.background).toBe("black");
    expect(placeholder.style.color).toBe("white");
  });

  it("uses theme-aware fills for sidebar placeholders", () => {
    const { container } = render(<FakeSidebarNav />);
    const placeholders = [...container.querySelectorAll("div")].filter(
      (element) => element.style.background,
    );

    expect(placeholders).toHaveLength(10);
    for (const placeholder of placeholders) {
      expect(placeholder.style.background).toMatch(
        /^var\(--ezui-color-neutral-(100|200)\)$/,
      );
    }
  });

  it.each([
    ["layout wordmark", LayoutLogo],
    ["story wordmark", EasyPostFullLogo],
  ] as const)("uses theme-aware colors for the %s", (_description, Logo) => {
    const { container } = render(<Logo />);
    const paths = [...container.querySelectorAll("path")];

    expect(paths.slice(0, 2).map((path) => path.getAttribute("fill"))).toEqual([
      "var(--ezui-color-primary-800, #061340)",
      "var(--ezui-color-primary-800, #061340)",
    ]);
    expect(paths[2]).toHaveAttribute(
      "fill",
      "var(--ezui-color-primary-500, #164DFF)",
    );
  });

  it("uses the theme's primary color for the standalone story mark", () => {
    const { container } = render(<EasyPostLogo />);

    expect(container.querySelector("path")).toHaveAttribute(
      "fill",
      "var(--ezui-color-primary-500, #164DFF)",
    );
  });
});
