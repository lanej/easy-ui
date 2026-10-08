import React from "react";
import { screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { RangePlot } from "./RangePlot";

it("aligns signed benchmarks and represents equal bounds as a point without inventing a range", () => {
  const { container } = render(
    <RangePlot
      label="Change"
      description="One shared scale"
      domain={[-5, 5]}
      interval={{ from: 0, to: 0, label: "Fixed" }}
      points={[
        { id: "a", label: "Below", value: -2 },
        { id: "b", label: "Zero", value: 0 },
        { id: "c", label: "Missing", value: null },
      ]}
    />,
  );
  const rows = within(
    screen.getByRole("list", { name: "Change" }),
  ).getAllByRole("listitem");
  expect(rows.map((row) => row.textContent)).toEqual([
    "Fixed0",
    "Below-2",
    "Zero0",
    "MissingNo data",
  ]);
  const marks = [
    ...container.querySelectorAll<HTMLElement>(
      '[aria-hidden="true"] > [style]',
    ),
  ];
  expect(marks.map((mark) => mark.style.left)).toEqual(["50%", "30%", "50%"]);
  expect(marks.every((mark) => !mark.style.width)).toBe(true);
});

it("retains finite outside-domain observations and valid siblings with selectable overflow policy", () => {
  const props = {
    label: "Range",
    description: "Explicit scale",
    domain: [-5, 5] as const,
    points: [
      { id: "a", label: "Below", value: -8 },
      { id: "b", label: "Inside", value: 0 },
      { id: "c", label: "Above", value: 8 },
      { id: "d", label: "Missing", value: null },
      { id: "e", label: "Invalid", value: NaN },
    ],
  };
  const { container, rerender } = render(<RangePlot {...props} />);
  expect(screen.getByText("-8 · Outside scale")).toBeInTheDocument();
  expect(screen.getByText("8 · Outside scale")).toBeInTheDocument();
  expect(screen.getByText("No data")).toBeInTheDocument();
  expect(screen.getByText("Invalid value")).toBeInTheDocument();
  expect(
    container.querySelectorAll('[aria-hidden="true"] > [style]'),
  ).toHaveLength(1);
  rerender(<RangePlot {...props} overflow="clamp" />);
  expect(
    [
      ...container.querySelectorAll<HTMLElement>(
        '[aria-hidden="true"] > [style]',
      ),
    ].map((mark) => mark.style.left),
  ).toEqual(["0%", "50%", "100%"]);
  expect(container.querySelectorAll('[data-overflow="true"]')).toHaveLength(2);
});

it("preserves interval bounds and exact formatting while distinguishing invalid intervals and scales", () => {
  const props = {
    label: "Cost",
    description: "USD",
    domain: [0, 2000] as const,
    points: [{ id: "a", label: "Observed", value: 1234.56 }],
    formatValue: (value: number) => `$${value.toFixed(2)}`,
    formatAxisValue: (value: number) => `${value / 1000}k`,
  };
  const { container, rerender } = render(
    <RangePlot
      {...props}
      interval={{ from: -100, to: 1500, label: "Supplied" }}
      overflow="clamp"
    />,
  );
  expect(
    screen.getByText("$-100.00–$1500.00 · Outside scale"),
  ).toBeInTheDocument();
  expect(screen.getByText("$1234.56")).toBeInTheDocument();
  expect(screen.getByText("2k")).toBeInTheDocument();
  expect(
    container.querySelector<HTMLElement>('[data-overflow="true"]')?.style.width,
  ).toBe("75%");
  rerender(
    <RangePlot
      {...props}
      interval={{ from: 1500, to: 100, label: "Supplied" }}
    />,
  );
  expect(
    screen.getByText("$1500.00–$100.00 · Invalid interval"),
  ).toBeInTheDocument();
  rerender(<RangePlot {...props} domain={[2, 2]} />);
  expect(screen.getByText("Invalid scale")).toBeInTheDocument();
  expect(screen.getByText("$1234.56")).toBeInTheDocument();
  expect(
    container.querySelectorAll('[aria-hidden="true"] > [style]'),
  ).toHaveLength(0);
});
