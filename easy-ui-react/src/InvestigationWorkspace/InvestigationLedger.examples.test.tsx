import React from "react";
import { act, render } from "@testing-library/react";
import tokens from "@easypost/easy-ui-tokens/js/tokens";
import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";
import { ThemeProvider, type ColorScheme } from "../Theme";
import {
  InvestigationWorkspace,
  type InvestigationWorkspaceProps,
} from "./InvestigationWorkspace";
import { InvestigationLedgerExample } from "./InvestigationLedger.examples";

vi.mock("./InvestigationWorkspace", () => ({
  InvestigationWorkspace: vi.fn((_props: InvestigationWorkspaceProps) => null),
}));

function mockSystemPreference(dark: boolean) {
  const media = Object.assign(new EventTarget(), { matches: dark });
  const subscribe = vi.spyOn(media, "addEventListener");
  const unsubscribe = vi.spyOn(media, "removeEventListener");
  const matchMedia = vi.fn(() => media as MediaQueryList);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    subscribe,
    unsubscribe,
    change(nextDark: boolean) {
      act(() => {
        media.matches = nextDark;
        media.dispatchEvent(new Event("change"));
      });
    },
  };
}

function currentProps() {
  return vi.mocked(InvestigationWorkspace).mock.lastCall![0];
}

function currentStyle() {
  return currentProps().map.mapStyle as StyleSpecification;
}

function palette(scheme: "light" | "dark") {
  return [
    { "background-color": tokens[`theme.${scheme}.color.neutral.000`] },
    { "fill-color": tokens[`theme.${scheme}.color.neutral.100`] },
    {
      "line-color": tokens[`theme.${scheme}.color.neutral.300`],
      "line-width": 0.6,
    },
  ];
}

function expectPalette(scheme: "light" | "dark") {
  expect(currentStyle().layers.map((layer) => layer.paint)).toEqual(
    palette(scheme),
  );
}

function mockReadyMap() {
  const layers = new Map(
    currentStyle().layers.map((layer) => [
      layer.id,
      structuredClone(layer.paint) as Record<string, unknown>,
    ]),
  );
  const events = new EventTarget();
  const setPaintProperty = vi.fn(
    (id: string, property: string, value: unknown) => {
      layers.get(id)![property] = value;
    },
  );
  const once = vi.fn((type: string, listener: EventListener) =>
    events.addEventListener(type, listener, { once: true }),
  );
  const instance = { setPaintProperty, once } as unknown as MapInstance;
  act(() => currentProps().map.onMapReady?.(instance));
  return {
    instance,
    setPaintProperty,
    remove: () => events.dispatchEvent(new Event("remove")),
    expectPalette(scheme: "light" | "dark") {
      expect([...layers.values()]).toEqual(palette(scheme));
    },
  };
}

function ledger(colorScheme: ColorScheme) {
  return (
    <ThemeProvider colorScheme={colorScheme}>
      <InvestigationLedgerExample />
    </ThemeProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["light", false, "light"],
  ["light", true, "light"],
  ["dark", false, "dark"],
  ["dark", true, "dark"],
  ["system", false, "light"],
  ["system", true, "dark"],
  ["inverted", false, "dark"],
  ["inverted", true, "light"],
] as const)(
  "uses the %s theme with OS dark=%s to choose the %s basemap",
  (colorScheme, dark, expected) => {
    mockSystemPreference(dark);
    render(ledger(colorScheme));
    expectPalette(expected);
  },
);

it.each(["system", "inverted"] as const)(
  "updates the %s basemap paint without replacing its style and releases its listener",
  (colorScheme) => {
    const preference = mockSystemPreference(false);
    const { unmount } = render(ledger(colorScheme));
    const initial = currentStyle();
    const map = mockReadyMap();
    map.expectPalette(colorScheme === "system" ? "light" : "dark");
    expect(preference.matchMedia).toHaveBeenCalledWith(
      "(prefers-color-scheme: dark)",
    );
    expect(preference.subscribe).toHaveBeenCalledTimes(1);
    const listener = preference.subscribe.mock.calls[0][1];
    preference.change(true);
    map.expectPalette(colorScheme === "system" ? "dark" : "light");
    expect(currentStyle()).toBe(initial);
    preference.change(false);
    map.expectPalette(colorScheme === "system" ? "light" : "dark");
    expect(currentStyle()).toBe(initial);
    unmount();
    expect(preference.unsubscribe).toHaveBeenCalledExactlyOnceWith(
      "change",
      listener,
    );
  },
);

it.each(["light", "dark"] as const)(
  "keeps the explicit %s basemap independent from OS preference changes",
  (colorScheme) => {
    const preference = mockSystemPreference(false);
    render(ledger(colorScheme));
    const initial = currentStyle();
    preference.change(true);
    expectPalette(colorScheme);
    expect(currentStyle()).toBe(initial);
    expect(preference.subscribe).not.toHaveBeenCalled();
  },
);

it("releases the old subscription when switching modes and reads the current preference when resubscribing", () => {
  const preference = mockSystemPreference(false);
  const { rerender, unmount } = render(ledger("system"));
  const map = mockReadyMap();
  const firstListener = preference.subscribe.mock.calls[0][1];
  preference.change(true);
  map.expectPalette("dark");
  rerender(ledger("light"));
  map.expectPalette("light");
  expect(preference.unsubscribe).toHaveBeenCalledWith("change", firstListener);
  preference.change(false);
  rerender(ledger("inverted"));
  map.expectPalette("dark");
  preference.change(true);
  map.expectPalette("light");
  unmount();
  expect(preference.subscribe).toHaveBeenCalledTimes(2);
  expect(preference.unsubscribe).toHaveBeenCalledTimes(2);
});

it("retains the engine style, selection, and records through repeated OS and explicit theme transitions", () => {
  const preference = mockSystemPreference(false);
  const { rerender } = render(ledger("system"));
  const initial = currentStyle();
  const records = currentProps();
  const map = mockReadyMap();
  const selection = { type: "event", eventId: "a-transit" } as const;
  act(() => currentProps().onSelectionChange(selection));
  const expectRetained = (scheme: "light" | "dark") => {
    map.expectPalette(scheme);
    expect(currentStyle()).toBe(initial);
    expect(currentProps().selection).toEqual(selection);
    for (const key of [
      "events",
      "locations",
      "segments",
      "connections",
    ] as const) {
      expect(currentProps()[key]).toBe(records[key]);
    }
    // Candidate identity and membership remain stable while the supplied
    // presentation colors follow the theme on the same map instance.
    const pathRecords = (props: InvestigationWorkspaceProps) =>
      props.paths?.map(({ id, label, segmentIds, description }) => ({
        id,
        label,
        segmentIds,
        description,
      }));
    expect(pathRecords(currentProps())).toEqual(pathRecords(records));
    expect(currentProps().paths?.map((path) => path.color)).toEqual(
      scheme === "dark"
        ? ["#83a8ff", "#c4a1ff", "#5fd3c6"]
        : ["#2563eb", "#7c3aed", "#087f8c"],
    );
  };
  for (const dark of [true, false, true, false]) {
    preference.change(dark);
    expectRetained(dark ? "dark" : "light");
  }
  for (const scheme of ["inverted", "dark", "light", "system"] as const) {
    rerender(ledger(scheme));
    expectRetained(
      scheme === "inverted" || scheme === "dark" ? "dark" : "light",
    );
  }
});

it("uses the current theme when a map becomes ready and stops painting removed instances", () => {
  const preference = mockSystemPreference(false);
  render(ledger("system"));
  const initial = currentStyle();
  preference.change(true);
  expect(currentStyle()).toBe(initial);
  const first = mockReadyMap();
  first.expectPalette("dark");
  first.remove();
  const writesBeforeRemoval = first.setPaintProperty.mock.calls.length;
  preference.change(false);
  expect(first.setPaintProperty).toHaveBeenCalledTimes(writesBeforeRemoval);
  const replacement = mockReadyMap();
  replacement.expectPalette("light");
  preference.change(true);
  replacement.expectPalette("dark");
  expect(first.setPaintProperty).toHaveBeenCalledTimes(writesBeforeRemoval);
});

it.each([
  ["light", false, "dark"],
  ["light", true, "dark"],
  ["dark", false, "light"],
  ["dark", true, "light"],
  ["system", false, "dark"],
  ["system", true, "light"],
] as const)(
  "inherits nested inversion under %s with OS dark=%s",
  (colorScheme, dark, expected) => {
    mockSystemPreference(dark);
    render(
      <ThemeProvider colorScheme={colorScheme}>
        <ThemeProvider colorScheme="inverted">
          <InvestigationLedgerExample />
        </ThemeProvider>
      </ThemeProvider>,
    );
    expectPalette(expected);
  },
);

it("keeps forecasts optional and scoped to one candidate without adding observations", () => {
  mockSystemPreference(false);
  render(
    <ThemeProvider colorScheme="light">
      <InvestigationLedgerExample withPredictions />
    </ThemeProvider>,
  );
  const original = currentProps();
  const forecasts = original.map.overlays!;
  expect(forecasts).toHaveLength(2);
  expect(forecasts.every((overlay) => overlay.visible)).toBe(true);
  expect(forecasts.map((overlay) => overlay.layers[0])).toEqual([
    expect.objectContaining({
      paint: expect.objectContaining({
        "line-color": "#2563eb",
        "line-dasharray": [6, 3],
      }),
    }),
    expect.objectContaining({
      paint: expect.objectContaining({
        "line-color": "#2563eb",
        "line-dasharray": [1, 3],
      }),
    }),
  ]);
  act(() => currentProps().onSelectionChange({ type: "path", pathId: "b" }));
  expect(currentProps().map.overlays).toEqual([]);
  act(() =>
    currentProps().onSelectionChange({
      type: "path",
      pathId: "a",
      eventId: "a-transit",
    }),
  );
  expect(currentProps().map.overlays?.every((overlay) => overlay.visible)).toBe(
    true,
  );
  act(() =>
    currentProps().onSelectionChange({ type: "event", eventId: "revisit" }),
  );
  expect(currentProps().map.overlays).toEqual([]);
  expect(currentProps().events).toBe(original.events);
  expect(currentProps().connections).toBe(original.connections);
  expect(currentProps().map.mapStyle).toBe(original.map.mapStyle);
});

it.each([
  ["light", "light"],
  ["dark", "dark"],
  ["system", "light"],
  ["inverted", "dark"],
] as const)(
  "uses the %s CSS fallback when matchMedia is unavailable",
  (colorScheme, expected) => {
    vi.stubGlobal("matchMedia", undefined);
    const { unmount } = render(ledger(colorScheme));
    expectPalette(expected);
    unmount();
  },
);
