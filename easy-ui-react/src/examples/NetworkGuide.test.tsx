import React from "react";
import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { ThemeProvider, useColorScheme } from "../Theme";
import type { ChartProps } from "../Chart";
import type { NetworkMapProps } from "../NetworkMap";
import {
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
  userClick,
} from "../utilities/test";
import { NetworkGuideExample } from "./NetworkGuide.examples";
import { visualizationColors } from "../visualization/colors";

vi.mock("../Chart", () => ({
  Chart: function MockChart({
    title,
    option,
    variant,
    showDataTable,
  }: ChartProps) {
    const { resolvedColorScheme } = useColorScheme();
    return (
      <section
        aria-label={title ?? undefined}
        data-theme={resolvedColorScheme}
        data-chart-option={JSON.stringify(option)}
        data-chart-variant={variant}
        data-show-data-table={String(showDataTable)}
      />
    );
  },
}));
vi.mock("../NetworkMap", () => ({
  NetworkMap: function MockMap({
    title,
    mapStyle,
    showDataTable,
  }: NetworkMapProps) {
    const { resolvedColorScheme } = useColorScheme();
    return (
      <section
        aria-label={title ?? undefined}
        data-theme={resolvedColorScheme}
        data-map-style={JSON.stringify(mapStyle)}
        data-show-data-table={String(showDataTable)}
      />
    );
  },
}));

describe("Network investigation", () => {
  let restoreStyle: () => void;
  let restoreObserver: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    restoreStyle = mockGetComputedStyle();
    restoreObserver = mockIntersectionObserver();
  });
  afterEach(() => {
    restoreStyle();
    restoreObserver();
    vi.useRealTimers();
  });

  it.each(["light", "dark"] as const)(
    "inherits %s mode for its frame, charts, and local basemap",
    (scheme) => {
      const { container } = render(
        <ThemeProvider colorScheme={scheme}>
          <NetworkGuideExample />
        </ThemeProvider>,
      );
      expect(container.querySelector("[data-network-guide]")).toHaveAttribute(
        "data-color-scheme",
        scheme,
      );
      const map = screen.getByRole("region", {
        name: "Great Lakes transfer network",
      });
      expect(map).toHaveAttribute("data-theme", scheme);
      expect(map.getAttribute("data-map-style")).toContain(
        scheme === "dark" ? "#171e2d" : "#f4f3ed",
      );
      const chart = screen.getByRole("region", {
        name: "Detroit · throughput and capacity",
      });
      expect(chart).toHaveAttribute("data-theme", scheme);
      expect(chart.getAttribute("data-chart-option")).toContain(
        visualizationColors.primary,
      );
      const pressure = screen.getByRole("region", {
        name: "Network pressure by hour",
      });
      expect(pressure.getAttribute("data-chart-option")).toContain(
        visualizationColors.text,
      );
      expect(pressure).toHaveAttribute("data-chart-variant", "bare");
      expect(
        JSON.parse(pressure.getAttribute("data-chart-option")!).grid,
      ).toMatchObject({
        left: 0,
        right: 0,
        outerBoundsMode: "same",
        outerBoundsContain: "all",
      });
      expect(
        screen
          .getByRole("region", {
            name: "Detroit · destination and service mix",
          })
          .getAttribute("data-chart-option"),
      ).toContain(visualizationColors.text);
      expect(screen.queryByRole("navigation", { name: "Examples" })).toBeNull();
      expect(screen.queryByText(/EASY UI · NETWORK INVESTIGATION/)).toBeNull();
    },
  );

  it("selects a hub using the Easy UI control and updates linked evidence", async () => {
    const { user } = render(
      <ThemeProvider colorScheme="light">
        <NetworkGuideExample />
      </ThemeProvider>,
    );
    await userClick(
      user,
      screen.getByRole("button", { name: /Investigate hub/ }),
    );
    await userClick(user, screen.getByRole("option", { name: "Chicago" }));
    expect(
      within(
        screen.getByRole("region", { name: "Selected hub decision context" }),
      ).getByText("Chicago"),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Chicago · throughput and capacity" }),
    ).toBeInTheDocument();
    await userClick(
      user,
      screen.getByRole("button", { name: "Queue investigation" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Chicago queued for analyst investigation",
    );
  });

  it("makes every raw-data table optional without advertising hidden tables", () => {
    const { container, rerender } = render(
      <ThemeProvider colorScheme="light">
        <NetworkGuideExample showDataTable={false} />
      </ThemeProvider>,
    );
    const views = container.querySelectorAll("[data-show-data-table]");
    expect(views).toHaveLength(4);
    for (const view of views) {
      expect(view).toHaveAttribute("data-show-data-table", "false");
    }
    expect(screen.queryByText(/Exact tables and methods/)).toBeNull();
    expect(
      screen.getByText(/Methods remain available on demand/),
    ).toBeVisible();

    rerender(
      <ThemeProvider colorScheme="light">
        <NetworkGuideExample />
      </ThemeProvider>,
    );
    for (const view of container.querySelectorAll("[data-show-data-table]")) {
      expect(view).toHaveAttribute("data-show-data-table", "true");
    }
    expect(screen.getByText(/Exact tables and methods/)).toBeVisible();
  });

  it("switches presentation using the Easy UI control", async () => {
    const { user } = render(
      <ThemeProvider colorScheme="light">
        <NetworkGuideExample />
      </ThemeProvider>,
    );
    await userClick(user, screen.getByRole("button", { name: /Presentation/ }));
    await userClick(
      user,
      screen.getByRole("option", { name: "Separate evidence tabs" }),
    );
    expect(
      screen.getByRole("tablist", { name: "Separated evidence" }),
    ).toBeVisible();
    await userClick(user, screen.getByRole("button", { name: /Presentation/ }));
    await userClick(
      user,
      screen.getByRole("option", { name: "Linked evidence workspace" }),
    );
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});
