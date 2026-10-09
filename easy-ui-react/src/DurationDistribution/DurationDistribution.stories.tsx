import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  DurationDistribution,
  type DurationDistributionProps,
} from "./DurationDistribution";
import { DurationQuantileMetrics } from "./DurationQuantileMetrics";
import { HealthAssessment } from "../HealthAssessment";
import { Text } from "../Text";
import {
  bins,
  cumulative as sampleCumulative,
  landmarks,
} from "./DurationDistribution.fixtures";
import type { DurationHealthRegion } from "./model";

const quantiles = landmarks.map(({ label, value }) => ({
  label,
  value,
  fraction: label === "P50" ? 0.5 : 0.9,
}));
const cumulative = sampleCumulative.map(({ duration, fraction }) => ({
  value: duration,
  fraction,
}));
const healthRegions: DurationHealthRegion[] = [
  {
    from: 0,
    to: 10,
    assessment: "healthy",
    label: "As expected",
    shortLabel: "Expected",
  },
  {
    from: 10,
    to: 20,
    assessment: "degraded",
    label: "Needs attention",
    shortLabel: "Attention",
  },
  {
    from: 20,
    to: Infinity,
    assessment: "unhealthy",
    label: "Outside expectations",
    shortLabel: "Outside",
  },
];
const defaults: DurationDistributionProps = {
  value: 6,
  domain: [0, 30],
  unit: "h",
  quantiles,
  bins,
  cumulative,
  healthRegions,
  currentAssessment: "healthy",
};
const meta: Meta<typeof DurationDistribution> = {
  title: "Molecules/Data visualization/DurationDistribution",
  component: DurationDistribution,
  parameters: { layout: "padded" },
  args: defaults,
  argTypes: {
    visualization: {
      control: "select",
      options: ["auto", "cumulative", "histogram", "both", "points"],
    },
    distributionStyle: { control: "select", options: ["binned", "smooth"] },
    distributionPresentation: {
      control: "select",
      options: ["plot", "concentration"],
    },
    interpolation: { control: "select", options: ["linear", "step"] },
    overflow: { control: "select", options: ["omit", "clamp"] },
    bins: { control: false },
    cumulative: { control: false },
    quantiles: { control: false },
    healthRegions: { control: false },
    description: { control: false },
    formatValue: { control: false },
    formatCount: { control: false },
    formatQuantileLabel: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof DurationDistribution>;
export const Default: Story = {};
export const QuantilesOnly: Story = {
  args: { bins: undefined, cumulative: undefined },
};
export const QuantilesOnlyWithLabels: Story = {
  args: { bins: undefined, cumulative: undefined, showPercentileLabels: true },
};
export const HistogramConcentrationPreview: Story = {
  args: {
    cumulative: undefined,
    visualization: "histogram",
    distributionStyle: "smooth",
    distributionPresentation: "concentration",
    showPercentileLabels: true,
  },
};
export const BinnedConcentration: Story = {
  args: {
    cumulative: undefined,
    visualization: "histogram",
    distributionPresentation: "concentration",
    showPercentileLabels: true,
  },
};
export const SmoothHistogram: Story = {
  args: {
    cumulative: undefined,
    visualization: "histogram",
    distributionStyle: "smooth",
    showPercentileLabels: true,
  },
};
export const SmoothWithCumulative: Story = {
  args: { distributionStyle: "smooth" },
};
export const PresentationOptions: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 24 }}>
      {(
        [
          ["Binned histogram", "binned", "plot"],
          ["Smooth density", "smooth", "plot"],
          ["Binned concentration", "binned", "concentration"],
          ["Smooth concentration", "smooth", "concentration"],
        ] as const
      ).map(([name, distributionStyle, distributionPresentation]) => (
        <section key={name}>
          <Text as="h3" variant="heading5">
            {name}
          </Text>
          <DurationDistribution
            {...defaults}
                stretch={false}
            cumulative={undefined}
            visualization="histogram"
            distributionStyle={distributionStyle}
            distributionPresentation={distributionPresentation}
            showPercentileLabels
          />
        </section>
      ))}
    </div>
  ),
};
export const CumulativeOnly: Story = { args: { visualization: "cumulative" } };
export const HistogramOnly: Story = { args: { visualization: "histogram" } };
export const EmpiricalSteps: Story = { args: { interpolation: "step" } };
export const WithLabels: Story = { args: { showPercentileLabels: true } };
export const WithCountAxis: Story = { args: { showCountAxis: true } };
export const WithContext: Story = {
  args: {
    cohort: "Example cohort A",
    description: "Synthetic completed durations from an illustrative baseline.",
    sampleCount: 1000,
    showSampleCount: true,
  },
};
export const WithExactData: Story = { args: { showDataTable: true } };
export const WithoutBands: Story = { args: { showHealthBands: false } };
export const WithoutPercentiles: Story = { args: { showPercentiles: false } };
export const WithoutPolicy: Story = {
  args: { healthRegions: undefined, currentAssessment: undefined },
};
export const MissingReference: Story = {
  args: { bins: null, cumulative: null, quantiles: null },
};
export const MissingObservation: Story = { args: { value: null } };
export const InvalidReference: Story = {
  args: {
    quantiles: [
      { fraction: 0.9, value: 18 },
      { fraction: 0.5, value: 9 },
    ],
    bins: [{ from: 0, to: 3, count: -1 }],
    cumulative: [
      { value: 0, fraction: 0.8 },
      { value: 30, fraction: 0.4 },
    ],
  },
};
export const OutsideScale: Story = {
  args: {
    value: 42.125,
    quantiles: [
      { fraction: 0.5, value: 9 },
      { fraction: 0.9, value: 35.75 },
    ],
    showDataTable: true,
  },
};
export const ClampedObservation: Story = {
  args: { value: 42.125, overflow: "clamp" },
};
export const ZeroSample: Story = {
  args: {
    quantiles: [],
    cumulative: [],
    bins: [{ from: 0, to: 30, count: 0 }],
    sampleCount: 0,
    showSampleCount: true,
  },
};
export const Loading: Story = { args: { isLoading: true } };
export const Minutes: Story = {
  args: {
    domain: [0, 120],
    unit: "min",
    value: 23.375,
    bins: [
      { from: 0, to: 20, count: 5 },
      { from: 20, to: 45, count: 20 },
      { from: 60, to: 120, count: 10 },
    ],
    cumulative: [
      { value: 0, fraction: 0 },
      { value: 30, fraction: 0.5 },
      { value: 60, fraction: 0.9 },
      { value: 120, fraction: 1 },
    ],
    quantiles: [
      { fraction: 0.5, value: 30 },
      { fraction: 0.9, value: 60 },
    ],
    healthRegions: [
      { from: 0, to: 45, assessment: "healthy", label: "Expected" },
      { from: 45, to: 90, assessment: "degraded", label: "Attention" },
      { from: 90, to: Infinity, assessment: "unhealthy", label: "Outside" },
    ],
    showCountAxis: true,
  },
};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
  args: { showPercentileLabels: true },
};
export const IndependentMetrics: Story = {
  render: () => (
    <DurationQuantileMetrics
      quantiles={quantiles}
      unit="h"
      healthRegions={healthRegions}
    />
  ),
};
export const ComposedAssessment: Story = {
  render: (args) => (
    <HealthAssessment
      variant="default"
      label="Elapsed duration"
      observation={{ value: args.value, unit: args.unit }}
      health={{ assessment: args.currentAssessment, label: "As expected" }}
      observationDetails={
        <DurationQuantileMetrics
          quantiles={args.quantiles ?? []}
          unit={args.unit}
          healthRegions={args.healthRegions}
        />
      }
      reference={<DurationDistribution {...args} />}
      freshness={{
        state: "fresh",
        observedAt: "2026-01-15T12:00:00Z",
        formatObservedAt: () => "Jan 15, 12:00 UTC",
      }}
    />
  ),
};
export const ComposedExactData: Story = {
  ...ComposedAssessment,
  args: { showDataTable: true },
};
export const ReferenceStates: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 24 }}>
      {[
        ["Supplied CDF and bins", {}],
        ["Quantiles only", { bins: null, cumulative: null }],
        ["No reference", { bins: null, cumulative: null, quantiles: null }],
        ["Outside scale", { value: 42.125 }],
        [
          "Invalid quantiles",
          {
            quantiles: [
              { fraction: 0.9, value: 18 },
              { fraction: 0.5, value: 9 },
            ],
          },
        ],
      ].map(([heading, props]) => (
        <section key={heading as string}>
          <Text as="h3" variant="body2">
            {heading as string}
          </Text>
          <DurationDistribution
            {...defaults}
            {...(props as Partial<DurationDistributionProps>)}
          />
        </section>
      ))}
    </div>
  ),
};

export const EndpointQuantiles: Story = {
  args: {
    quantiles: [
      { fraction: 0, value: 0 },
      { fraction: 1, value: 30 },
    ],
    showPercentileLabels: true,
  },
};
export const PartialReference: Story = {
  args: {
    value: 2,
    cumulative: [
      { value: 5, fraction: 0.25 },
      { value: 15, fraction: 0.75 },
    ],
    quantiles: [{ fraction: 0.5, value: 10 }],
    bins: undefined,
    description: "The supplied cumulative reference covers 5–15 h.",
  },
};

export const BoundaryJumps: Story = {
  args: {
    bins: undefined,
    interpolation: "step",
    cumulative: [
      { value: 0, fraction: 0 },
      { value: 0, fraction: 0.2 },
      { value: 30, fraction: 0.9 },
      { value: 30, fraction: 1 },
    ],
    quantiles: [
      { fraction: 0.1, value: 0 },
      { fraction: 0.95, value: 30 },
    ],
  },
};
