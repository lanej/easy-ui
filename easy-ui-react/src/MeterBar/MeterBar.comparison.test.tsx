import React from "react";
import { screen, within } from "@testing-library/react";
import { expectTypeOf } from "vitest";
import { render } from "../utilities/test";
import { MeterBar } from "./MeterBar";
import type { MeterBarDatum, MeterBarProps } from "./MeterBar";

const data = [
  { id: "sac", label: "Sacramento", value: 4.2 },
  { id: "oak", label: "Oakland", value: 7.8, tone: "warning" },
  { id: "sjc", label: "San Jose", value: 3.1 },
] satisfies readonly MeterBarDatum[];

function getFill(element: Element): HTMLElement {
  const fill = element.querySelector<HTMLElement>("[data-meter-fill]");
  if (fill === null) {
    throw new Error("Expected a meter fill");
  }
  return fill;
}

it("compares labeled values on one supplied scale without nested meters", () => {
  const { container } = render(
    <MeterBar
      data={data}
      max={12}
      accessibilityLabel="Average dwell time"
      formatValue={(value) => `${value.toFixed(1)} h`}
    />,
  );
  const group = screen.getByRole("group", { name: "Average dwell time" });
  expect(within(group).getAllByRole("meter")).toHaveLength(3);
  data.forEach((datum) => {
    const meter = within(group).getByRole("meter", { name: datum.label });
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "12");
    expect(meter).toHaveAttribute("aria-valuenow", String(datum.value));
    expect(meter).toHaveAttribute("aria-valuetext", `${datum.value} h`);
    expect(within(meter).queryByRole("meter")).toBeNull();
    const fill = getFill(meter);
    expect(parseFloat(fill.style.inlineSize)).toBeCloseTo(
      (datum.value / 12) * 100,
      10,
    );
  });
  expect(container.querySelector("h1, h2, h3, h4, [tabindex]")).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
});

it("does not rescale remaining bars when the largest value is removed", () => {
  const { rerender } = render(<MeterBar data={data} max={12} />);
  const first = screen.getByRole("meter", { name: "Sacramento" });
  const fill = getFill(first);
  const width = fill.style.inlineSize;
  rerender(<MeterBar data={[data[2], data[0]]} max={12} />);
  expect(screen.getByRole("meter", { name: "Sacramento" })).toBe(first);
  expect(fill.style.inlineSize).toBe(width);
  expect(screen.getAllByRole("meter")[0]).toHaveAccessibleName("San Jose");
});

it("uses exact geometry rather than rounded display values", () => {
  render(
    <MeterBar
      data={[{ id: "a", label: "Score", value: 0.18765 }]}
      max={1}
      formatValue={(value) => value.toFixed(2)}
    />,
  );
  const meter = screen.getByRole("meter", { name: "Score" });
  expect(meter).toHaveTextContent("0.19");
  expect(meter).toHaveAttribute("aria-valuenow", "0.18765");
  expect(meter).toHaveAttribute("aria-valuetext", "0.19");
  const fill = getFill(meter);
  expect(parseFloat(fill.style.inlineSize)).toBeCloseTo(18.765, 10);
});

it("preserves zero and the maximum without inferring tones", () => {
  const { container } = render(
    <MeterBar
      data={[
        { id: "zero", label: "Zero", value: 0 },
        { id: "full", label: "Full", value: 12 },
      ]}
      max={12}
    />,
  );
  expect(screen.getAllByRole("meter")).toHaveLength(2);
  expect(screen.getByRole("meter", { name: "Zero" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  const fills = container.querySelectorAll<HTMLElement>("[data-meter-fill]");
  expect(fills[0].style.inlineSize).toBe("0%");
  expect(fills[1].style.inlineSize).toBe("100%");
  container.querySelectorAll("[data-meter-bar]").forEach((track) => {
    expect(track).toHaveAttribute("data-tone", "neutral");
  });
});

it.each([null, NaN, Infinity, -Infinity, -1, 13])(
  "retains an unavailable row for %s without claiming zero or invoking the formatter",
  (value) => {
    render(
      <MeterBar
        data={[{ id: "a", label: "Unknown", value }]}
        max={12}
        unavailableLabel="No measurement"
        formatValue={() => {
          throw new Error("Unavailable values must not be formatted");
        }}
      />,
    );
    expect(screen.getByText("Unknown")).toBeVisible();
    expect(screen.getByText("No measurement")).toBeVisible();
    expect(screen.queryByRole("meter")).toBeNull();
  },
);

it.each([0, -1, NaN, Infinity, -Infinity])(
  "retains labels but exposes no measurements for invalid maximum %s",
  (max) => {
    const { container } = render(<MeterBar data={data} max={max} />);
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(screen.queryByRole("meter")).toBeNull();
    expect(container.querySelector("[data-meter-bar], [aria-valuenow]")).toBeNull();
  },
);

it("keeps missing rows in place between valid observations", () => {
  const { container } = render(
    <MeterBar
      data={[data[0], { id: "missing", label: "Missing", value: null }, data[2]]}
      max={12}
    />,
  );
  const rows = container.querySelectorAll("[data-meter-row]");
  expect(rows).toHaveLength(3);
  expect(rows[1]).toHaveTextContent("MissingUnavailable");
  expect(rows[1].querySelector("[data-meter-bar]")).toBeNull();
  expect(screen.getAllByRole("meter")).toHaveLength(2);
});

it("applies a shared tone and thickness while permitting explicit row tones", () => {
  const { container } = render(
    <MeterBar data={data} max={12} tone="success" thickness="sm" />,
  );
  const tracks = container.querySelectorAll("[data-meter-bar]");
  expect(tracks[0]).toHaveAttribute("data-tone", "success");
  expect(tracks[1]).toHaveAttribute("data-tone", "warning");
  tracks.forEach((track) => {
    expect(track).toHaveAttribute("aria-hidden", "true");
    expect(track).toHaveAttribute("data-thickness", "sm");
  });
});

it("preserves the caller's numeric expression in RTL layouts", () => {
  const { container } = render(
    <div dir="rtl" lang="ar">
      <MeterBar
        data={[{ id: "a", label: "المدة", value: 4.2 }]}
        max={12}
        formatValue={(value) => new Intl.NumberFormat("ar-EG").format(value)}
      />
    </div>,
  );
  expect(container.querySelector("bdi")).toHaveAttribute("dir", "ltr");
  expect(container.querySelector("bdi")).toHaveTextContent("٤٫٢");
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "٤٫٢");
});

it("renders nothing for an empty comparison", () => {
  const { container } = render(<MeterBar data={[]} max={12} />);
  expect(container.querySelector("[data-meter-comparison]")).toBeNull();
});

it("requires one explicit scale and mutually exclusive value/data modes", () => {
  expectTypeOf<{
    data: MeterBarDatum[];
    max: number;
  }>().toMatchTypeOf<MeterBarProps>();
  expectTypeOf<{ value: number; max: number }>().toMatchTypeOf<MeterBarProps>();
  expectTypeOf<{
    value: number;
    data: MeterBarDatum[];
    max: number;
  }>().not.toMatchTypeOf<MeterBarProps>();
  expectTypeOf<{ data: MeterBarDatum[] }>().not.toMatchTypeOf<MeterBarProps>();
});
