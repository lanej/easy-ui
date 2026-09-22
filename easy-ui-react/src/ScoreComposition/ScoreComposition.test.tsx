import React, { StrictMode } from "react";
import { act, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { render } from "../utilities/test";
import {
  ScoreComposition,
  ScoreContribution,
  ScoreSignal,
  ScoreResult,
} from "./index";
import { scoreCompositionExample as example } from "./ScoreComposition.examples";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("exposes the exact explanation in DOM order and preserves the supplied result", () => {
  const { container } = render(
    <ScoreComposition
      {...example}
      result={{ score: 17, disposition: "Manual decision" }}
    />,
  );
  const region = screen.getByRole("region", { name: "Score composition" });
  expect(region).toHaveAccessibleDescription(
    "How observed signals contribute to this decision.",
  );
  expect(
    within(screen.getByRole("list", { name: "Signals" })).getAllByRole(
      "listitem",
    ),
  ).toHaveLength(3);
  const contributions = screen.getByRole("list", { name: "Contributions" });
  expect(
    within(contributions).getByText("Missing package dimensions"),
  ).toBeVisible();
  expect(
    within(contributions).getByText("NDA / international label ratio"),
  ).toBeVisible();
  expect(
    screen.getByRole("meter", { name: "Underdeclaration" }),
  ).toHaveAttribute("aria-valuenow", "1");
  expect(
    screen.getByRole("meter", { name: "NDA / International" }),
  ).toHaveAttribute("aria-valuemax", "2");
  expect(screen.getByText("17.00")).toBeVisible();
  expect(screen.getByText("Manual decision")).toBeVisible();
  expect(
    [...container.querySelectorAll("[data-score-node]")].map((node) =>
      node.getAttribute("data-score-node"),
    ),
  ).toEqual([
    "signal",
    "signal",
    "signal",
    "contribution",
    "contribution",
    "result",
  ]);
});

it("distinguishes zero, false, missing, and invalid observations with localized display values", () => {
  render(
    <>
      <ScoreSignal label="Count" value={0} />
      <ScoreSignal label="Flag" value={false} labels={{ no: "Non" }} />
      <ScoreSignal label="Enabled" value={true} displayValue="Observed" />
      <ScoreSignal
        label="Missing"
        value={null}
        displayValue="Do not show"
        labels={{ missingValue: "Pending" }}
      />
      <ScoreSignal label="Invalid" value={NaN} displayValue="Do not show" />
    </>,
  );
  for (const text of ["0", "Non", "Observed", "Pending", "Invalid value"])
    expect(screen.getByText(text)).toBeVisible();
  expect(screen.queryByText("Do not show")).not.toBeInTheDocument();
});

it("uses caller-supplied signal meaning without inferring it from the observation", () => {
  const { rerender } = render(
    <>
      <ScoreSignal
        label="Favorable interpretation"
        value={0.26}
        sentiment="positive"
        statusLabel="Within target"
      />
      <ScoreSignal
        label="Unfavorable interpretation"
        value={0.26}
        sentiment="negative"
        statusLabel="Outside target"
      />
    </>,
  );
  for (const [label, sentiment] of [
    ["Within target", "positive"],
    ["Outside target", "negative"],
  ]) {
    const value = screen.getByText(label).closest("[data-sentiment]")!;
    expect(value).toHaveAttribute("data-sentiment", sentiment);
    expect(within(value as HTMLElement).getByText("0.26")).toBeVisible();
    expect(within(value as HTMLElement).getByText(label)).toBeVisible();
  }

  for (const observation of [true, false, 0, -1, 1]) {
    rerender(<ScoreSignal label="Uninterpreted" value={observation} />);
    const text =
      typeof observation === "boolean"
        ? observation
          ? "Yes"
          : "No"
        : String(observation);
    expect(screen.getByText(text).closest("[data-sentiment]")).toHaveAttribute(
      "data-sentiment",
      "neutral",
    );
    expect(screen.queryByText(/^(Positive|Caution|Negative)$/)).toBeNull();
  }
});

it("keeps signal meaning visible and localizable through status updates", () => {
  const props = {
    label: "Observation",
    value: false,
    labels: {
      no: "Non",
      positiveSignal: "Favorable",
      warningSignal: "Attention",
      negativeSignal: "Défavorable",
    },
  };
  const { rerender } = render(<ScoreSignal {...props} sentiment="positive" />);
  expect(screen.getByText("Favorable")).toBeVisible();
  expect(screen.getByText("Non")).toBeVisible();

  rerender(<ScoreSignal {...props} sentiment="warning" statusLabel="   " />);
  expect(screen.getByText("Attention")).toBeVisible();
  expect(screen.queryByText("Favorable")).not.toBeInTheDocument();
  expect(screen.getByText("Non").closest("[data-sentiment]")).toHaveAttribute(
    "data-sentiment",
    "warning",
  );

  rerender(<ScoreSignal {...props} sentiment="negative" statusLabel="" />);
  expect(screen.getByText("Défavorable")).toBeVisible();
  rerender(
    <ScoreSignal
      {...props}
      sentiment="positive"
      statusLabel="Review complete"
    />,
  );
  expect(screen.getByText("Review complete")).toBeVisible();
  expect(screen.queryByText("Favorable")).not.toBeInTheDocument();

  rerender(<ScoreSignal {...props} statusLabel="Recorded" />);
  expect(screen.getByText("Recorded")).toBeVisible();
  expect(screen.getByText("Non").closest("[data-sentiment]")).toHaveAttribute(
    "data-sentiment",
    "neutral",
  );
});

it("removes stale signal interpretation when an observation becomes unavailable or invalid", () => {
  const props = {
    label: "Observation",
    sentiment: "positive" as const,
    statusLabel: "Within target",
    displayValue: "Available",
  };
  const { rerender } = render(<ScoreSignal {...props} value={1} />);
  expect(screen.getByText("Within target")).toBeVisible();
  for (const value of [null, NaN, Infinity, -Infinity]) {
    rerender(<ScoreSignal {...props} value={value} />);
    const text = value === null ? "No data" : "Invalid value";
    expect(screen.getByText(text)).toBeVisible();
    expect(screen.getByText(text).closest("[data-sentiment]")).toHaveAttribute(
      "data-sentiment",
      "neutral",
    );
    expect(screen.queryByText("Within target")).not.toBeInTheDocument();
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
    expect(screen.queryByText("Positive")).not.toBeInTheDocument();
  }
  rerender(<ScoreSignal {...props} value={0} />);
  expect(screen.getByText("Available")).toBeVisible();
  expect(screen.getByText("Within target")).toBeVisible();
});

it("retains signed and outside values without fabricating a valid meter", () => {
  const format = vi.fn((value: number) => value.toFixed(1));
  const props = { label: "Contribution", maxScore: 2, formatScore: format };
  const { rerender } = render(<ScoreContribution {...props} score={0} />);
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  rerender(<ScoreContribution {...props} score={3} />);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  expect(screen.getByText("+3.0")).toBeVisible();
  expect(screen.getByText("Outside scale")).toBeVisible();
  rerender(<ScoreContribution {...props} score={-1} />);
  expect(screen.getByText("-1.0")).toBeVisible();
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  for (const maxScore of [0, -2, NaN, Infinity]) {
    rerender(<ScoreContribution {...props} score={1} maxScore={maxScore} />);
    expect(screen.getByText("Invalid scale")).toBeVisible();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  }
  rerender(<ScoreContribution {...props} score={null} />);
  expect(screen.getByText("No data")).toBeVisible();
  rerender(<ScoreContribution {...props} score={Infinity} />);
  expect(screen.getByText("Invalid value")).toBeVisible();
  expect(format.mock.calls.every(([value]) => Number.isFinite(value))).toBe(
    true,
  );
});

it("opens explanations by keyboard and preserves their state through data refresh and reordering", async () => {
  const { user, rerender } = render(<ScoreComposition {...example} />);
  const button = screen.getByRole("button", {
    name: "Explanation: Underdeclaration",
  });
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText(/In this sample model/)).not.toBeInTheDocument();
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/In this sample model/)).toBeVisible();
  rerender(
    <ScoreComposition
      {...example}
      contributions={[...example.contributions]
        .reverse()
        .map((item) => ({ ...item, score: 0 }))}
    />,
  );
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(
    screen.getByRole("meter", { name: "Underdeclaration" }),
  ).toHaveAttribute("aria-valuenow", "0");
  button.focus();
  await user.keyboard(" ");
  expect(screen.queryByText(/In this sample model/)).not.toBeInTheDocument();
});

it("names multiple compositions independently and supports external headings", () => {
  render(
    <>
      <h2 id="external">Readiness</h2>
      <ScoreComposition
        {...example}
        title={undefined}
        aria-labelledby="external"
        variant="bare"
      />
      <ScoreComposition signals={[]} contributions={[]} result={{ score: 0 }} />
    </>,
  );
  expect(screen.getByRole("region", { name: "Readiness" })).toHaveAttribute(
    "data-variant",
    "bare",
  );
  const empty = screen.getByRole("region", { name: "Score composition" });
  expect(within(empty).getByText("No signals supplied")).toBeVisible();
  expect(within(empty).getByText("No contributions supplied")).toBeVisible();
  expect(within(empty).getByText("0.00")).toBeVisible();
});

it("server-renders all exact values and relationships without SVG measurements", () => {
  const html = renderToString(<ScoreComposition {...example} />);
  expect(html).toContain("NDA / international label ratio");
  expect(html).toContain("Based on");
  expect(html).toContain("2.00");
  expect(html).not.toContain("<svg");
  const result = renderToString(<ScoreResult score={null} />);
  expect(result).toContain("No data");
  expect(result).not.toContain("0.00");
});

it("tracks resized and replaced nodes, deduplicates edges, supports RTL, and cleans up observers", () => {
  let resized: ResizeObserverCallback = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resized = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  let offset = 0;
  let rtl = false;
  const bounds = vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const type = this.dataset.scoreNode;
      let x =
        type === "signal"
          ? 0
          : type === "contribution"
            ? 300
            : type === "result"
              ? 600
              : 0;
      if (rtl && type) x = 600 - x;
      const width = type ? 200 : 800;
      const y = 100 + (type === "contribution" ? offset : 0);
      return {
        x,
        y,
        width,
        height: 100,
        top: y,
        left: x,
        right: x + width,
        bottom: y + 100,
        toJSON: () => ({}),
      };
    });
  try {
    const props = {
      signals: [{ id: "same:[id]", label: "Shared input", value: 1 }],
      contributions: [
        {
          id: "same:[id]",
          label: "A",
          score: 1,
          maxScore: 2,
          signals: ["same:[id]", "same:[id]", "missing"],
        },
        {
          id: "other",
          label: "B",
          score: 1,
          maxScore: 2,
          signals: ["same:[id]"],
        },
      ],
      result: { score: 2 },
    };
    const { container, rerender, unmount } = render(
      <StrictMode>
        <ScoreComposition {...props} />
      </StrictMode>,
    );
    expect(screen.getByText("Unavailable signal: missing")).toBeVisible();
    expect(container.querySelectorAll("path")).toHaveLength(4);
    const first = () => container.querySelector("path");
    expect(first()).toHaveAttribute("d", "M 200 50 C 250 50, 250 50, 300 50");
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    offset = 40;
    act(() => resized([], {} as ResizeObserver));
    expect(first()).toHaveAttribute("d", "M 200 50 C 250 50, 250 90, 300 90");
    rtl = true;
    act(() => resized([], {} as ResizeObserver));
    expect(first()).toHaveAttribute("d", "M 600 50 C 550 50, 550 90, 500 90");
    rerender(
      <StrictMode>
        <ScoreComposition {...props} contributions={[props.contributions[1]]} />
      </StrictMode>,
    );
    expect(container.querySelectorAll("path")).toHaveLength(2);
    rerender(
      <StrictMode>
        <ScoreComposition {...props} signals={[]} contributions={[]} />
      </StrictMode>,
    );
    expect(container.querySelector("svg")).toBeNull();
    unmount();
    expect(disconnect).toHaveBeenCalled();
  } finally {
    bounds.mockRestore();
    vi.unstubAllGlobals();
  }
});
