import { act, fireEvent, screen, within } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import {
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
  userClick,
} from "../utilities/test";
import { PricingReview } from "./PricingReview.examples";
import { ThemeProvider } from "../Theme";
import { proposals } from "./DesignGuide.fixtures";
import { PriceComparisonChart } from "./PriceComparisonChart.examples";
import { ContributionComparisonChart } from "./ContributionComparisonChart.examples";
import { DemandComparisonChart } from "./DemandComparisonChart.examples";
import { getComponentThemeToken } from "../utilities/css";

function renderReview(jsx: React.ReactElement) {
  return render(<ThemeProvider colorScheme="light">{jsx}</ThemeProvider>);
}

const setOption = vi.fn();
vi.mock("../Chart/engine", () => ({
  loadChartEngine: vi.fn(async () => ({
    init: () => ({
      setOption,
      getOption: () => ({}),
      on: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    }),
  })),
}));

describe("Pricing review workflow", () => {
  it.each([
    PriceComparisonChart,
    ContributionComparisonChart,
    DemandComparisonChart,
  ])(
    "keeps comparison charts usable without raw-data tables",
    async (Component) => {
      const { container, rerender } = renderReview(
        <Component proposals={proposals} showDataTable={false} />,
      );
      await act(async () => {});
      expect(screen.getByRole("img")).toBeInTheDocument();
      expect(container.querySelector("details")).toBeNull();
      expect(
        screen.queryByRole("table", { hidden: true }),
      ).not.toBeInTheDocument();
      rerender(
        <ThemeProvider colorScheme="light">
          <Component proposals={proposals} />
        </ThemeProvider>,
      );
      expect(container.querySelector("details")).toBeInTheDocument();
    },
  );

  it("colors mixed contribution endpoints separately and supports neutral values", async () => {
    const { rerender } = renderReview(<PricingReview />);
    await act(async () => {});
    const bounds = within(
      screen.getByRole("group", {
        name: "Contribution per day for proposal B",
      }),
    );
    for (const [label, token] of [
      ["−$20", "negative.600"],
      ["+$100", "positive.700"],
    ]) {
      for (const [property, value] of Object.entries(
        getComponentThemeToken("text", "color", "color", token),
      )) {
        expect(bounds.getByText(label).style.getPropertyValue(property)).toBe(
          value,
        );
      }
    }
    rerender(
      <ThemeProvider colorScheme="light">
        <PricingReview colorSignedValues={false} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(bounds.getByText("−$20").getAttribute("style")).toBeFalsy();
    expect(bounds.getByText("+$100").getAttribute("style")).toBeFalsy();
  });
  let restoreStyle: () => void;
  let restoreObserver: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    restoreStyle = mockGetComputedStyle();
    restoreObserver = mockIntersectionObserver();
  });

  afterEach(() => {
    restoreStyle();
    restoreObserver();
    vi.useRealTimers();
  });

  it.each([
    {
      Component: PriceComparisonChart,
      title: "Price / parcel",
      disclosure: "View exact prices",
      cell: "5.40",
      series: [
        { id: "current", data: [5.7] },
        { id: "proposed", data: [5.4] },
      ],
    },
    {
      Component: ContributionComparisonChart,
      title: "Contribution / day",
      disclosure: "View scenario bounds",
      cell: "-20",
      series: [
        {
          id: "B",
          data: [
            [-20, "B"],
            [100, "B"],
          ],
        },
      ],
    },
    {
      Component: DemandComparisonChart,
      title: "Demand / day",
      disclosure: "View daily observations",
      cell: "145",
      series: [{ id: "B", data: [100, 125, 120, 135, 150, 130, 145] }],
    },
  ])(
    "renders $title independently with only its supplied proposals",
    async ({ Component, title, disclosure, cell, series }) => {
      const { user } = renderReview(
        <Component
          proposals={proposals.filter((proposal) => proposal.id === "B")}
        />,
      );
      await act(async () => {});
      const chart = screen.getByRole("region", { name: title });
      expect(chart.querySelector("[data-review-chart-note]")).toBeNull();
      expect(within(chart).queryByText(/not confidence intervals/)).toBeNull();
      const legend = within(chart).queryByRole("list", {
        name: "Chart series",
      });
      if (Component === ContributionComparisonChart) {
        expect(legend).toBeNull();
      } else {
        expect(
          within(legend!)
            .getAllByRole("listitem")
            .map((item) => item.textContent),
        ).toEqual(
          Component === PriceComparisonChart ? ["Current", "Proposed"] : ["B"],
        );
      }
      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.queryByRole("main")).not.toBeInTheDocument();
      expect(setOption).toHaveBeenCalledWith(
        expect.objectContaining({
          legend: expect.objectContaining({ show: false }),
          series: series.map((entry) => expect.objectContaining(entry)),
        }),
        { notMerge: true, silent: true },
      );
      await userClick(user, within(chart).getByText(disclosure));
      expect(within(chart).getByRole("table")).toBeVisible();
      expect(within(chart).getByRole("cell", { name: cell })).toBeVisible();
    },
  );

  it("shows numeric demand without inline plots and keeps history in investigations", async () => {
    const { user } = renderReview(<PricingReview />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Demand per day for proposal A" }),
    ).toHaveTextContent("160");
    await userClick(
      user,
      screen.getByRole("button", { name: "Investigate proposal A" }),
    );
    expect(
      screen.getByRole("region", { name: "Proposal A · Demand history" }),
    ).toBeVisible();
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        yAxis: expect.objectContaining({ min: 0, max: 200, interval: 100 }),
        series: [
          expect.objectContaining({
            id: "A",
            type: "line",
            data: [90, 110, 100, 140, 130, 155, 160],
          }),
        ],
      }),
      { notMerge: true, silent: true },
    );
  });

  it("keeps independent ECharts histories and exact UTC observations", async () => {
    const { user } = renderReview(<PricingReview initialOpen={["A", "B"]} />);
    await act(async () => {});
    const historyA = screen.getByRole("region", {
      name: "Proposal A · Demand history",
    });
    const historyB = screen.getByRole("region", {
      name: "Proposal B · Demand history",
    });
    expect(within(historyA).getByRole("img")).toBeVisible();
    expect(within(historyB).getByRole("img")).toBeVisible();
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        yAxis: expect.objectContaining({ min: 0, max: 200 }),
        series: [
          expect.objectContaining({
            id: "B",
            data: [100, 125, 120, 135, 150, 130, 145],
          }),
        ],
      }),
      { notMerge: true, silent: true },
    );
    await userClick(
      user,
      within(historyA).getByText("View daily observations", { exact: true }),
    );
    const rows = within(historyA).getAllByRole("row");
    expect(rows).toHaveLength(8);
    expect(
      within(rows[1]).getByRole("cell", { name: "2026-09-07" }),
    ).toBeVisible();
    expect(within(rows[1]).getByRole("cell", { name: "90" })).toBeVisible();
    expect(within(rows[7]).getByRole("cell", { name: "160" })).toBeVisible();
    expect(historyA.querySelector("details")).toHaveAttribute("open");
    expect(historyB.querySelector("details")).not.toHaveAttribute("open");
    expect(within(historyB).getByRole("table")).not.toBeVisible();
  });

  it("compares prices, signed scenario bounds, and demand with exact graphical data", async () => {
    const { user } = renderReview(<PricingReview graphical />);
    await act(async () => {});
    const comparisons = screen.getByRole("region", {
      name: "Graphical proposal comparisons",
    });
    expect(within(comparisons).getAllByRole("img")).toHaveLength(3);
    const graphicalOptions = setOption.mock.calls
      .map(([option]) => option)
      .filter(
        (option) =>
          option.xAxis?.max === 8 ||
          option.xAxis?.min === -50 ||
          (option.yAxis?.max === 200 &&
            option.series.every(
              (series: { id: string; name: string }) =>
                series.name === series.id,
            )),
      );
    expect(graphicalOptions).toHaveLength(3);
    for (const option of graphicalOptions) {
      expect(option.grid).toEqual({
        left: 40,
        right: 24,
        top: 16,
        bottom: 32,
        containLabel: false,
      });
    }
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        xAxis: expect.objectContaining({ min: 0, max: 8 }),
        series: [
          expect.objectContaining({ name: "Current", data: [6.2, 5.7, 7.1] }),
          expect.objectContaining({ name: "Proposed", data: [5.9, 5.4, 6.85] }),
        ],
      }),
      { notMerge: true, silent: true },
    );
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        xAxis: expect.objectContaining({ min: -50, max: 150 }),
        series: expect.arrayContaining([
          expect.objectContaining({
            id: "B",
            data: [
              [-20, "B"],
              [100, "B"],
            ],
          }),
        ]),
      }),
      { notMerge: true, silent: true },
    );
    await userClick(user, within(comparisons).getByText("View exact prices"));
    await userClick(
      user,
      within(comparisons).getByText("View scenario bounds"),
    );
    await userClick(
      user,
      within(comparisons).getByText("View daily observations"),
    );
    const tables = within(comparisons).getAllByRole("table");
    expect(within(tables[0]).getByRole("cell", { name: "6.85" })).toBeVisible();
    expect(within(tables[1]).getByRole("cell", { name: "-20" })).toBeVisible();
    const observations = within(tables[2]).getAllByRole("row");
    expect(observations).toHaveLength(8);
    expect(observations[7]).toHaveTextContent("2026-09-1316014585");
  });

  it("keeps graphical comparisons in sync with queue filters and empty selections", async () => {
    const { user } = renderReview(<PricingReview graphical />);
    await act(async () => {});
    const contribution = setOption.mock.calls.find(
      ([option]) => option.xAxis?.min === -50,
    )![0];
    const demand = setOption.mock.calls.find(
      ([option]) =>
        option.yAxis?.max === 200 &&
        option.series.every(
          (series: { id: string; name: string }) => series.name === series.id,
        ),
    )![0];
    const originalBounds = contribution.series.find(
      (series: { id: string }) => series.id === "B",
    );
    const originalDemand = demand.series.find(
      (series: { id: string }) => series.id === "B",
    );
    expect(originalBounds.itemStyle.color).toMatch(/^#/);
    expect(originalDemand.lineStyle.color).toBe(originalBounds.itemStyle.color);
    await userClick(user, screen.getByRole("button", { name: /^Queued,/ }));
    expect(
      screen.queryByRole("region", { name: "Graphical proposal comparisons" }),
    ).not.toBeInTheDocument();
    await userClick(
      user,
      screen.getByRole("button", { name: "Show all proposals" }),
    );
    await userClick(
      user,
      screen.getByRole("button", { name: /^Needs review,/ }),
    );
    await userClick(
      user,
      screen.getByRole("button", { name: "Queue review for proposal A" }),
    );
    await act(async () => {});
    for (const option of setOption.mock.calls.map(([option]) => option)) {
      if (
        option.xAxis?.min === -50 ||
        (option.yAxis?.max === 200 &&
          option.series.every(
            (series: { id: string; name: string }) => series.name === series.id,
          ))
      ) {
        const retained = option.series.find(
          (series: { id: string }) => series.id === "B",
        );
        expect(retained.itemStyle.color).toBe(originalBounds.itemStyle.color);
        expect(retained.lineStyle.color).toBe(originalDemand.lineStyle.color);
      }
    }
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        xAxis: expect.objectContaining({ min: 0, max: 8 }),
        yAxis: expect.objectContaining({ data: ["B", "C"] }),
        series: [
          expect.objectContaining({ name: "Current", data: [5.7, 7.1] }),
          expect.objectContaining({ name: "Proposed", data: [5.4, 6.85] }),
        ],
      }),
      { notMerge: true, silent: true },
    );
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        yAxis: expect.objectContaining({ min: 0, max: 200 }),
        series: [
          expect.objectContaining({
            id: "B",
            data: [100, 125, 120, 135, 150, 130, 145],
          }),
          expect.objectContaining({
            id: "C",
            data: [50, 65, 60, 75, 80, 70, 85],
          }),
        ],
      }),
      { notMerge: true, silent: true },
    );
  });

  it("queues and holds individual proposals and returns them to review", async () => {
    const { user } = renderReview(<PricingReview />);
    await userClick(
      user,
      screen.getByRole("button", { name: "Queue review for proposal A" }),
    );
    await userClick(
      user,
      screen.getByRole("button", { name: "Hold proposal B" }),
    );
    expect(
      within(screen.getByRole("article", { name: "Proposal A" })).getByText(
        "Queued for review",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("article", { name: "Proposal B" })).getByText(
        "On hold",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("1 awaiting review · 1 queued · 1 on hold"),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Proposal B placed on hold. No live price was changed.",
    );
    await userClick(
      user,
      screen.getByRole("button", { name: "Return proposal A to review" }),
    );
    expect(
      screen.getByRole("button", { name: "Queue review for proposal A" }),
    ).toBeVisible();
    expect(
      screen.getByText("2 awaiting review · 0 queued · 1 on hold"),
    ).toBeVisible();
  });

  it("filters the queue, handles empty states, and preserves focus when a decision removes a row", async () => {
    const { user } = renderReview(<PricingReview />);
    await userClick(user, screen.getByRole("button", { name: /^Queued,/ }));
    expect(
      screen.getByRole("heading", { name: "No queued proposals" }),
    ).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    await userClick(
      user,
      screen.getByRole("button", { name: "Show all proposals" }),
    );
    const pending = screen.getByRole("button", { name: /^Needs review,/ });
    await userClick(user, pending);
    await userClick(
      user,
      screen.getByRole("button", { name: "Queue review for proposal A" }),
    );
    expect(pending).toHaveFocus();
    expect(
      screen.queryByRole("article", { name: "Proposal A" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    await userClick(user, screen.getByRole("button", { name: /^Queued,/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("article", { name: "Proposal A" })).toBeVisible();
  });

  it("retains independent investigation notes across collapse and filtering", async () => {
    const { user } = renderReview(<PricingReview initialOpen={["A", "B"]} />);
    const noteA = screen.getByRole("textbox", {
      name: "Review rationale for proposal A",
    });
    const noteB = screen.getByRole("textbox", {
      name: "Review rationale for proposal B",
    });
    fireEvent.change(noteA, { target: { value: "Check demand" } });
    fireEvent.change(noteB, { target: { value: "Confirm capacity" } });
    const toggle = screen.getByRole("button", {
      name: "Investigate proposal A",
    });
    await userClick(user, toggle);
    expect(noteA).not.toBeVisible();
    expect(noteB).toBeVisible();
    await userClick(user, toggle);
    expect(noteA).toHaveValue("Check demand");
    await userClick(user, screen.getByRole("button", { name: /^Queued,/ }));
    await userClick(
      user,
      screen.getByRole("button", { name: /^All proposals,/ }),
    );
    expect(
      screen.getByRole("textbox", { name: "Review rationale for proposal A" }),
    ).toHaveValue("Check demand");
    expect(
      screen.getByRole("textbox", { name: "Review rationale for proposal B" }),
    ).toHaveValue("Confirm capacity");
  });

  it("scopes disclosure and note relationships across multiple workspace instances", async () => {
    renderReview(
      <>
        <PricingReview initialOpen={["A"]} />
        <PricingReview initialOpen={["A"]} />
      </>,
    );
    await act(async () => {});
    const notes = screen.getAllByRole("textbox", {
      name: "Review rationale for proposal A",
    });
    expect(notes[0].id).not.toBe(notes[1].id);
    const controls = screen.getAllByRole("button", {
      name: /Investigate proposal/,
    });
    expect(
      new Set(controls.map((button) => button.getAttribute("aria-controls")))
        .size,
    ).toBe(6);
    for (const button of controls)
      expect(
        document.getElementById(button.getAttribute("aria-controls")!),
      ).toBeInTheDocument();
  });
});
