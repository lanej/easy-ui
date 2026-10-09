import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FacilitySummary, type FacilitySummaryProps } from "./FacilitySummary";
import {
  DurationDistribution,
  DurationQuantileMetrics,
  type DurationHealthRegion,
} from "../DurationDistribution";
import { DataGrid } from "../DataGrid";
import { Text } from "../Text";
const healthRegions: DurationHealthRegion[] = [
  { from: 0, to: 10, assessment: "healthy", label: "Expected" },
  { from: 10, to: 20, assessment: "degraded", label: "Attention" },
  { from: 20, to: Infinity, assessment: "unhealthy", label: "Outside" },
];
const quantiles = [
  { fraction: 0.5, value: 9 },
  { fraction: 0.9, value: 18 },
];
const reference = (smooth = false) => (
  <DurationDistribution
    value={6}
    domain={[0, 30]}
    unit="h"
    quantiles={quantiles}
    healthRegions={healthRegions}
    currentAssessment="healthy"
    showPercentileLabels
    distributionStyle={smooth ? "smooth" : "binned"}
    bins={
      smooth
        ? [
            { from: 0, to: 5, count: 50 },
            { from: 5, to: 10, count: 300 },
            { from: 10, to: 15, count: 150 },
            { from: 15, to: 20, count: 70 },
            { from: 20, to: 25, count: 20 },
            { from: 25, to: 30, count: 10 },
          ]
        : undefined
    }
  />
);
const defaults: FacilitySummaryProps = {
  name: "North Harbor",
  identifier: "FAC-014",
  facilityType: "Distribution center",
  location: "Oakland, CA",
  observations: [
    {
      id: "dwell",
      label: "Current dwell",
      health: { assessment: "healthy", label: "As expected" },
      observation: { value: 6, unit: "h" },
      freshness: { state: "fresh", stateLabel: "Updated recently" },
      observationDetails: (
        <DurationQuantileMetrics
          quantiles={quantiles}
          unit="h"
          healthRegions={healthRegions}
        />
      ),
      reference: reference(),
    },
  ],
};
const meta: Meta<typeof FacilitySummary> = {
  title: "Organisms/Facilities/FacilitySummary",
  component: FacilitySummary,
  parameters: { layout: "padded" },
  args: defaults,
  argTypes: {
    observations: { control: false },
    details: { control: false },
    variant: { control: "select", options: ["compact", "default", "detailed"] },
  },
};
export default meta;
type Story = StoryObj<typeof FacilitySummary>;
export const Default: Story = {};
export const Compact: Story = { args: { variant: "compact" } };
export const Detailed: Story = {
  args: {
    variant: "detailed",
    observations: [
      { ...defaults.observations![0], reference: reference(true) },
    ],
    details: (
      <Text as="p" variant="caption" color="subdued">
        Completed-duration reference for this facility. Demonstration data.
      </Text>
    ),
  },
};
export const IdentityOnly: Story = { args: { observations: [] } };
export const MissingObservation: Story = {
  args: {
    observations: [
      {
        ...defaults.observations![0],
        observation: { value: null, unit: "h" },
        observationDetails: undefined,
        reference: undefined,
        freshness: { state: "unavailable" },
      },
    ],
  },
};
export const Loading: Story = { args: { isLoading: true } };
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 260, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
export const MultipleObservations: Story = {
  args: {
    variant: "compact",
    observations: [
      ...defaults.observations!,
      {
        id: "queue",
        label: "Queue delay",
        health: { assessment: "degraded", label: "Needs attention" },
        observation: { value: 12, unit: "min" },
      },
    ],
  },
};
export const Comparison: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 32, maxWidth: 960 }}>
      {(["compact", "default", "detailed"] as const).map((variant) => (
        <section key={variant}>
          <Text as="h3" variant="heading5">
            {variant}
          </Text>
          <FacilitySummary
            {...defaults}
            variant={variant}
            observations={[
              {
                ...defaults.observations![0],
                reference: reference(variant === "detailed"),
              },
            ]}
          />
        </section>
      ))}
    </div>
  ),
};
export const Table: Story = {
  render: () => (
    <DataGrid
      aria-label="Facility observations"
      columns={[{ key: "facility", name: "Facility" }]}
      rows={[
        { key: "north", facility: "North Harbor" },
        { key: "south", facility: "South Gate" },
      ]}
      selectionMode="none"
      renderColumnCell={(column) => String(column.name)}
      renderRowCell={(_, __, row) => (
        <FacilitySummary
          {...defaults}
          name={row.facility}
          identifier={row.key === "north" ? "FAC-014" : "FAC-027"}
          variant="compact"
        />
      )}
    />
  ),
};
