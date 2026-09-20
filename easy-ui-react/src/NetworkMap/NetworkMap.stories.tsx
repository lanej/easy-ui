import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { NetworkMap } from "./NetworkMap";
import { NetworkMapExample } from "./NetworkMap.examples";
import {
  exampleBasemap,
  networkFacilities,
  networkSegments,
  weatherAreas,
} from "./NetworkMap.fixtures";
const meta: Meta<typeof NetworkMapExample> = {
  title: "Components/NetworkMap",
  component: NetworkMapExample,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof NetworkMapExample>;
export const ParcelJourney: Story = {
  render: () => <NetworkMapExample audience="parcel" />,
};
export const ShipperFlow: Story = {
  render: () => <NetworkMapExample audience="shipper" />,
};
export const CarrierOperations: Story = {
  render: () => <NetworkMapExample audience="carrier" />,
};

function ExternalWeatherExample() {
  const [weather, setWeather] = useState(true);
  return (
    <div style={{ padding: 24 }}>
      <label style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={weather}
          onChange={(event) => setWeather(event.target.checked)}
        />
        Show forecast weather
      </label>
      <NetworkMap
        title="Externally controlled weather"
        description="The checkbox above controls weather. Facility risk keeps its independent built-in toggle."
        mapStyle={exampleBasemap}
        workerUrl={workerUrl}
        facilities={networkFacilities}
        segments={networkSegments}
        areas={weatherAreas}
        initialView={{ center: [-83.29, 42.34], zoom: 8.7 }}
        controls={{ weather: false }}
        layerVisibility={{ weather }}
        height={420}
      />
    </div>
  );
}

export const ExternalLayerControls: Story = {
  render: () => <ExternalWeatherExample />,
};
