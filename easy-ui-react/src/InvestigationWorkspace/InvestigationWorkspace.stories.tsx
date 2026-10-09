import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";
import "../NetworkMap/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  InvestigationWorkspace,
  type InvestigationWorkspaceProps,
} from "./InvestigationWorkspace";
import type {
  InvestigationSelection,
  InvestigationDetailsContext,
} from "./selection";
import { investigationRecords } from "./InvestigationWorkspace.fixtures";
import { HealthAssessment } from "../HealthAssessment";
import {
  DurationDistribution,
  DurationQuantileMetrics,
  type DurationHealthRegion,
} from "../DurationDistribution";
import { Button } from "../Button";
import { Text } from "../Text";
import { useColorScheme } from "../Theme";

// Local schematic basemap keeps the examples independent of tile credentials/network access.
const mapStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#e9edf1" },
    },
  ],
};
const darkMapStyle: StyleSpecification = {
  ...mapStyle,
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#172333" },
    },
  ],
};
const regions: DurationHealthRegion[] = [
  { from: 0, to: 10, assessment: "healthy", label: "Expected" },
  { from: 10, to: 20, assessment: "degraded", label: "Attention" },
  { from: 20, to: Infinity, assessment: "unhealthy", label: "Outside" },
];
const quantiles = [
  { fraction: 0.5, value: 9 },
  { fraction: 0.9, value: 18 },
];
function Details({ event, location }: InvestigationDetailsContext) {
  if (!location || !event) return null;
  return (
    <HealthAssessment
      label="Current dwell"
      size="sm"
      variant="wide"
      health={{ assessment: "healthy", label: "As expected" }}
      observation={{ value: 6, unit: "h" }}
      observationDetails={
        <DurationQuantileMetrics
          quantiles={quantiles}
          unit="h"
          healthRegions={regions}
        />
      }
      reference={
        <DurationDistribution
          value={6}
          domain={[0, 30]}
          unit="h"
          quantiles={quantiles}
          currentAssessment="healthy"
          healthRegions={regions}
          stretch={false}
          distributionStyle="smooth"
          bins={[
            { from: 0, to: 5, count: 50 },
            { from: 5, to: 10, count: 300 },
            { from: 10, to: 15, count: 150 },
            { from: 15, to: 20, count: 70 },
            { from: 20, to: 25, count: 20 },
            { from: 25, to: 30, count: 10 },
          ]}
        />
      }
    />
  );
}

const mapOptions = {
  mapStyle,
  workerUrl,
  controls: { fitAll: true, navigation: true },
  height: 300,
  onMapReady: (instance: MapInstance) => {
    (window as Window & { investigationMap?: MapInstance }).investigationMap =
      instance;
  },
};
function Example({
  initial = { type: "event", eventId: "arrived" },
  narrow = false,
  noDetails = false,
  external = false,
  empty = false,
}: {
  initial?: InvestigationSelection;
  narrow?: boolean;
  noDetails?: boolean;
  external?: boolean;
  empty?: boolean;
}) {
  const { resolvedColorScheme } = useColorScheme();
  const [selection, setSelection] = useState<InvestigationSelection>(initial);
  const [snapshot, setSnapshot] = useState(0);
  return (
    <div
      style={{
        maxWidth: narrow ? 380 : 1180,
        margin: "0 auto",
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <Text as="h2" variant="heading3">
          Tracking investigation
        </Text>
        <Text as="p" variant="caption" color="subdued">
          Synthetic observations · Local schematic map · Times in UTC
        </Text>
      </div>
      {external && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            size="sm"
            variant="outlined"
            onPress={() =>
              setSelection({ type: "event", eventId: "unlocated" })
            }
          >
            Select unlocated event externally
          </Button>
          <Button
            size="sm"
            variant="outlined"
            onPress={() => setSnapshot((value) => value + 1)}
          >
            Refresh records
          </Button>
          <Text as="span" variant="caption">
            Snapshot {snapshot + 1}
          </Text>
        </div>
      )}
      <InvestigationWorkspace
        {...investigationRecords}
        events={
          empty
            ? []
            : investigationRecords.events.map((event) => ({ ...event }))
        }
        selection={selection}
        onSelectionChange={setSelection}
        map={{
          ...mapOptions,
          mapStyle: resolvedColorScheme === "dark" ? darkMapStyle : mapStyle,
        }}
        renderDetails={noDetails ? undefined : Details}
      />
    </div>
  );
}
const meta: Meta<typeof InvestigationWorkspace> = {
  title: "Organisms/Investigation/InvestigationWorkspace",
  component: InvestigationWorkspace,
  parameters: { layout: "padded" },
  argTypes: {
    map: { control: false },
    events: { control: false },
    locations: { control: false },
    segments: { control: false },
    paths: { control: false },
    selection: { control: false },
  },
};
export default meta;
type Story = StoryObj<InvestigationWorkspaceProps>;
export const LinkedSelection: Story = { render: () => <Example /> };
export const SharedConnection: Story = {
  render: () => (
    <Example initial={{ type: "segment", segmentId: "shared-leg" }} />
  ),
};
export const ConflictingHistories: Story = {
  render: () => <Example initial={{ type: "event", eventId: "north-scan" }} />,
};
export const MultipleEventsAtLocation: Story = {
  render: () => (
    <Example initial={{ type: "location", locationId: "shared" }} />
  ),
};
export const UnlocatedEvent: Story = {
  render: () => <Example initial={{ type: "event", eventId: "unlocated" }} />,
};
export const LocationWithoutEvents: Story = {
  render: () => (
    <Example initial={{ type: "location", locationId: "unobserved" }} />
  ),
};
export const Narrow: Story = { render: () => <Example narrow /> };
export const SelectionWithoutCharts: Story = {
  render: () => <Example noDetails />,
};
export const ExternalSelection: Story = { render: () => <Example external /> };
export const EmptyEvents: Story = {
  render: () => <Example empty initial={null} />,
};
