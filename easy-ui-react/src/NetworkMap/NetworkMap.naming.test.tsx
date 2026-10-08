import React from "react";
import { renderToString } from "react-dom/server";
import { render, screen, within } from "@testing-library/react";
import { NetworkMapProvider } from "./NetworkMapContext";
import {
  NetworkMapControlPanel,
  NetworkMapDataView,
} from "./NetworkMapCompanions";
import type { NetworkMapProps } from "./types";

const records: NetworkMapProps = {
  mapStyle: { version: 8, sources: {}, layers: [] },
  workerUrl: "/map-worker.js",
  facilities: [
    { id: "a", label: "Origin", coordinates: [-120, 35], kind: "warehouse" },
    { id: "b", label: "Destination", coordinates: [-119, 36], kind: "hub" },
  ],
  segments: [
    { id: "a-b", from: "a", to: "b", label: "Transfer", evidence: "transfer" },
  ],
  areas: [
    {
      id: "weather",
      label: "Forecast rain",
      coordinates: [
        [-120, 35],
        [-119, 35],
        [-119, 36],
      ],
      evidence: "forecast",
      validFrom: "2026-09-20T09:00:00Z",
      validUntil: "2026-09-20T18:00:00Z",
      source: "Supplied forecast",
    },
  ],
  surface: {
    source: "Supplied estimates",
    asOf: "2026-09-20T09:00:00Z",
    cells: [
      {
        lonMin: -120,
        latMin: 35,
        lonMax: -119,
        latMax: 36,
        medianMinutes: 30,
        iqrMinutes: 5,
        n: 10,
      },
    ],
  },
};
const suffixes = [
  "location data",
  "connection data",
  "area data",
  "delivery surface data",
];

function NamedReports({ north = "North network" }: { north?: string }) {
  return (
    <>
      {[
        { id: "north", name: north },
        { id: "south", name: "South network" },
      ].map(({ id, name }) => (
        <section key={id}>
          <h2 id={`${id}-heading`}>{name}</h2>
          <p id={`${id}-period`}>September</p>
          <NetworkMapProvider
            {...records}
            title="Visible fallback"
            aria-label="Explicit fallback"
            aria-labelledby={`${id}-heading ${id}-period`}
          >
            <NetworkMapControlPanel />
            <NetworkMapDataView expanded />
          </NetworkMapProvider>
        </section>
      ))}
    </>
  );
}

it("names every companion from the external heading and its own purpose", () => {
  const { container, rerender } = render(<NamedReports />);
  for (const name of ["North network", "South network"]) {
    expect(
      screen.getByRole("group", {
        name: `${name} September camera and layers`,
      }),
    ).toBeInTheDocument();
    for (const suffix of suffixes)
      expect(
        screen.getByRole("region", { name: `${name} September ${suffix}` }),
      ).toBeInTheDocument();
  }
  // Preserve existing integrations that use the fallback attribute as a selector.
  expect(
    container.querySelectorAll('[aria-label$="camera and layers"]'),
  ).toHaveLength(2);
  const suffixIds = [...container.querySelectorAll("[aria-labelledby]")].map(
    (element) => {
      const ids = element.getAttribute("aria-labelledby")!.split(" ");
      const suffix = container.querySelector<HTMLElement>(
        `[id="${ids[ids.length - 1]}"]`,
      )!;
      expect(suffix).toHaveAttribute("hidden");
      expect(suffix.parentElement).toBe(element);
      return suffix.id;
    },
  );
  expect(new Set(suffixIds).size).toBe(10);
  rerender(<NamedReports north="Updated north network" />);
  expect(
    screen.getByRole("group", {
      name: "Updated north network September camera and layers",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("region", {
      name: "Updated north network September location data",
    }),
  ).toBeInTheDocument();
});

it.each([
  {
    options: { "aria-label": "Named network", title: "Visible title" },
    name: "Named network",
  },
  { options: { title: "Visible title" }, name: "Visible title" },
  { options: {}, name: "Map" },
])(
  "retains the $name fallback without an external heading",
  ({ options, name }) => {
    const { container } = render(
      <NetworkMapProvider {...records} {...options}>
        <NetworkMapControlPanel />
        <NetworkMapDataView expanded />
      </NetworkMapProvider>,
    );
    expect(
      screen.getByRole("group", { name: `${name} camera and layers` }),
    ).toBeInTheDocument();
    for (const suffix of suffixes)
      expect(
        screen.getByRole("region", { name: `${name} ${suffix}` }),
      ).toBeInTheDocument();
    expect(container.querySelector("[aria-labelledby]")).toBeNull();
  },
);

it("keeps two server-rendered maps' naming IDs unique and stable through hydration", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<NamedReports />);
  document.body.append(container);
  const before = [...container.querySelectorAll("[id]")].map(
    (element) => element.id,
  );
  expect(new Set(before).size).toBe(before.length);
  const associations = [...container.querySelectorAll("[aria-labelledby]")].map(
    (element) => element.getAttribute("aria-labelledby"),
  );
  expect(associations).toHaveLength(10);
  for (const association of associations) {
    for (const id of association!.split(" "))
      expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
  }
  expect(
    within(container).getByRole("group", {
      name: "North network September camera and layers",
    }),
  ).toBeInTheDocument();
  expect(
    within(container).getByRole("region", {
      name: "South network September location data",
    }),
  ).toBeInTheDocument();
  render(<NamedReports />, { container, hydrate: true });
  expect(
    [...container.querySelectorAll("[id]")].map((element) => element.id),
  ).toEqual(before);
  expect(
    [...container.querySelectorAll("[aria-labelledby]")].map((element) =>
      element.getAttribute("aria-labelledby"),
    ),
  ).toEqual(associations);
});
