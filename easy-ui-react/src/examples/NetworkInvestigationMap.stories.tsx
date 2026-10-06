import React, { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  NetworkInvestigationMap,
  type NetworkInvestigationMapProps,
} from "./NetworkInvestigationMap.examples";
import { facilities } from "./NetworkGuide.fixtures";
import { useColorScheme } from "../Theme";
import { investigationOverlays } from "./NetworkInvestigationMap.overlays";
import { OverlayChartDetails } from "./OverlayChartDetails.examples";
import overlayStyles from "./OverlayChartDetails.module.scss";
import type { Map as MapInstance } from "maplibre-gl";

const overlayMapReady = fn<(map: MapInstance) => void>();
const configuredMapReady = fn<(map: MapInstance) => void>();
const inspectSelection = fn();

const meta = {
  id: "patterns-network-investigation-map",
  title: "Organisms/Maps/NetworkMap/Investigation",
  component: NetworkInvestigationMap,
  args: {
    selectedFacilityId: "dtw",
    showDataTable: true,
    height: 360,
    onFacilitySelect: fn(),
  },
  argTypes: {
    selectedFacilityId: {
      control: "select",
      options: facilities.map((facility) => facility.id),
    },
    showDataTable: { control: "boolean" },
    showLegend: { control: "boolean" },
    showViewScale: { control: "boolean" },
    title: { control: "text" },
    description: { control: "text" },
    controls: { control: "object" },
    toolbarControls: { control: "object" },
    height: { control: { type: "number", min: 220 } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "The standalone map used by Network Investigation. It composes the public NetworkMap component with the synthetic Great Lakes network and local, theme-aware geography. Selection is controlled by the parent; the map does not depend on the investigation workspace or its charts.",
      },
    },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<NetworkInvestigationMapProps>();
    return (
      <NetworkInvestigationMap
        {...args}
        onFacilitySelect={(id) => {
          updateArgs({ selectedFacilityId: id });
          args.onFacilitySelect?.(id);
        }}
      />
    );
  },
} satisfies Meta<typeof NetworkInvestigationMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    if (!args.title) await expect(canvas.queryByRole("heading")).toBeNull();
    if (args.controls === false || args.controls?.fitAll === false)
      await expect(
        canvas.queryByRole("button", { name: "Fit all locations" }),
      ).toBeNull();
    if (args.controls === false || args.controls?.risk === false)
      await expect(
        canvas.queryByRole("checkbox", { name: "Facility risk" }),
      ).toBeNull();
    if (args.controls === false || args.controls?.weather === false)
      await expect(
        canvas.queryByRole("checkbox", { name: "Weather" }),
      ).toBeNull();
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-map-state="ready"]'),
        ).toBeInTheDocument(),
      { timeout: 15000 },
    );
    const attribution = canvasElement.querySelector(
      ".maplibregl-ctrl-attrib-inner a",
    )!;
    await expect(getComputedStyle(attribution).textDecorationLine).toContain(
      "underline",
    );
    const disclosure = canvas.queryByText("Locations and exact data");
    if (args.showDataTable === false) {
      await expect(disclosure).toBeNull();
      await expect(canvas.queryByRole("table")).toBeNull();
    } else {
      await expect(disclosure).toBeInTheDocument();
      await userEvent.click(disclosure!);
      const selected = facilities.find(
        (facility) => facility.id === args.selectedFacilityId,
      );
      const next = args.selectedFacilityId === "chi" ? "Detroit" : "Chicago";
      await userEvent.click(
        canvas.getByRole("button", { name: `Select location: ${next}` }),
      );
      await waitFor(() =>
        expect(
          canvasElement.querySelector(
            `[data-selected="true"][title="${next}"]`,
          ),
        ).toBeInTheDocument(),
      );
      if (selected) {
        await userEvent.click(
          canvas.getByRole("button", {
            name: `Select location: ${selected.label}`,
          }),
        );
        await waitFor(() =>
          expect(
            canvasElement.querySelector(
              `[data-selected="true"][title="${selected.label}"]`,
            ),
          ).toBeInTheDocument(),
        );
      }
      await userEvent.click(disclosure!);
    }
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    );
    canvasElement.dataset.mapExampleChecked = "true";
  },
};

export const Chicago: Story = {
  args: { selectedFacilityId: "chi" },
  play: Default.play,
};

export const WithoutDataTable: Story = {
  args: { showDataTable: false },
  play: Default.play,
};

export const WithHeading: Story = {
  args: {
    title: "Great Lakes transfer network",
    description: "Chicago outgoing cohort · 08:00–14:00 UTC",
    selectedFacilityId: "chi",
    showViewScale: false,
  },
  play: Default.play,
};

export const NoToolbar: Story = {
  args: { controls: { fitAll: false, risk: false, weather: false } },
  play: Default.play,
};

export const ConfiguredBuiltinControls: Story = {
  args: {
    toolbarControls: [
      { id: "fit", type: "action", action: "fitAll", label: "Frame network" },
      {
        id: "exceptions",
        type: "layer",
        layer: "risk",
        label: "Facility exceptions",
      },
      {
        id: "forecast",
        type: "layer",
        layer: "weather",
        label: "Forecast areas",
      },
    ],
  },
  play: async (context) => {
    await Default.play?.(context);
    const canvas = within(context.canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Frame network" }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("checkbox", { name: "Facility exceptions" }),
    ).toBeChecked();
    await expect(
      canvas.getByRole("checkbox", { name: "Forecast areas" }),
    ).not.toBeChecked();
    await expect(canvas.queryByText("Facility risk")).toBeNull();
    await expect(canvas.queryByText("Weather")).toBeNull();
  },
};

export const BareMap: Story = {
  args: { controls: false, showLegend: false, showDataTable: false },
  play: async (context) => {
    await Default.play?.(context);
    const canvas = within(context.canvasElement);
    await expect(canvas.queryByRole("heading")).toBeNull();
    await expect(canvas.queryByRole("checkbox")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Fit all locations" }),
    ).toBeNull();
    await expect(canvas.queryByText(/National view/)).toBeNull();
  },
};

export const RichOverlays: Story = {
  args: {
    facilities: [],
    segments: [],
    areas: [],
    controls: false,
    showLegend: false,
    showDataTable: false,
    height: 520,
    renderOverlayDetails: (context) => (
      <OverlayChartDetails
        key={`${context.overlayId}:${context.feature.id}`}
        {...context}
      />
    ),
    onOverlaySelect: fn(),
    onMapReady: overlayMapReady,
  },
  render: function Render(args) {
    const { resolvedColorScheme } = useColorScheme();
    const scheme = resolvedColorScheme === "dark" ? "dark" : "light";
    const overlays = useMemo(() => investigationOverlays(scheme), [scheme]);
    return (
      <>
        <NetworkInvestigationMap {...args} overlays={overlays} />
        {args.renderOverlayDetails && (
          <div className={overlayStyles.example}>
            <p>
              Select an area, route, or point to inspect its daily parcel
              volume.
            </p>
          </div>
        )}
      </>
    );
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-map-state="ready"]'),
        ).toBeInTheDocument(),
      { timeout: 15000 },
    );
    await expect(canvas.queryByRole("heading")).toBeNull();
    await expect(canvas.queryByRole("checkbox")).toBeNull();
    const calls = overlayMapReady.mock.calls;
    const map = calls[calls.length - 1][0];
    await waitFor(
      () => expect(map.isMoving() || !map.areTilesLoaded()).toBe(false),
      { timeout: 15000 },
    );
    await expect(
      map
        .getStyle()
        .layers.filter((layer) => layer.id.startsWith("easy-ui-overlay-")),
    ).toHaveLength(4);
    await waitFor(
      () =>
        expect(
          map.queryRenderedFeatures({
            layers: ["easy-ui-overlay-observations/points"],
          }).length,
        ).toBeGreaterThan(0),
      { timeout: 15000 },
    );
    const coordinate: [number, number] = [-87.63, 41.88];
    map.fire("click", {
      point: map.project(coordinate),
      lngLat: { lng: coordinate[0], lat: coordinate[1] },
    });
    await expect(args.onOverlaySelect).toHaveBeenCalledWith(
      expect.objectContaining({
        overlayId: "observations",
        coordinate,
        feature: expect.objectContaining({ id: "observation-1" }),
      }),
    );
    const inspector = await canvas.findByRole("region", {
      name: "Overlay feature details",
    });
    await expect(
      within(inspector).getByText("Chicago scan"),
    ).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          inspector.querySelector('[data-chart-state="ready"]'),
        ).toBeInTheDocument(),
      { timeout: 15000 },
    );
    await userEvent.click(
      within(inspector).getByRole("button", { name: "Daily bars" }),
    );
    await expect(
      within(inspector).getByRole("button", { name: "Daily bars" }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      within(inspector).getByRole("button", { name: "Trend" }),
    );
    if (args.showDataTable !== false) {
      await userEvent.click(canvas.getByText("View exact map data"));
      await expect(canvas.getAllByRole("table")).toHaveLength(3);
      await userEvent.click(
        canvas.getByRole("button", {
          name: "Select overlay feature: Chicago scan",
        }),
      );
      await expect(args.onOverlaySelect).toHaveBeenCalledWith(
        expect.objectContaining({
          overlayId: "observations",
          feature: expect.objectContaining({ id: "observation-1" }),
        }),
      );
      await userEvent.click(canvas.getByText("View exact map data"));
    }
    for (const [coordinate, label] of [
      [[-88.1, 42], "Chicago service area"],
      [[-85.9, 41.77], "Supplied route"],
      [[-87.63, 41.88], "Chicago scan"],
    ] as const) {
      const point =
        label === "Supplied route"
          ? map
              .project([-86.16, 41.7])
              .add(map.project([-84.7, 42.1]))
              .div(2)
          : map.project([...coordinate]);
      map.fire("click", {
        point,
        lngLat: map.unproject([point.x, point.y]),
      });
      await waitFor(() =>
        expect(
          canvas.getByRole("region", { name: "Overlay feature details" }),
        ).toHaveTextContent(label),
      );
      await waitFor(
        () =>
          expect(
            canvas
              .getByRole("region", { name: "Overlay feature details" })
              .querySelector('[data-chart-state="ready"]'),
          ).toBeInTheDocument(),
        { timeout: 15000 },
      );
    }
    await waitFor(
      () => expect(map.isMoving() || !map.areTilesLoaded()).toBe(false),
      { timeout: 15000 },
    );
    const mapBounds = canvasElement
      .querySelector('[data-map-state="ready"]')!
      .getBoundingClientRect();
    const cardBounds = canvas
      .getByRole("region", { name: "Overlay feature details" })
      .getBoundingClientRect();
    await expect(cardBounds.left).toBeGreaterThanOrEqual(mapBounds.left);
    await expect(cardBounds.right).toBeLessThanOrEqual(mapBounds.right);
    await expect(cardBounds.bottom).toBeLessThanOrEqual(mapBounds.bottom);
    if (args.showDataTable === false)
      await expect(canvas.queryByText("View exact map data")).toBeNull();
    canvasElement.dataset.mapExampleChecked = "true";
  },
};

export const ConfigurableLayers: Story = {
  args: {
    facilities: [],
    segments: [],
    areas: [],
    showLegend: false,
    showDataTable: false,
    onMapReady: configuredMapReady,
    onOverlayVisibilityChange: fn(),
    toolbarControls: [
      { id: "fit", type: "action", action: "fitAll", label: "Fit coverage" },
      {
        id: "coverage",
        type: "overlay",
        overlayId: "service-area",
        label: "Service coverage",
      },
      {
        id: "route",
        type: "overlay",
        overlayId: "route",
        label: "Transfer route",
      },
      {
        id: "scans",
        type: "overlay",
        overlayId: "observations",
        label: "Scan observations",
      },
      {
        id: "inspect",
        type: "button",
        label: "Inspect selection",
        onPress: inspectSelection,
      },
    ],
  },
  render: RichOverlays.render,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-map-state="ready"]'),
        ).toBeInTheDocument(),
      { timeout: 15000 },
    );
    const calls = configuredMapReady.mock.calls;
    const initialCalls = calls.length;
    const map = calls[initialCalls - 1][0];
    await waitFor(
      () => {
        expect(map.isMoving()).toBe(false);
        expect(map.areTilesLoaded()).toBe(true);
      },
      { timeout: 15000 },
    );
    const initialCenter = map.getCenter().toArray();
    const initialZoom = map.getZoom();
    const layers = [
      ["Service coverage", "service-area", ["fill", "outline"]],
      ["Transfer route", "route", ["line"]],
      ["Scan observations", "observations", ["points"]],
    ] as const;
    for (const [label, overlayId, ids] of layers) {
      const checkbox = canvas.getByRole("checkbox", { name: label });
      await expect(checkbox).toBeChecked();
      await userEvent.click(checkbox);
      await expect(checkbox).not.toBeChecked();
      await waitFor(() => {
        for (const id of ids)
          expect(
            map.getLayoutProperty(
              `easy-ui-overlay-${overlayId}/${id}`,
              "visibility",
            ),
          ).toBe("none");
      });
      await expect(args.onOverlayVisibilityChange).toHaveBeenCalledWith(
        overlayId,
        false,
      );
      await userEvent.click(checkbox);
      await waitFor(() => {
        for (const id of ids)
          expect(
            map.getLayoutProperty(
              `easy-ui-overlay-${overlayId}/${id}`,
              "visibility",
            ),
          ).toBe("visible");
      });
    }
    await expect(configuredMapReady).toHaveBeenCalledTimes(initialCalls);
    await expect(map.getCenter().toArray()).toEqual(initialCenter);
    await expect(map.getZoom()).toBe(initialZoom);
    await userEvent.click(
      canvas.getByRole("button", { name: "Inspect selection" }),
    );
    await expect(inspectSelection).toHaveBeenCalled();
    await expect(canvas.queryByText("Facility risk")).toBeNull();
    await expect(canvas.queryByText("Weather")).toBeNull();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    );
    canvasElement.dataset.mapExampleChecked = "true";
  },
};
