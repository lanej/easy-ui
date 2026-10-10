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
import styles from "./InvestigationWorkspace.stories.module.scss";

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
    <div className={styles.observation}>
      <div className={styles.metricRow}>
        <div className={styles.headline}>
          <HealthAssessment
            label="Current dwell"
            size="sm"
            variant="compact"
            healthPlacement="label"
            health={{
              assessment: "healthy",
              label: "As expected",
              variant: "dot",
            }}
            observation={{ value: 6, unit: "h" }}
          />
        </div>
        <DurationQuantileMetrics
          quantiles={quantiles}
          unit="h"
          healthRegions={regions}
          layout="inline"
        />
      </div>
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
    </div>
  );
}

const mapOptions = {
  mapStyle,
  workerUrl,
  controls: { fitAll: true, navigation: true },
  primaryFacilityIds: ["origin", "destination"],
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
  placementControls = false,
}: {
  initial?: InvestigationSelection;
  narrow?: boolean;
  noDetails?: boolean;
  external?: boolean;
  empty?: boolean;
  placementControls?: boolean;
}) {
  const { resolvedColorScheme } = useColorScheme();
  const [selection, setSelection] = useState<InvestigationSelection>(initial);
  const [snapshot, setSnapshot] = useState(0);
  const [controlPlacement, setControlPlacement] = useState<"map" | "toolbar">(
    "map",
  );
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
      {placementControls && (
        <Button
          size="sm"
          variant="outlined"
          onPress={() =>
            setControlPlacement(controlPlacement === "map" ? "toolbar" : "map")
          }
        >
          Move controls to {controlPlacement === "map" ? "toolbar" : "map"}
        </Button>
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
          controlPlacement,
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
export const ScopedEvent: Story = {
  render: () => (
    <Example initial={{ type: "path", pathId: "north", eventId: "arrived" }} />
  ),
};
export const SelectionWithoutCharts: Story = {
  render: () => <Example noDetails />,
};
export const ExternalSelection: Story = { render: () => <Example external /> };
export const EmptyEvents: Story = {
  render: () => <Example empty initial={null} />,
};
export const ControlPlacement: Story = {
  render: () => <Example placementControls />,
};
