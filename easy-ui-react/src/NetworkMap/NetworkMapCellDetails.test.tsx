import React from "react";
import { render, screen, within } from "@testing-library/react";
import { NetworkMapCellDetails } from "./NetworkMapCellDetails";
import type { MapSurfaceCell, MapSurfaceDistribution } from "./types";

const distribution = {
  minMinutes: 5,
  q1Minutes: 12,
  q3Minutes: 50,
  maxMinutes: 120,
};
const cell: MapSurfaceCell = {
  lonMin: 1,
  lonMax: 2,
  latMin: 3,
  latMax: 4,
  medianMinutes: 20,
  iqrMinutes: 38,
  n: 80,
  distribution,
};
const surface = {
  cells: [cell],
  source: "Observed delivery sample",
  asOf: "2026-09-22T00:00:00Z",
};

it("shows supplied asymmetric quartiles, exact endpoints and provenance", () => {
  render(<NetworkMapCellDetails cell={cell} surface={surface} />);
  const plot = within(
    screen.getByRole("figure", { name: "Delivery time spread" }),
  );
  expect(plot.getByText("12 min–50 min")).toBeInTheDocument();
  expect(plot.getByText("20 min")).toBeInTheDocument();
  expect(plot.getAllByText("5 min")).toHaveLength(2);
  expect(plot.getAllByText("120 min")).toHaveLength(2);
  expect(screen.getByText(/Observed delivery sample/)).toHaveTextContent(
    surface.asOf,
  );
});

it("does not fabricate a distribution from median and IQR alone", () => {
  render(
    <NetworkMapCellDetails
      cell={{ ...cell, distribution: undefined }}
      surface={surface}
    />,
  );
  expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  expect(screen.getByText("38 min")).toBeInTheDocument();
  expect(screen.getByText(/Distribution not supplied/)).toBeInTheDocument();
});

it.each<[string, Partial<MapSurfaceDistribution>, Partial<MapSurfaceCell>]>([
  ["reversed quartiles", { q1Minutes: 51 }, {}],
  ["negative minimum", { minMinutes: -1 }, {}],
  ["missing finite endpoint", { maxMinutes: NaN }, {}],
  ["median outside the middle interval", {}, { medianMinutes: 51 }],
  ["no observations", {}, { n: 0 }],
])("rejects invalid distribution marks: %s", (_name, overrides, values) => {
  render(
    <NetworkMapCellDetails
      cell={{
        ...cell,
        ...values,
        distribution: { ...distribution, ...overrides },
      }}
      surface={surface}
    />,
  );
  expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  expect(screen.getByText(/Distribution unavailable/)).toBeInTheDocument();
});

it("preserves a true zero and an all-equal distribution on a usable scale", () => {
  render(
    <NetworkMapCellDetails
      cell={{
        ...cell,
        medianMinutes: 0,
        iqrMinutes: 0,
        distribution: {
          minMinutes: 0,
          q1Minutes: 0,
          q3Minutes: 0,
          maxMinutes: 0,
        },
      }}
      surface={surface}
    />,
  );
  expect(screen.getByRole("figure")).toHaveTextContent("0 min");
  expect(screen.queryByText(/Invalid scale/)).not.toBeInTheDocument();
});

it("labels the selected count metric without misreporting minutes", () => {
  render(
    <NetworkMapCellDetails
      cell={cell}
      surface={surface}
      metric={{ key: "count", label: "Sample size", field: "n" }}
    />,
  );
  expect(screen.getByText("Sample size").parentElement).toHaveTextContent(
    "Sample size: 80",
  );
  expect(screen.queryByText("80 min")).not.toBeInTheDocument();
});
