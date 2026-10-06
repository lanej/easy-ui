import React from "react";
import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { NetworkMap, type NetworkMapProps } from "../NetworkMap";
import { ThemeProvider } from "../Theme";
import { render, userClick } from "../utilities/test";
import { NetworkInvestigationMap } from "./NetworkInvestigationMap.examples";
import { facilities, segments, weather } from "./NetworkGuide.fixtures";
import { basemap, darkBasemap } from "./NetworkGuide.geography";

vi.mock("../NetworkMap", () => ({
  NetworkMap: vi.fn(({ title, onFacilitySelect }: NetworkMapProps) => (
    <section aria-label={title ?? "Transfer network"}>
      <button onClick={() => onFacilitySelect?.("chi")}>Select Chicago</button>
    </section>
  )),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

it("requires no heading and forwards caller-controlled presentation and overlays", () => {
  render(
    <ThemeProvider colorScheme="light">
      <NetworkInvestigationMap
        controls={false}
        showLegend={false}
        showViewScale={false}
        showDataTable={false}
        overlays={[]}
      />
    </ThemeProvider>,
  );
  const props = vi.mocked(NetworkMap).mock.lastCall?.[0];
  expect(props?.title).toBeUndefined();
  expect(props?.description).toBeUndefined();
  expect(props).toMatchObject({
    controls: false,
    showLegend: false,
    showViewScale: false,
    showDataTable: false,
    overlays: [],
    "aria-label": "Transfer network",
  });
});

it.each(["light", "dark"] as const)(
  "works independently with the %s theme and selected outgoing cohort",
  (scheme) => {
    render(
      <ThemeProvider colorScheme={scheme}>
        <NetworkInvestigationMap selectedFacilityId="dtw" />
      </ThemeProvider>,
    );
    expect(NetworkMap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        facilities,
        areas: weather,
        segments: segments.filter((segment) => segment.from === "dtw"),
        mapStyle: scheme === "dark" ? darkBasemap : basemap,
        selectedFacilityId: "dtw",
        showSelectionDetails: false,
        showDataTable: true,
        height: 360,
      }),
      undefined,
    );
  },
);

it("notifies the parent and follows its controlled selection without remounting", async () => {
  const onFacilitySelect = vi.fn();
  const { user, rerender } = render(
    <ThemeProvider colorScheme="light">
      <NetworkInvestigationMap
        selectedFacilityId="dtw"
        onFacilitySelect={onFacilitySelect}
      />
    </ThemeProvider>,
  );
  const map = screen.getByRole("region", {
    name: "Transfer network",
  });
  await userClick(user, screen.getByRole("button", { name: "Select Chicago" }));
  expect(onFacilitySelect).toHaveBeenCalledWith("chi");
  expect(vi.mocked(NetworkMap).mock.lastCall?.[0].selectedFacilityId).toBe(
    "dtw",
  );

  rerender(
    <ThemeProvider colorScheme="light">
      <NetworkInvestigationMap
        selectedFacilityId="chi"
        onFacilitySelect={onFacilitySelect}
      />
    </ThemeProvider>,
  );
  expect(NetworkMap).toHaveBeenLastCalledWith(
    expect.objectContaining({
      selectedFacilityId: "chi",
      segments: segments.filter((segment) => segment.from === "chi"),
    }),
    undefined,
  );
  expect(screen.getByRole("region", { name: "Transfer network" })).toBe(map);
});

it("forwards optional table visibility and custom map height", () => {
  render(
    <ThemeProvider colorScheme="light">
      <NetworkInvestigationMap
        selectedFacilityId="dtw"
        showDataTable={false}
        height={480}
      />
    </ThemeProvider>,
  );
  expect(NetworkMap).toHaveBeenLastCalledWith(
    expect.objectContaining({ showDataTable: false, height: 480 }),
    undefined,
  );
});

it("does not substitute a different cohort for an unknown selection", () => {
  render(
    <ThemeProvider colorScheme="light">
      <NetworkInvestigationMap selectedFacilityId="unknown" />
    </ThemeProvider>,
  );
  expect(NetworkMap).toHaveBeenLastCalledWith(
    expect.objectContaining({
      selectedFacilityId: "unknown",
      segments: [],
    }),
    undefined,
  );
});
