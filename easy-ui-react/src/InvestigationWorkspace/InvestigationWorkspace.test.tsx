import React, { useState } from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { InvestigationWorkspace } from "./InvestigationWorkspace";
import { investigationRecords as records } from "./InvestigationWorkspace.fixtures";
import {
  resolveSelection,
  type InvestigationSelection,
  type InvestigationDetailsContext,
} from "./selection";
import type { NetworkMapProps } from "../NetworkMap";
let mapProps: NetworkMapProps;
vi.mock("../NetworkMap", () => ({
  NetworkMap: (props: NetworkMapProps) => {
    mapProps = props;
    return (
      <div data-testid="map" data-location={props.selectedFacilityId}>
        <button onClick={() => props.onFacilitySelect?.("shared")}>
          Map select Central Exchange
        </button>
        <button
          onClick={() =>
            props.onOverlaySelect?.({
              overlayId: props.overlays![props.overlays!.length - 1].id,
              feature: {
                type: "Feature",
                id: "shared-leg",
                geometry: { type: "LineString", coordinates: [] },
                properties: {},
              },
            })
          }
        >
          Map select shared connection
        </button>
      </div>
    );
  },
}));
const map = {
  mapStyle: { version: 8 as const, sources: {}, layers: [] },
  workerUrl: "/worker.js",
};
function Controlled({ initial }: { initial: InvestigationSelection }) {
  const [selection, onSelectionChange] = useState(initial);
  return (
    <InvestigationWorkspace
      {...records}
      map={map}
      selection={selection}
      onSelectionChange={onSelectionChange}
    />
  );
}
const details = () => screen.getByRole("region", { name: "Selection details" });
const timeline = () => screen.getByRole("list", { name: "Events" });

describe("InvestigationWorkspace", () => {
  it("requests selection without mutating a controlled value", () => {
    const change = vi.fn();
    const { rerender } = render(
      <InvestigationWorkspace
        {...records}
        map={map}
        selection={null}
        onSelectionChange={change}
      />,
    );
    fireEvent.click(
      within(timeline()).getByRole("button", { name: /08:00.*Accepted/ }),
    );
    expect(change).toHaveBeenCalledWith({ type: "event", eventId: "accepted" });
    expect(screen.getByTestId("map")).not.toHaveAttribute("data-location");
    rerender(
      <InvestigationWorkspace
        {...records}
        map={map}
        selection={{ type: "event", eventId: "accepted" }}
        onSelectionChange={change}
      />,
    );
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-location",
      "origin",
    );
    expect(
      within(timeline()).getByRole("button", { name: /08:00.*Accepted/ }),
    ).toHaveAttribute("aria-current", "true");
    const selected = mapProps.overlays![0].data.features.filter(
      (item) => item.properties?.selected,
    );
    expect(selected.map((item) => item.id)).toHaveLength(5);
  });
  it("retains duplicate and untimed events while stepping within a selected location", () => {
    render(<Controlled initial={null} />);
    fireEvent.click(screen.getByText("Map select Central Exchange"));
    expect(within(details()).getByText("3 associated events")).toBeVisible();
    fireEvent.click(
      within(details()).getByRole("button", { name: "Next event" }),
    );
    expect(within(details()).getByText("10:34")).toBeVisible();
    fireEvent.click(
      within(details()).getByRole("button", { name: "Next event" }),
    );
    expect(within(details()).getByText("11:05")).toBeVisible();
    fireEvent.click(
      within(details()).getByRole("button", { name: "Next event" }),
    );
    expect(within(details()).getByText("Unknown")).toBeVisible();
    expect(
      within(details()).getByRole("button", { name: "Next event" }),
    ).toBeDisabled();
    expect(within(details()).getByText("3 associated events")).toBeVisible();
  });
  it("preserves all candidate memberships on a shared connection", () => {
    render(<Controlled initial={null} />);
    fireEvent.click(screen.getByText("Map select shared connection"));
    expect(
      within(details()).getByRole("button", { name: "Via North Gate" }),
    ).toBeVisible();
    expect(
      within(details()).getByRole("button", { name: "Via South Gate" }),
    ).toBeVisible();
    expect(mapProps.selectedSegmentId).toBe("shared-leg");
    fireEvent.click(
      within(details()).getByRole("button", { name: "Via South Gate" }),
    );
    const highlighted = mapProps.overlays![0].data.features.filter(
      (item) => item.properties?.selected,
    );
    expect(highlighted.map((item) => item.id)).toEqual([
      "shared-leg",
      "south-leg",
      "south-end",
    ]);
    // Path choice never hides conflicting or unlocated observations from the timeline.
    expect(within(timeline()).getAllByRole("button")).toHaveLength(7);
    fireEvent.click(
      within(timeline()).getByRole("button", {
        name: /Processed at North Gate/,
      }),
    );
    expect(
      within(details()).getByRole("heading", {
        name: "Processed at North Gate",
      }),
    ).toBeVisible();
    expect(screen.getByTestId("map")).toHaveAttribute("data-location", "north");
  });
  it("supports timeline keyboard selection and clears stale map emphasis for unlocated events", () => {
    render(<Controlled initial={{ type: "event", eventId: "south-scan" }} />);
    fireEvent.keyDown(
      within(timeline()).getByRole("button", {
        name: /Processed at South Gate/,
      }),
      { key: "ArrowDown" },
    );
    expect(screen.getByTestId("map")).not.toHaveAttribute("data-location");
    expect(within(details()).getByText("Not supplied")).toBeVisible();
    expect(
      mapProps.overlays![0].data.features.some(
        (item) => item.properties?.selected,
      ),
    ).toBe(false);
  });
  it("keeps a selected record visible across immutable updates and reports removal without choosing another event", () => {
    const change = vi.fn();
    const selection: InvestigationSelection = {
      type: "event",
      eventId: "arrived",
    };
    const { rerender } = render(
      <InvestigationWorkspace
        {...records}
        selection={selection}
        map={map}
        onSelectionChange={change}
      />,
    );
    rerender(
      <InvestigationWorkspace
        {...records}
        events={records.events.map((item) => ({ ...item }))}
        selection={selection}
        map={map}
        onSelectionChange={change}
      />,
    );
    expect(
      within(details()).getByRole("heading", { name: "Arrived at exchange" }),
    ).toBeVisible();
    rerender(
      <InvestigationWorkspace
        {...records}
        events={[]}
        selection={selection}
        map={map}
        onSelectionChange={change}
      />,
    );
    expect(
      within(details()).getByRole("heading", { name: "Selection unavailable" }),
    ).toBeVisible();
    expect(change).not.toHaveBeenCalled();
  });
  it("does not fabricate related events for locations without observations", () => {
    render(
      <Controlled initial={{ type: "location", locationId: "unobserved" }} />,
    );
    expect(within(details()).getByText("0 associated events")).toBeVisible();
    expect(within(details()).queryByRole("navigation")).not.toBeInTheDocument();
  });
  it("keeps hover previews independent of persistent details and exposes the supplied context to charts", () => {
    const detail = vi.fn((_context: InvestigationDetailsContext) => (
      <span>Custom chart</span>
    ));
    const change = vi.fn();
    render(
      <InvestigationWorkspace
        {...records}
        selection={{ type: "event", eventId: "unlocated" }}
        map={map}
        onSelectionChange={change}
        renderDetails={detail}
      />,
    );
    mapProps.renderFacilityDetails?.({ facility: records.locations[0] });
    expect(change).not.toHaveBeenCalled();
    expect(detail.mock.lastCall?.[0].event?.id).toBe("unlocated");
    expect(within(details()).getByText("Custom chart")).toBeVisible();
  });
  it("retains valid scope when an externally selected event does not belong to it", () => {
    const context = resolveSelection(records, {
      type: "path",
      pathId: "north",
      eventId: "south-scan",
    });
    expect(context.event).toBeUndefined();
    expect(context.path?.id).toBe("north");
    expect(context.events.map((item) => item.id)).not.toContain("south-scan");
  });
  it("passes only application overlay context to its renderer", () => {
    const renderer = vi.fn(() => <span>Application overlay</span>);
    const external = {
      id: "application",
      data: { type: "FeatureCollection" as const, features: [] },
      layers: [],
    };
    render(
      <InvestigationWorkspace
        {...records}
        selection={null}
        onSelectionChange={vi.fn()}
        map={{
          ...map,
          overlays: [external],
          renderOverlayHoverDetails: renderer,
        }}
      />,
    );
    const owned = mapProps.overlays![1];
    mapProps.renderOverlayHoverDetails!({ overlays: [owned], selections: [] });
    expect(renderer).not.toHaveBeenCalled();
    mapProps.renderOverlayHoverDetails!({
      overlays: [owned, external],
      selections: [],
    });
    expect(renderer).toHaveBeenCalledWith({
      overlays: [external],
      selections: [],
    });
  });
  it("keeps location context but discloses an unavailable scoped event", () => {
    render(
      <Controlled
        initial={{ type: "location", locationId: "shared", eventId: "removed" }}
      />,
    );
    expect(
      within(details()).getByText(
        "The selected event is not available in this context.",
      ),
    ).toBeVisible();
    expect(within(details()).getByText("3 associated events")).toBeVisible();
  });
});
