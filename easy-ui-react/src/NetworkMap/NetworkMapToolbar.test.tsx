import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NetworkMapToolbar } from "./NetworkMapToolbar";
import userEvent from "@testing-library/user-event";
import type { MapOverlay, MapSurfaceMetric } from "./types";

const overlay: MapOverlay = {
  id: "coverage",
  data: { type: "FeatureCollection", features: [] },
  layers: [{ id: "area", type: "fill" }],
  visible: false,
};
const props = {
  accessibleName: "Map",
  controls: {
    fitAll: true,
    selectedSegment: true,
    latestEvent: true,
    risk: true,
    weather: true,
    deliverySurface: true,
    navigation: true,
    scale: true,
  },
  ready: true,
  visibility: { risk: true, weather: false, deliverySurface: false },
  onVisibilityChange: vi.fn(),
  onOverlayVisibilityChange: vi.fn(),
  onFitAll: vi.fn(),
  onSelectedSegment: vi.fn(),
  onLatestEvent: vi.fn(),
  overlays: [overlay],
};

beforeEach(() => vi.clearAllMocks());

it("replaces built-in checkbox labels and actions with an ordered caller-defined list", () => {
  render(
    <NetworkMapToolbar
      {...props}
      toolbarControls={[
        {
          id: "coverage",
          type: "overlay",
          overlayId: "coverage",
          label: "Delivery zones",
        },
        {
          id: "fit",
          type: "action",
          action: "fitAll",
          label: "Show entire region",
        },
        {
          id: "risk",
          type: "layer",
          layer: "risk",
          label: "Exception exposure",
        },
      ]}
    />,
  );
  expect(screen.queryByText("Facility risk")).toBeNull();
  expect(screen.queryByText("Weather")).toBeNull();
  const inputs = screen.getAllByRole("checkbox");
  expect(
    inputs.map((input) => input.parentElement!.textContent?.trim()),
  ).toEqual(["Delivery zones", "Exception exposure"]);
  expect(screen.getByRole("group").textContent).toMatch(
    /Delivery zones.*Show entire region.*Exception exposure/,
  );
  fireEvent.click(inputs[0]);
  expect(props.onOverlayVisibilityChange).toHaveBeenCalledWith(
    "coverage",
    true,
  );
  fireEvent.click(inputs[1]);
  expect(props.onVisibilityChange).toHaveBeenCalledWith("risk", false);
  fireEvent.click(screen.getByRole("button", { name: "Show entire region" }));
  expect(props.onFitAll).toHaveBeenCalledOnce();
});

it("can omit every toolbar item without removing data or native controls", () => {
  const { container } = render(
    <NetworkMapToolbar {...props} toolbarControls={[]} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it("omits missing overlay targets and disabled built-in flags while retaining hidden overlays", () => {
  render(
    <NetworkMapToolbar
      {...props}
      controls={{ ...props.controls, risk: false }}
      toolbarControls={[
        {
          id: "missing",
          type: "overlay",
          overlayId: "unknown",
          label: "Missing",
        },
        {
          id: "coverage",
          type: "overlay",
          overlayId: "coverage",
          label: "Coverage",
        },
        { id: "risk", type: "layer", layer: "risk", label: "Risk" },
      ]}
    />,
  );
  expect(screen.queryByRole("checkbox", { name: "Missing" })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: "Risk" })).toBeNull();
  expect(screen.getByRole("checkbox", { name: "Coverage" })).not.toBeChecked();
});

it("supports custom buttons and per-item disabling", () => {
  const onPress = vi.fn();
  render(
    <NetworkMapToolbar
      {...props}
      toolbarControls={[
        { id: "custom", type: "button", label: "Inspect selection", onPress },
        {
          id: "coverage",
          type: "overlay",
          overlayId: "coverage",
          label: "Coverage",
          disabled: true,
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Inspect selection" }));
  expect(onPress).toHaveBeenCalledOnce();
  expect(screen.getByRole("checkbox", { name: "Coverage" })).toBeDisabled();
});

it("disables all configured controls while the engine initializes", () => {
  render(
    <NetworkMapToolbar
      {...props}
      ready={false}
      toolbarControls={[
        { id: "fit", type: "action", action: "fitAll", label: "Fit" },
        {
          id: "coverage",
          type: "overlay",
          overlayId: "coverage",
          label: "Coverage",
        },
      ]}
    />,
  );
  expect(screen.getByRole("button", { name: "Fit" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Coverage" })).toBeDisabled();
});

it("can explicitly include the surface metric selector with a custom name", () => {
  const metrics: MapSurfaceMetric[] = [
    { key: "median", label: "Median", field: "medianMinutes", colorScale: [] },
    { key: "count", label: "Count", field: "n", colorScale: [] },
  ];
  const onMetricChange = vi.fn();
  render(
    <NetworkMapToolbar
      {...props}
      metrics={metrics}
      activeMetricKey="median"
      onMetricChange={onMetricChange}
      toolbarControls={[
        { id: "metrics", type: "surfaceMetrics", label: "Observation measure" },
      ]}
    />,
  );
  expect(
    screen.getByRole("radiogroup", { name: "Observation measure" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Count" }));
  expect(onMetricChange).toHaveBeenCalledWith("count");
});

it("prefers external metric group labels over a conflicting fallback", () => {
  render(
    <>
      <h2 id="external-heading">Warehouse context</h2>
      <p id="external-period">September</p>
      <NetworkMapToolbar
        {...props}
        accessibleName="Explicit fallback"
        labelledBy="external-heading external-period"
        metrics={[{ key: "count", label: "Count", field: "n", colorScale: [] }]}
        activeMetricKey="count"
        onMetricChange={vi.fn()}
      />
    </>,
  );
  expect(screen.getByRole("radiogroup")).toHaveAccessibleName(
    "Warehouse context September delivery surface metric",
  );
});

it("activates composed buttons and checkboxes exactly once from the keyboard", async () => {
  const user = userEvent.setup();
  const onPress = vi.fn();
  render(
    <NetworkMapToolbar
      {...props}
      toolbarControls={[
        { id: "custom", type: "button", label: "Inspect selection", onPress },
        {
          id: "coverage",
          type: "overlay",
          overlayId: "coverage",
          label: "Coverage",
        },
      ]}
    />,
  );
  act(() => screen.getByRole("button", { name: "Inspect selection" }).focus());
  await user.keyboard("{Enter} ");
  expect(onPress).toHaveBeenCalledTimes(2);
  act(() => screen.getByRole("checkbox", { name: "Coverage" }).focus());
  await user.keyboard(" ");
  expect(props.onOverlayVisibilityChange).toHaveBeenCalledOnce();
  expect(props.onOverlayVisibilityChange).toHaveBeenCalledWith(
    "coverage",
    true,
  );
});

it("keeps controlled metric groups isolated when using arrow keys", async () => {
  const user = userEvent.setup();
  const metrics: MapSurfaceMetric[] = [
    { key: "median", label: "Median", field: "medianMinutes", colorScale: [] },
    { key: "count", label: "Count", field: "n", colorScale: [] },
  ];
  function MetricToolbar({ name }: { name: string }) {
    const [metric, setMetric] = React.useState("median");
    return (
      <NetworkMapToolbar
        {...props}
        accessibleName={name}
        metrics={metrics}
        activeMetricKey={metric}
        onMetricChange={setMetric}
        toolbarControls={[
          { id: "metrics", type: "surfaceMetrics", label: name },
        ]}
      />
    );
  }
  render(
    <>
      <MetricToolbar name="First map" />
      <MetricToolbar name="Second map" />
    </>,
  );
  const radios = screen.getAllByRole("radio");
  expect(radios[0]).not.toHaveAttribute("name", radios[2].getAttribute("name"));
  act(() => radios[0].focus());
  await user.keyboard("{ArrowRight}");
  expect(radios[1]).toBeChecked();
  expect(radios[2]).toBeChecked();
  expect(radios[3]).not.toBeChecked();
});
