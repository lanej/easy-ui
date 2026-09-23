import React from "react";
import { screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { ThemeProvider } from "../Theme";
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
  ChartSurface: ({ "aria-label": name }: { "aria-label": string }) => (
    <div role="img" aria-label={name} />
  ),
}));
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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
