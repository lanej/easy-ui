import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MeterBar } from "./MeterBar";

afterEach(cleanup);

const data = [
  { id: "a", label: "Facility A", value: 4 },
  { id: "b", label: "Facility B", value: 8 },
];

function stylesOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-meter-bar]")).map(
    (track) => ({
      color: track.getAttribute("data-color"),
      tone: track.getAttribute("data-tone"),
    }),
  );
}

describe("MeterBar palette colors", () => {
  it("preserves the neutral single-value default", () => {
    const { container } = render(<MeterBar value={4} max={12} />);
    expect(stylesOf(container)).toEqual([{ color: null, tone: "neutral" }]);
  });

  it.each(["primary", "secondary", "tertiary"] as const)(
    "renders the %s palette color without status meaning",
    (color) => {
      const { container } = render(
        <MeterBar value={4} max={12} color={color} />,
      );
      expect(stylesOf(container)).toEqual([{ color, tone: null }]);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  it("defaults comparison rows to primary without assigning a status", () => {
    const { container } = render(<MeterBar data={data} max={12} />);
    expect(stylesOf(container)).toEqual([
      { color: "primary", tone: null },
      { color: "primary", tone: null },
    ]);
    expect(screen.getAllByRole("meter")).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("inherits a group color and permits a row override", () => {
    const { container } = render(
      <MeterBar
        data={[data[0], { ...data[1], color: "tertiary" }]}
        max={12}
        color="secondary"
      />,
    );
    expect(stylesOf(container)).toEqual([
      { color: "secondary", tone: null },
      { color: "tertiary", tone: null },
    ]);
  });

  it("lets an explicit row color override a group tone", () => {
    const { container } = render(
      <MeterBar
        data={[data[0], { ...data[1], color: "secondary" }]}
        max={12}
        color="tertiary"
        tone="warning"
      />,
    );
    expect(stylesOf(container)).toEqual([
      { color: null, tone: "warning" },
      { color: "secondary", tone: null },
    ]);
  });

  it("lets a row tone override both its color and the group tone", () => {
    const { container } = render(
      <MeterBar
        data={[{ ...data[0], color: "secondary", tone: "danger" }]}
        max={12}
        color="tertiary"
        tone="success"
      />,
    );
    expect(stylesOf(container)).toEqual([{ color: null, tone: "danger" }]);
  });

  it("honors an explicit neutral tone instead of a comparison color", () => {
    const { container } = render(
      <MeterBar data={[data[0]]} max={12} color="primary" tone="neutral" />,
    );
    expect(stylesOf(container)).toEqual([{ color: null, tone: "neutral" }]);
  });

  it("honors a single-value tone over a palette color", () => {
    const { container } = render(
      <MeterBar value={4} max={12} color="primary" tone="warning" />,
    );
    expect(stylesOf(container)).toEqual([{ color: null, tone: "warning" }]);
  });
});
