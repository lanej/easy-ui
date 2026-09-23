import React from "react";
import { act, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { ThemeProvider } from "../Theme";
import { ChartSurface } from "../Chart";
import { ScoreComposition } from "./ScoreComposition";
import { scoreCompositionExample } from "./ScoreComposition.examples";
import {
  ratioResponse,
  scoreCurveOption,
  ScoreChartDetails,
} from "./ScoreComposition.charts";
import type { LineSeriesOption } from "echarts";

vi.mock("../Chart", async (original) => ({
  ...(await original<object>()),
  ChartSurface: vi.fn(({ "aria-label": name }: { "aria-label": string }) => (
    <div role="img" aria-label={name} />
  )),
}));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("places the observed point on supplied evaluations and keeps threshold domains consistent", () => {
  for (const refreshed of [false, true]) {
    for (const kind of ["response", "history"] as const) {
      const option = scoreCurveOption(kind, refreshed);
      const series = (option.series as LineSeriesOption[])[0];
      const point = (series.markPoint!.data![0] as { coord: number[] }).coord;
      expect(series.data).toContainEqual(point);
      expect(series.smooth).toBe(false);
      expect(point).toEqual(
        kind === "response"
          ? [refreshed ? 0 : 0.26, refreshed ? 0 : 1]
          : [6, refreshed ? 0 : 0.26],
      );
      const axis = kind === "response" ? "xAxis" : "yAxis";
      const areas = series.markArea!.data as Record<string, unknown>[][];
      expect(areas.map(([from, to]) => [from[axis], to[axis]])).toEqual([
        [0, 0.15],
        [0.15, 0.35],
        [0.35, 0.5],
      ]);
      if (kind === "response")
        expect(series.data).toEqual(
          ratioResponse.map(([x, y]) => [x, refreshed ? 0 : y]),
        );
    }
  }
});

it("unfolds optional chart content from compact cards and preserves it across column collapse", async () => {
  const example = {
    ...scoreCompositionExample,
    signals: scoreCompositionExample.signals.map((signal) => ({
      ...signal,
      description:
        signal.id === "ratio" ? (
          <ScoreChartDetails kind="history" />
        ) : (
          signal.description
        ),
    })),
    contributions: scoreCompositionExample.contributions.map(
      (contribution) => ({
        ...contribution,
        explanation:
          contribution.id === "international" ? (
            <ScoreChartDetails kind="response" />
          ) : (
            contribution.explanation
          ),
      }),
    ),
  };
  const { user } = render(
    <ThemeProvider>
      <ScoreComposition {...example} />
    </ThemeProvider>,
  );
  const meter = screen.getByRole("meter", { name: "NDA / International" });
  expect(meter).toBeVisible();
  expect(
    screen.queryByRole("img", { name: "Ratio response" }),
  ).not.toBeInTheDocument();
  const title = screen.getByRole("button", {
    name: "Explanation: NDA / International",
  });
  await user.click(title);
  const chart = screen.getByRole("img", { name: "Ratio response" });
  expect(chart).toBeVisible();
  expect(screen.getByText("26% → 1.00 points")).toBeVisible();
  await user.click(screen.getByText("View exact chart data"));
  const table = screen.getByRole("table", { name: "Ratio response" });
  expect(within(table).getByRole("row", { name: "26% 1.00" })).toBeVisible();
  const column = screen.getByRole("button", {
    name: "Collapse: Contributions (2)",
  });
  await user.click(column);
  expect(chart).not.toBeVisible();
  await user.click(column);
  expect(screen.getByRole("img", { name: "Ratio response" })).toBe(chart);
  expect(table).toBeVisible();
  await user.click(title);
  expect(
    screen.queryByRole("img", { name: "Ratio response" }),
  ).not.toBeInTheDocument();
  expect(meter).toBeVisible();
  expect(meter).toHaveAttribute("aria-valuenow", "1");
  await user.click(
    screen.getByRole("button", {
      name: "Explanation: NDA / international label ratio",
    }),
  );
  expect(
    screen.getByRole("img", { name: "Recent label ratios" }),
  ).toBeVisible();
  expect(screen.getByText("Latest: 26%")).toBeVisible();
});

it.each(["system", "inverted"] as const)(
  "refreshes the chart palette on OS changes with the %s scheme and releases its listener",
  (colorScheme) => {
    const media = new EventTarget();
    const subscribe = vi.spyOn(media, "addEventListener");
    const unsubscribe = vi.spyOn(media, "removeEventListener");
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    const tokens = {
      line: "primary-600",
      surface: "neutral-000",
      guide: "neutral-600",
      positive: "positive-100",
      warning: "warning-300",
      negative: "negative-100",
    };
    const palettes = [
      {
        line: "#113abf",
        surface: "#ffffff",
        guide: "#627891",
        positive: "#d9f4e8",
        warning: "#fff0c2",
        negative: "#ffe0e0",
      },
      {
        line: "#d0dbff",
        surface: "#000000",
        guide: "#a0a0a0",
        positive: "#00392c",
        warning: "#6c4a07",
        negative: "#3f1716",
      },
    ];
    // JSDOM does not apply media-query CSS. Supply the newly computed tokens;
    // the browser audit verifies their actual system/inverted resolution.
    let palette = palettes[0];
    const computedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const css = computedStyle(element);
      if (element.hasAttribute("data-score-chart")) {
        for (const key of Object.keys(tokens) as (keyof typeof tokens)[]) {
          css.setProperty(`--ezui-color-${tokens[key]}`, palette[key]);
        }
      }
      return css;
    });
    const option = () => {
      const calls = vi.mocked(ChartSurface).mock.calls;
      return calls[calls.length - 1][0].option;
    };
    const { unmount } = render(
      <ThemeProvider colorScheme={colorScheme}>
        <ScoreChartDetails kind="response" />
      </ThemeProvider>,
    );
    const chart = screen.getByRole("img", { name: "Ratio response" });
    expect(option()).toEqual(scoreCurveOption("response", false, palettes[0]));
    for (palette of [palettes[1], palettes[0]]) {
      act(() => {
        media.dispatchEvent(new Event("change"));
      });
      expect(option()).toEqual(scoreCurveOption("response", false, palette));
      expect(screen.getByRole("img", { name: "Ratio response" })).toBe(chart);
    }
    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-color-scheme: dark)",
    );
    unmount();
    expect(unsubscribe).toHaveBeenCalledWith(
      "change",
      subscribe.mock.calls[0][1],
    );
  },
);
