import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { RouteHistory } from "./RouteHistory";
import type { InvestigationGraph } from "./workbenchModel";

vi.mock("./RouteHistoryMap", () => ({
  RouteHistoryMap: ({
    selectedLocationId,
    selectedAnnotation,
    onInspectLocation,
  }: {
    selectedLocationId?: string;
    selectedAnnotation?: string;
    onInspectLocation(id: string): void;
  }) => (
    <section aria-label="Map">
      <button onClick={() => onInspectLocation("katy")}>Katy marker</button>
      <span>
        {[selectedLocationId, selectedAnnotation].filter(Boolean).join(" / ")}
      </span>
    </section>
  ),
}));

const graph: InvestigationGraph = {
  locations: [
    { id: "katy", label: "Katy, TX", kind: "hub", coordinates: [-95.8, 29.8] },
  ],
  events: [
    { id: "2", label: "Arrived", locationId: "katy", timeLabel: "21:36" },
    { id: "3", label: "Notification" },
    {
      id: "4",
      label: "Departed",
      locationId: "katy",
      timeLabel: "22:37",
      statusLabel: "In transit",
      detailLabel: "SF",
    },
  ],
  connections: [{ id: "c", fromEventId: "2", toEventId: "4" }],
  paths: [
    { id: "a", label: "Route A", color: "#3388aa", connectionIds: ["c"] },
  ],
};
const common = {
  graph,
  map: {
    workerUrl: "/worker.js",
    mapStyle: { version: 8 as const, sources: {}, layers: [] },
  },
};

describe("RouteHistory", () => {
  it("collects nonconsecutive observations at one location and preserves the inspected scan when dismissed", () => {
    const change = vi.fn();
    render(
      <RouteHistory
        {...common}
        timeZoneLabel="UTC"
        onSelectionChange={change}
      />,
    );
    const map = screen.getByRole("region", { name: "Map" });
    const marker = within(map).getByRole("button", { name: "Katy marker" });
    marker.focus();
    fireEvent.click(marker);
    const details = screen.getByRole("region", { name: "Location details" });
    expect(within(details).getByText(/2 scans/)).toBeVisible();
    expect(within(details).queryByText("Notification")).toBeNull();
    fireEvent.click(within(details).getByRole("button", { name: /Departed/ }));
    expect(change).toHaveBeenLastCalledWith({
      type: "location",
      locationId: "katy",
      eventId: "4",
    });
    expect(within(map).getByText("katy / In transit · SF")).toBeVisible();
    const timeline = screen.getByRole("region", { name: "Scan timeline" });
    const departure = within(timeline).getByRole("button", {
      name: /Departed/,
    });
    expect(departure).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      within(details).getByRole("button", { name: "Close details" }),
    );
    expect(
      screen.queryByRole("region", { name: "Location details" }),
    ).toBeNull();
    expect(departure).toHaveAttribute("aria-pressed", "true");
    expect(marker).toHaveFocus();
    fireEvent.click(departure);
    expect(
      screen.getByRole("region", { name: "Location details" }),
    ).toBeVisible();
  });

  it("waits for controlled selection changes and isolates unlocated evidence", () => {
    const change = vi.fn();
    const { rerender } = render(
      <RouteHistory {...common} selection={null} onSelectionChange={change} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Katy marker" }));
    expect(change).toHaveBeenCalledWith({
      type: "location",
      locationId: "katy",
    });
    expect(
      screen.queryByRole("region", { name: "Location details" }),
    ).toBeNull();
    rerender(
      <RouteHistory {...common} selection={{ type: "event", eventId: "3" }} />,
    );
    const details = screen.getByRole("region", { name: "Observation details" });
    expect(
      within(details).getByRole("button", { name: /Notification/ }),
    ).toBeVisible();
    expect(within(details).queryByText("Arrived")).toBeNull();
  });
  it("keeps a dismissed controlled location closed while another request is pending", () => {
    const current = { type: "event", eventId: "2" } as const;
    const { rerender } = render(
      <RouteHistory {...common} selection={current} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Scan timeline" })).getByRole(
        "button",
        { name: /Notification/ },
      ),
    );
    expect(
      screen.queryByRole("region", { name: "Location details" }),
    ).toBeNull();
    rerender(
      <RouteHistory {...common} selection={{ type: "event", eventId: "3" }} />,
    );
    expect(
      screen.getByRole("region", { name: "Observation details" }),
    ).toBeVisible();
  });
});
