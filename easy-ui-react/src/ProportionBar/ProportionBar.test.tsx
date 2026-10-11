import React from "react";
import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { render } from "../utilities/test";
import { ProportionBar } from "./ProportionBar";

const example = {
  label: "Development checkpoints affected",
  value: 1184,
  total: 1659,
};

it("shows one unframed proportion with its exact denominator and accessible meter", () => {
  const { container } = render(<ProportionBar {...example} tone="warning" />);
  const meter = screen.getByRole("meter", { name: example.label });
  expect(meter).toHaveAttribute("aria-valuemin", "0");
  expect(meter).toHaveAttribute("aria-valuemax", "1659");
  expect(meter).toHaveAttribute("aria-valuenow", "1184");
  expect(meter).toHaveAttribute("aria-valuetext", "71.4% (1,184 / 1,659)");
  expect(screen.getByText("71.4%")).toBeInTheDocument();
  expect(screen.getByText("1,184 / 1,659")).toBeInTheDocument();
  expect(meter).toHaveAttribute("data-tone", "warning");
  expect(container.querySelector("section, article")).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
  const fill = container.querySelector<HTMLElement>("[data-meter-fill]");
  expect(parseFloat(fill!.style.inlineSize)).toBeCloseTo(
    (1184 / 1659) * 100,
    8,
  );
});

it.each(["compact", "expanded", "bar"] as const)(
  "preserves data and semantics in the %s presentation",
  (presentation) => {
    render(<ProportionBar {...example} presentation={presentation} />);
    const meter = screen.getByRole("meter", { name: example.label });
    expect(meter).toHaveAttribute("aria-valuetext", "71.4% (1,184 / 1,659)");
    expect(meter).toHaveAttribute("data-presentation", presentation);
    expect(meter).toHaveAttribute("data-tone", "neutral");
    if (presentation === "bar") {
      expect(screen.queryByText("71.4%")).toBeNull();
      expect(meter).toHaveAttribute("aria-label", example.label);
    } else {
      expect(screen.getByText("71.4%")).toBeInTheDocument();
      expect(meter).toHaveAttribute("aria-labelledby");
    }
  },
);

it.each([
  [0, 100, "0%", "0%"],
  [100, 100, "100%", "100%"],
  [0.5, 2, "25%", "25%"],
  [1, 10000, "0%", "0.01%"],
])("uses the unrounded fraction for %s / %s", (value, total, text, width) => {
  const { container } = render(
    <ProportionBar label="Share" value={value} total={total} />,
  );
  expect(screen.getByText(text)).toBeInTheDocument();
  expect(
    container.querySelector<HTMLElement>("[data-meter-fill]")?.style
      .inlineSize,
  ).toBe(width);
  expect(screen.getByRole("meter")).toHaveAttribute(
    "data-value-state",
    "valid",
  );
});

it.each([
  [null, 100, "missing", "No data", "— / 100"],
  [10, null, "missing", "No data", "10 / —"],
  [null, null, "missing", "No data", "— / —"],
  [0, 0, "empty", "No population", "0 / 0"],
  [1, 0, "invalid", "Invalid proportion", "1 / 0"],
  [101, 100, "invalid", "Invalid proportion", "101 / 100"],
  [-1, 100, "invalid", "Invalid proportion", "-1 / 100"],
  [1, -100, "invalid", "Invalid proportion", "1 / -100"],
  [NaN, 100, "invalid", "Invalid proportion", "— / 100"],
  [1, Infinity, "invalid", "Invalid proportion", "1 / —"],
  [Infinity, 100, "invalid", "Invalid proportion", "— / 100"],
  [1, NaN, "invalid", "Invalid proportion", "1 / —"],
  [null, -1, "invalid", "Invalid proportion", "— / -1"],
] as const)(
  "does not draw a misleading proportion for %s / %s",
  (value, total, state, label, counts) => {
    const { container } = render(
      <ProportionBar
        label="Share"
        value={value}
        total={total}
        presentation="bar"
      />,
    );
    expect(screen.queryByRole("meter")).toBeNull();
    expect(container.querySelector("[data-meter-bar]")).toBeNull();
    expect(container.querySelector("[data-proportion-bar]")).toHaveAttribute(
      "data-value-state",
      state,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(counts)).toBeInTheDocument();
  },
);

it("suppresses stale observations and formatter calls while loading, then recovers", () => {
  const formatValue = vi.fn((value: number) => String(value));
  const formatPercentage = vi.fn((fraction: number) => `${fraction * 100}%`);
  const props = { ...example, formatValue, formatPercentage };
  const { rerender, container } = render(
    <ProportionBar {...props} isLoading />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  expect(container.querySelector("[data-proportion-bar]")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  expect(screen.queryByRole("meter")).toBeNull();
  expect(screen.queryByText(/1184/)).toBeNull();
  expect(formatValue).not.toHaveBeenCalled();
  expect(formatPercentage).not.toHaveBeenCalled();
  rerender(<ProportionBar {...props} />);
  expect(screen.getByRole("meter")).toHaveAttribute("aria-busy", "false");
  expect(screen.queryByRole("status")).toBeNull();
  expect(formatPercentage).toHaveBeenCalledWith(1184 / 1659);
});

it("uses caller formatting in both visible and accessible values", () => {
  const formatValue = new Intl.NumberFormat("de-DE").format;
  const formatPercentage = new Intl.NumberFormat("de-DE", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format;
  render(
    <ProportionBar
      {...example}
      formatValue={formatValue}
      formatPercentage={formatPercentage}
    />,
  );
  expect(screen.getByText("1.184 / 1.659")).toBeInTheDocument();
  expect(screen.getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    `${formatPercentage(1184 / 1659)} (1.184 / 1.659)`,
  );
});

it("localizes missing, empty, invalid, and loading states", () => {
  const props = {
    label: "Share",
    value: null,
    total: 0,
    emptyLabel: "Unavailable",
    emptyTotalLabel: "Empty population",
    invalidValueLabel: "Invalid input",
    loadingLabel: "Fetching",
  };
  const { rerender } = render(<ProportionBar {...props} />);
  expect(screen.getByText("Unavailable")).toBeInTheDocument();
  rerender(<ProportionBar {...props} value={0} />);
  expect(screen.getByText("Empty population")).toBeInTheDocument();
  rerender(<ProportionBar {...props} value={1} />);
  expect(screen.getByText("Invalid input")).toBeInTheDocument();
  rerender(<ProportionBar {...props} isLoading />);
  expect(screen.getByRole("status")).toHaveTextContent("Fetching");
});

it("keeps generated label IDs unique and uses safe typography defaults", () => {
  const { rerender } = render(
    <>
      <ProportionBar {...example} valueSize={NaN} />
      <ProportionBar {...example} presentation="expanded" valueSize={-1} />
    </>,
  );
  const meters = screen.getAllByRole("meter");
  expect(meters[0].getAttribute("aria-labelledby")).not.toBe(
    meters[1].getAttribute("aria-labelledby"),
  );
  expect(screen.getAllByText("71.4%")[0]).toHaveStyle({ fontSize: "18px" });
  expect(screen.getAllByText("71.4%")[1]).toHaveStyle({ fontSize: "32px" });
  rerender(<ProportionBar {...example} valueSize={48} />);
  expect(screen.getByText("71.4%")).toHaveStyle({ fontSize: "48px" });
});
