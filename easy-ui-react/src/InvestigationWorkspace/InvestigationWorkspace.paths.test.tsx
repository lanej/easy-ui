import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import {
  createExpression,
  featureFilter,
  latest,
  type Feature,
  type StylePropertySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { render } from "../utilities/test";
import type { EventTimelineProps } from "../EventTimeline";
import type { MapOverlay, MapSegment, NetworkMapProps } from "../NetworkMap";
import { InvestigationWorkspace } from "./InvestigationWorkspace";
import { investigationRecords as records } from "./InvestigationWorkspace.fixtures";
import type {
  InvestigationDetailsContext,
  InvestigationSelection,
} from "./selection";

let mapProps: NetworkMapProps;
let timelineProps: EventTimelineProps;
vi.mock("../NetworkMap", () => ({
  NetworkMap: (props: NetworkMapProps) => {
    mapProps = props;
    return <div data-testid="map" />;
  },
}));
vi.mock("../EventTimeline", () => ({
  EventTimeline: (props: EventTimelineProps) => {
    timelineProps = props;
    return <div data-testid="timeline" />;
  },
}));

const map = {
  mapStyle: { version: 8 as const, sources: {}, layers: [] },
  workerUrl: "/worker.js",
};
const northColor = "#2563eb";
const southColor = "#7c3aed";
const coloredPaths = records.paths.map((path) => ({
  ...path,
  color: path.id === "north" ? northColor : southColor,
}));
const baseProps = {
  ...records,
  paths: coloredPaths,
  map,
  variant: "ledger" as const,
  selection: null,
  onSelectionChange: vi.fn(),
};
const overlay = () => mapProps.overlays![mapProps.overlays!.length - 1];
function line(id: string) {
  const layer = overlay().layers.find((candidate) => candidate.id === id);
  if (!layer || layer.type !== "line") throw new Error(`Missing line ${id}`);
  return layer;
}
function feature(id: string): Feature {
  const found = overlay().data.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing feature ${id}`);
  return { id, type: "LineString", properties: found.properties! };
}
function matches(layerId: string, featureId: string) {
  return featureFilter(line(layerId).filter, "layers[0].filter").filter(
    { zoom: 6 },
    feature(featureId),
  );
}
function paint(
  layerId: string,
  property: "line-color" | "line-width" | "line-offset" | "line-opacity",
  featureId: string,
) {
  const result = createExpression(
    line(layerId).paint?.[property],
    `layers[0].paint.${property}`,
    latest.paint_line[property] as StylePropertySpecification,
  );
  if (result.result === "error") throw new Error(JSON.stringify(result.value));
  return result.value.evaluateWithoutErrorHandling(
    { zoom: 6 },
    feature(featureId),
  );
}

describe("InvestigationWorkspace candidate presentation", () => {
  it("uses one supplied palette for candidate controls, map strokes and the graph, with an explicit graph override", () => {
    const { container, rerender } = render(
      <InvestigationWorkspace {...baseProps} />,
    );
    const controls = screen.getByRole("group", { name: "Candidate paths" });
    for (const path of coloredPaths) {
      const button = within(controls).getByRole("button", { name: path.label });
      expect(button).toHaveAccessibleName(path.label);
      expect(button.querySelector("[data-path-id]")).toHaveAttribute(
        "data-path-color",
        path.color,
      );
      expect(button.querySelector("[data-path-id]")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(line(`path-${path.id}-solid`).paint?.["line-color"]).toBe(
        path.color,
      );
      expect(line(`path-${path.id}-dashed`).paint?.["line-color"]).toBe(
        path.color,
      );
    }
    expect(timelineProps.pathColors).toEqual({
      north: northColor,
      south: southColor,
    });
    expect(container.querySelector("button button")).toBeNull();

    rerender(
      <InvestigationWorkspace
        {...baseProps}
        timeline={{ pathColors: { north: "#00856a", extra: "#713f9f" } }}
      />,
    );
    expect(timelineProps.pathColors).toEqual({
      north: "#00856a",
      south: southColor,
      extra: "#713f9f",
    });
    expect(line("path-north-solid").paint?.["line-color"]).toBe(northColor);
  });

  it("paints shared membership on the same canonical feature and preserves geometry, widths and evidence dashes", () => {
    const segments: MapSegment[] = records.segments.map((segment, index) =>
      index === 0
        ? {
            ...segment,
            evidence: "measured",
            coordinates: [
              [-3, 0],
              [-1.8, 0.4],
              [-0.8, 0],
            ],
            volume: 120,
          }
        : segment,
    );
    const original = structuredClone(segments);
    render(<InvestigationWorkspace {...baseProps} segments={segments} />);

    expect(overlay().data.features.map((item) => item.id)).toEqual(
      segments.map((segment) => segment.id),
    );
    expect(overlay().data.features[0].geometry).toEqual({
      type: "LineString",
      coordinates: segments[0].coordinates,
    });
    expect(feature("shared-leg").properties).toMatchObject({
      evidence: "measured",
      width: 7,
    });
    expect(matches("path-north-solid", "shared-leg")).toBe(true);
    expect(matches("path-south-solid", "shared-leg")).toBe(true);
    expect(matches("path-north-dashed", "shared-leg")).toBe(false);
    expect(paint("path-north-solid", "line-offset", "shared-leg")).toBe(-2.75);
    expect(paint("path-south-solid", "line-offset", "shared-leg")).toBe(2.75);
    expect(paint("path-north-solid", "line-width", "shared-leg")).toBe(3.5);
    expect(matches("path-north-dashed", "north-leg")).toBe(true);
    expect(matches("path-north-dashed", "north-end")).toBe(true);
    expect(matches("path-north-solid", "north-leg")).toBe(false);
    expect(matches("path-south-dashed", "north-leg")).toBe(false);
    expect(line("path-north-dashed").paint?.["line-dasharray"]).toEqual([2, 2]);
    expect(line("path-north-solid").paint?.["line-dasharray"]).toBeUndefined();
    expect(mapProps.segments?.map((segment) => segment.id)).toEqual(
      segments.map((segment) => segment.id),
    );
    expect(mapProps.segments?.[0]).toEqual({
      ...segments[0],
      color: "transparent",
    });
    expect(segments).toEqual(original);
  });

  it("retains candidate colors and offsets while focus changes only emphasis, without requesting a new camera", () => {
    const focus = { revision: "supplied-camera", facilityIds: ["north"] };
    const props = { ...baseProps, map: { ...map, focus } };
    const { rerender } = render(<InvestigationWorkspace {...props} />);
    const geometry = overlay().data.features.map((item) => item.geometry);
    const initialWidth = paint("path-north-solid", "line-width", "shared-leg");
    const initialOffset = paint(
      "path-north-solid",
      "line-offset",
      "shared-leg",
    );
    const initialColor = paint("path-north-solid", "line-color", "shared-leg");

    rerender(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "path", pathId: "north" }}
      />,
    );
    expect(mapProps.focus).toBe(focus);
    expect(overlay().data.features.map((item) => item.geometry)).toEqual(
      geometry,
    );
    expect(paint("path-north-solid", "line-offset", "shared-leg")).toBe(
      initialOffset,
    );
    expect(paint("path-north-solid", "line-color", "shared-leg")).toEqual(
      initialColor,
    );
    expect(
      paint("path-north-solid", "line-width", "shared-leg"),
    ).toBeGreaterThan(initialWidth);
    expect(paint("path-south-solid", "line-width", "shared-leg")).toBe(
      initialWidth,
    );
    expect(matches("selection", "shared-leg")).toBe(false);
    expect(matches("candidate-selection", "north-leg")).toBe(false);

    rerender(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "path", pathId: "south", eventId: "south-scan" }}
      />,
    );
    expect(mapProps.focus).toBe(focus);
    expect(paint("path-north-solid", "line-width", "shared-leg")).toBe(
      initialWidth,
    );
    expect(
      paint("path-south-solid", "line-width", "shared-leg"),
    ).toBeGreaterThan(initialWidth);
    expect(paint("path-north-solid", "line-offset", "shared-leg")).toBe(
      initialOffset,
    );
    expect(paint("path-north-solid", "line-color", "shared-leg")).toEqual(
      initialColor,
    );
  });

  it("keeps an uncolored shared member visible without attributing its exclusive segments to another path", () => {
    const paths = [coloredPaths[0], records.paths[1]];
    const { container } = render(
      <InvestigationWorkspace {...baseProps} paths={paths} />,
    );
    expect(matches("path-south-solid", "shared-leg")).toBe(true);
    expect(matches("path-south-dashed", "south-leg")).toBe(false);
    expect(line("path-south-solid").paint?.["line-color"]).toBe(
      mapProps.segments?.find((segment) => segment.id === "south-leg")?.color,
    );
    expect(
      paint("path-south-solid", "line-offset", "shared-leg"),
    ).toBeGreaterThan(0);
    expect(
      mapProps.segments?.find((segment) => segment.id === "south-leg")?.color,
    ).not.toBe("transparent");
    expect(container.querySelector('[data-path-id="south"]')).toBeNull();
    expect(timelineProps.pathColors).toEqual({ north: northColor });
  });

  it("colors locations from all explicit event memberships, keeping shared and unassigned places neutral", () => {
    const locations = records.locations.map((location) =>
      location.id === "destination"
        ? { ...location, color: "#b84c24", labelMinZoom: 0 }
        : location,
    );
    const props = { ...baseProps, locations };
    const { rerender } = render(<InvestigationWorkspace {...props} />);
    const colors = () =>
      Object.fromEntries(
        mapProps.facilities!.map((location) => [location.id, location.color]),
      );
    const initial = colors();
    expect(initial.north).toBe(northColor);
    expect(initial.south).toBe(southColor);
    expect(initial.origin).toBe(initial.shared);
    expect(initial.shared).toBe(initial.unobserved);
    expect(initial.shared).not.toBe(northColor);
    expect(initial.shared).not.toBe(southColor);
    expect(initial.destination).toBe("#b84c24");
    expect(
      mapProps.facilities?.find((location) => location.id === "destination")
        ?.labelMinZoom,
    ).toBe(0);

    rerender(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "path", pathId: "north", eventId: "accepted" }}
      />,
    );
    expect(colors()).toEqual(initial);

    // Repeated visits at a place participate independently; focusing the north
    // visit must not hide the other visit's explicit south membership.
    rerender(
      <InvestigationWorkspace
        {...props}
        events={[
          ...records.events,
          {
            id: "south-revisit",
            label: "Another observation",
            locationId: "north",
            pathIds: ["south"],
          },
        ]}
        selection={{ type: "event", eventId: "north-scan" }}
      />,
    );
    expect(colors().north).toBe(initial.shared);

    rerender(
      <InvestigationWorkspace
        {...props}
        paths={[coloredPaths[0], records.paths[1]]}
      />,
    );
    expect(colors().south).toBe(initial.shared);
    expect(colors().north).toBe(northColor);
    expect(
      locations.find((location) => location.id === "north")?.color,
    ).toBeUndefined();
  });

  it("respects explicit segment colors and leaves undrawable records intact", () => {
    const segments: MapSegment[] = records.segments.map((segment, index) =>
      index === 0
        ? { ...segment, color: "#b84c24" }
        : index === 1
          ? { ...segment, evidence: "measured" }
          : segment,
    );
    render(
      <InvestigationWorkspace
        {...baseProps}
        segments={segments}
        selection={{ type: "path", pathId: "north" }}
      />,
    );
    expect(mapProps.segments?.[0]).toEqual(segments[0]);
    expect(matches("path-north-solid", "shared-leg")).toBe(false);
    expect(matches("path-south-solid", "shared-leg")).toBe(false);
    expect(matches("selection", "shared-leg")).toBe(true);
    expect(String(paint("selection", "line-color", "shared-leg"))).toBe(
      "rgba(184,76,36,1)",
    );
    expect(overlay().data.features.map((item) => item.id)).not.toContain(
      "north-leg",
    );
    expect(mapProps.segments?.[1]).toMatchObject({
      id: "north-leg",
      evidence: "measured",
    });
    expect(mapProps.segments?.[1].color).not.toBe("transparent");
  });

  it("keeps the uncolored default presentation unchanged", () => {
    const { container } = render(
      <InvestigationWorkspace
        {...records}
        map={map}
        selection={{ type: "path", pathId: "north" }}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(mapProps.segments).toBe(records.segments);
    expect(timelineProps.pathColors).toBeUndefined();
    expect(overlay().layers.map((layer) => layer.id)).toEqual([
      "selection",
      "hit-area",
    ]);
    expect(matches("selection", "shared-leg")).toBe(true);
    expect(line("selection").paint?.["line-color"]).toBe("#608cff");
    expect(container.querySelector("[data-path-color]")).toBeNull();
    expect(
      overlay().data.features.some((item) => item.properties?.candidateColored),
    ).toBe(false);
  });

  it("offers comparison content only for an available focused path, including scoped event stepping", () => {
    const change = vi.fn();
    const action = vi.fn();
    const comparison = vi.fn((context: InvestigationDetailsContext) => (
      <button onClick={action}>Compare {context.path?.label}</button>
    ));
    const suppliedOverlay: MapOverlay = {
      id: "caller-prediction",
      data: { type: "FeatureCollection", features: [] },
      layers: [],
    };
    const props = {
      ...baseProps,
      map: { ...map, overlays: [suppliedOverlay] },
      onSelectionChange: change,
      renderPathComparison: comparison,
    };
    const { container, rerender } = render(
      <InvestigationWorkspace {...props} />,
    );
    expect(comparison).not.toHaveBeenCalled();
    expect(container.querySelector("[data-path-comparison]")).toBeNull();

    rerender(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "path", pathId: "north" }}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Compare Via North Gate",
    });
    expect(button.closest("[data-view-panel]")).toHaveAttribute(
      "data-view-panel",
      "map",
    );
    expect(comparison.mock.lastCall?.[0]).toMatchObject({
      path: { id: "north", color: northColor },
      isAvailable: true,
    });
    fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
    expect(mapProps.overlays?.[0]).toBe(suppliedOverlay);
    expect(container.querySelector("button button")).toBeNull();

    rerender(
      <InvestigationWorkspace
        {...props}
        selection={{ type: "path", pathId: "north", eventId: "north-scan" }}
      />,
    );
    expect(comparison.mock.lastCall?.[0]).toMatchObject({
      path: { id: "north" },
      event: { id: "north-scan" },
    });
    const otherSelections: InvestigationSelection[] = [
      { type: "event", eventId: "north-scan" },
      { type: "segment", segmentId: "north-leg" },
      { type: "location", locationId: "north" },
      { type: "path", pathId: "removed" },
      null,
    ];
    comparison.mockClear();
    for (const selection of otherSelections) {
      rerender(<InvestigationWorkspace {...props} selection={selection} />);
      expect(container.querySelector("[data-path-comparison]")).toBeNull();
    }
    expect(comparison).not.toHaveBeenCalled();
  });

  it("omits the comparison wrapper when the caller has no comparison for the focused path", () => {
    const { container } = render(
      <InvestigationWorkspace
        {...baseProps}
        selection={{ type: "path", pathId: "south" }}
        renderPathComparison={() => null}
      />,
    );
    expect(container.querySelector("[data-path-comparison]")).toBeNull();
  });
});
