import React from "react";
import userEvent from "@testing-library/user-event";
import { Button } from "../Button";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import type { Map as MapInstance } from "maplibre-gl";
import { useMapInspection } from "./useMapInspection";
import { NetworkMapProvider, useNetworkMap } from "./NetworkMapContext";
import { NetworkMapInspectionTrigger } from "./NetworkMapInspectionTrigger";
import { NetworkMapCellPopover } from "./NetworkMapCellPopover";
import type { MapOverlay, NetworkMapProps } from "./types";

beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  ),
);
afterEach(() => vi.unstubAllGlobals());

const feature: MapOverlay["data"]["features"][number] = {
  type: "Feature",
  id: 0,
  properties: { count: 2 },
  geometry: { type: "Point", coordinates: [1, 2] },
};
const overlay: MapOverlay = {
  id: "scans",
  data: { type: "FeatureCollection", features: [feature] },
  layers: [{ id: "points", type: "circle" }],
};
const options: NetworkMapProps = {
  mapStyle: { version: 8, sources: {}, layers: [] },
  workerUrl: "/worker.js",
  overlays: [overlay],
  facilities: [
    { id: "a", label: "Facility A", coordinates: [1, 2], kind: "hub" },
  ],
  renderOverlayHoverDetails: () => "Details",
  renderFacilityDetails: () => "Facility metadata",
};
const selection = {
  overlayId: overlay.id,
  feature,
  coordinate: [1, 2] as const,
};
const open = (
  events: ReturnType<typeof useMapInspection>["events"],
  pinned = false,
) => events.inspect([selection], [1, 2], 10, 20, pinned);

it("keeps stable events, original records and fresh immutable data with typed IDs", () => {
  const { result, rerender } = renderHook(useMapInspection, {
    initialProps: options,
  });
  const events = result.current.events;
  act(() => open(events, true));
  expect(result.current.selections?.[0].feature).toBe(feature);
  const updated = { ...feature, properties: { count: 12 } };
  rerender({
    ...options,
    overlays: [
      {
        ...overlay,
        data: { ...overlay.data, features: [updated, { ...feature, id: "0" }] },
      },
    ],
  });
  expect(result.current.selections?.[0].feature).toBe(updated);
  expect(result.current.events).toBe(events);
});

it.each([
  "hidden",
  "removed",
  "empty",
  "noRenderer",
  "hiddenLayers",
  "ambiguous",
  "context",
])("clears stale pinned inspection on %s", (condition) => {
  const { result, rerender } = renderHook(useMapInspection, {
    initialProps: options,
  });
  act(() => open(result.current.events, true));
  const next = { ...options };
  if (condition === "hidden") next.overlays = [{ ...overlay, visible: false }];
  if (condition === "removed") next.overlays = [];
  if (condition === "empty")
    next.overlays = [{ ...overlay, data: { ...overlay.data, features: [] } }];
  if (condition === "noRenderer") next.renderOverlayHoverDetails = undefined;
  if (condition === "hiddenLayers")
    next.overlays = [
      {
        ...overlay,
        layers: [
          { id: "points", type: "circle", layout: { visibility: "none" } },
        ],
      },
    ];
  if (condition === "ambiguous")
    next.overlays = [
      {
        ...overlay,
        data: { ...overlay.data, features: [{ ...feature }, { ...feature }] },
      },
    ];
  if (condition === "context") next.inspectionRevision = "new-checkpoint";
  rerender(next);
  expect(result.current.inspection).toBeNull();
});

it("drops hidden overlap members and refuses to guess anonymous replacements", () => {
  const anonymous = { ...feature, id: undefined };
  const extra = {
    ...overlay,
    id: "extra",
    data: { ...overlay.data, features: [anonymous] },
  };
  const { result, rerender } = renderHook(useMapInspection, {
    initialProps: { ...options, overlays: [overlay, extra] },
  });
  act(() =>
    result.current.events.inspect(
      [selection, { overlayId: "extra", feature: anonymous }],
      [1, 2],
      10,
      20,
      true,
    ),
  );
  rerender({ ...options, overlays: [overlay, { ...extra, visible: false }] });
  expect(result.current.selections).toHaveLength(1);
  rerender({ ...options, overlays: [extra] });
  act(() =>
    result.current.events.inspect(
      [{ overlayId: "extra", feature: anonymous }],
      [1, 2],
      10,
      20,
      true,
    ),
  );
  rerender({
    ...options,
    overlays: [
      { ...extra, data: { ...extra.data, features: [{ ...anonymous }] } },
    ],
  });
  expect(result.current.inspection).toBeNull();
});

it("allows pointer handoff, cancels pending leave and prevents reopening after dismissal", () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(useMapInspection, {
    initialProps: options,
  });
  act(() => open(result.current.events));
  act(() => result.current.events.leave());
  act(() => result.current.events.keep());
  act(() => vi.advanceTimersByTime(200));
  expect(result.current.inspection).not.toBeNull();
  act(() => result.current.events.close());
  act(() => open(result.current.events));
  expect(result.current.inspection).toBeNull();
  act(() => result.current.events.leave());
  act(() => vi.advanceTimersByTime(200));
  act(() => open(result.current.events));
  expect(result.current.inspection).not.toBeNull();
  unmount();
  vi.useRealTimers();
});

it("dismisses hover on movement but follows a pinned coordinate and disposes the engine", () => {
  const { result } = renderHook(useMapInspection, { initialProps: options });
  const element = document.createElement("div");
  document.body.append(element);
  const map = {
    project: vi.fn(() => ({ x: 30, y: 40 })),
  } as unknown as MapInstance;
  let dispose: () => void;
  act(() => {
    dispose = result.current.events.attach(map, element);
    open(result.current.events);
  });
  act(() => result.current.events.move());
  expect(result.current.inspection).toBeNull();
  act(() => open(result.current.events, true));
  act(() => result.current.events.move());
  expect(result.current.inspection).toMatchObject({
    x: 30,
    y: 40,
    pinned: true,
  });
  act(() => dispose());
  expect(result.current.inspection).toBeNull();
  element.remove();
});

it("retains legacy selected-feature details without enabling hover", () => {
  const { result } = renderHook(useMapInspection, {
    initialProps: {
      ...options,
      renderOverlayHoverDetails: undefined,
      renderOverlayDetails: () => "Legacy",
    },
  });
  act(() => open(result.current.events));
  expect(result.current.inspection).toBeNull();
  act(() => open(result.current.events, true));
  expect(result.current.inspection?.pinned).toBe(true);
});

function Card() {
  const { mapInspection: m } = useNetworkMap();
  const i = m.inspection;
  return (
    i && (
      <NetworkMapCellPopover
        id={m.id}
        elementRef={m.card}
        returnFocusElement={i.anchor}
        positioning="viewport"
        x={i.x}
        y={i.y}
        pinned={i.pinned}
        onClose={m.events.close}
        onPin={m.events.pin}
        onEnter={m.events.keep}
        onLeave={m.events.leave}
        label="Facility details"
      >
        {m.facility?.label}
      </NetworkMapCellPopover>
    )
  );
}
function Fixture(props: NetworkMapProps) {
  return (
    <NetworkMapProvider {...props}>
      <NetworkMapInspectionTrigger target={{ facilityId: "a" }}>
        <button onClick={() => undefined}>Inspect facility</button>
      </NetworkMapInspectionTrigger>
      <Card />
    </NetworkMapProvider>
  );
}
it("shares public focus, click pinning, Escape dismissal and focus restoration", () => {
  const { rerender } = render(<Fixture {...options} />);
  const trigger = screen.getByRole("button", { name: "Inspect facility" });
  act(() => trigger.focus());
  expect(
    screen.getByRole("region", { name: "Facility details" }),
  ).toHaveTextContent("Facility A");
  expect(trigger.getAttribute("aria-describedby")).toBeTruthy();
  fireEvent.click(trigger);
  expect(
    screen.queryByRole("button", { name: "Keep open" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Close cell details" }),
  ).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(
    screen.queryByRole("region", { name: "Facility details" }),
  ).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(trigger).not.toHaveAttribute("aria-describedby");
  act(() => {
    trigger.blur();
    trigger.focus();
  });
  expect(
    screen.getByRole("region", { name: "Facility details" }),
  ).toBeInTheDocument();
  fireEvent.click(trigger);
  expect(
    screen.getByRole("button", { name: "Close cell details" }),
  ).toHaveFocus();
  rerender(<Fixture {...options} inspectionRevision="next" />);
  expect(
    screen.queryByRole("region", { name: "Facility details" }),
  ).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("lets a different DOM trigger inspect a dismissed facility and clears suppression after pointer exit", () => {
  const { result } = renderHook(useMapInspection, { initialProps: options });
  const marker = document.createElement("button"),
    control = document.createElement("button");
  act(() => result.current.events.target({ facilityId: "a" }, marker));
  act(() => result.current.events.close());
  act(() => result.current.events.target({ facilityId: "a" }, marker));
  expect(result.current.inspection).toBeNull();
  act(() => result.current.events.target({ facilityId: "a" }, control));
  expect(result.current.inspection?.anchor).toBe(control);
  act(() => result.current.events.close());
  fireEvent.pointerMove(document.body);
  act(() => result.current.events.target({ facilityId: "a" }, control));
  expect(result.current.inspection?.anchor).toBe(control);
});

it("declines an invisible pin so populated facility hover and Escape remain available", () => {
  const a = options.facilities![0],
    b = { ...a, id: "b", label: "Facility B" };
  const { result } = renderHook(useMapInspection, {
    initialProps: {
      ...options,
      facilities: [a, b],
      renderFacilityDetails: ({ facility }) =>
        facility.id === "a" ? null : "B details",
    },
  });
  const anchor = document.createElement("button");
  act(() => result.current.events.target({ facilityId: "a" }, anchor, true));
  expect(result.current.inspection).toBeNull();
  act(() => result.current.events.target({ facilityId: "b" }, anchor));
  expect(result.current.inspection?.facilityId).toBe("b");
});
it("inspects collection metadata without fabricating geographic features", () => {
  const empty = { ...overlay, data: { ...overlay.data, features: [] } };
  const renderDetails = vi.fn(
    ({ overlays }: { overlays: readonly MapOverlay[] }) => overlays[0].id,
  );
  const { result, rerender } = renderHook(useMapInspection, {
    initialProps: {
      ...options,
      overlays: [empty],
      renderOverlayHoverDetails: renderDetails,
    },
  });
  const anchor = document.createElement("button");
  act(() => result.current.events.target({ overlayId: "scans" }, anchor, true));
  expect(result.current.content).toBe("scans");
  expect(result.current.selections).toEqual([]);
  expect(renderDetails).toHaveBeenLastCalledWith({
    overlays: [empty],
    selections: [],
    coordinate: undefined,
  });
  rerender({
    ...options,
    overlays: [{ ...empty, visible: false }],
    renderOverlayHoverDetails: renderDetails,
  });
  expect(result.current.inspection).toBeNull();
});

it.each(["{Enter}", "[Space]"])(
  "pins a React Aria press control with %s while preserving its application action",
  async (key) => {
    const onPress = vi.fn();
    render(
      <NetworkMapProvider {...options}>
        <NetworkMapInspectionTrigger target={{ facilityId: "a" }}>
          <Button onPress={onPress}>Inspect press control</Button>
        </NetworkMapInspectionTrigger>
        <Card />
      </NetworkMapProvider>,
    );
    const trigger = screen.getByRole("button", {
      name: "Inspect press control",
    });
    act(() => trigger.focus());
    await userEvent.setup().keyboard(key);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Keep open" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close cell details" }),
    ).toHaveFocus();
  },
);

it.each([
  [
    "ordinary link Space",
    <a key="link" href="/details" data-testid="keyboard-target">
      Reference link
    </a>,
    " ",
  ],
  [
    "ARIA disabled control",
    <button key="disabled" aria-disabled="true" data-testid="keyboard-target">
      Disabled action
    </button>,
    "Enter",
  ],
  [
    "fieldset disabled control",
    <fieldset key="fieldset" disabled>
      <button data-testid="keyboard-target">Disabled action</button>
    </fieldset>,
    "Enter",
  ],
  [
    "editable input",
    <div key="input" role="button" tabIndex={0}>
      <input aria-label="Edit reference" data-testid="keyboard-target" />
    </div>,
    " ",
  ],
  [
    "editable content",
    <div key="editable" role="button" tabIndex={0}>
      <span contentEditable tabIndex={0} data-testid="keyboard-target" />
    </div>,
    " ",
  ],
])("does not pin for %s", (_name, control, key) => {
  render(
    <NetworkMapProvider {...options}>
      <NetworkMapInspectionTrigger target={{ facilityId: "a" }}>
        {control}
      </NetworkMapInspectionTrigger>
      <Card />
    </NetworkMapProvider>,
  );
  const target = screen.getByTestId("keyboard-target");
  fireEvent.focus(target);
  fireEvent.keyUp(target, { key });
  expect(screen.getByRole("button", { name: "Keep open" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Close cell details" }),
  ).not.toHaveFocus();
});
