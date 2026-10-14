import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import { MeterBar, type MeterBarDatum } from "./MeterBar";

const meta: Meta<typeof MeterBar> = {
  id: "components-meterbar",
  title: "Atoms/Data Display/MeterBar",
  component: MeterBar,
  decorators: [
    (Story) => (
      <div style={{ maxInlineSize: 720, minInlineSize: 0 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof MeterBar>;

const comparisonData: MeterBarDatum[] = [
  { id: "sac", label: "Sacramento", value: 4.2, color: "primary" },
  { id: "oak", label: "Oakland", value: 7.8, color: "secondary" },
  { id: "sjc", label: "San Jose", value: 3.1, color: "tertiary" },
];
const formatHours = (value: number) => `${value.toFixed(1)} h`;

export const Default: Story = {
  args: { value: 72, max: 100, color: "primary" },
  render: (args) => (
    <div
      role="meter"
      aria-label="Storage used"
      aria-valuemin={0}
      aria-valuemax={args.max}
      aria-valuenow={args.value}
      aria-valuetext={`${args.value} of ${args.max} GB`}
    >
      <VerticalStack gap="1">
        <Text>{`Storage used: ${args.value} / ${args.max} GB`}</Text>
        <MeterBar {...args} />
      </VerticalStack>
    </div>
  ),
};

export const Comparison: Story = {
  args: {
    data: comparisonData,
    max: 12,
    thickness: "lg",
    accessibilityLabel: "Average dwell time by facility, 0 to 12 hours",
    formatValue: formatHours,
  },
};

export const ComparisonNarrow: Story = {
  name: "Compact comparison",
  render: () => (
    <div style={{ inlineSize: 280, maxInlineSize: "100%" }}>
      <MeterBar
        data={comparisonData}
        max={12}
        thickness="lg"
        accessibilityLabel="Average dwell time by facility, 0 to 12 hours"
        formatValue={formatHours}
      />
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <MeterBar
      data={[
        { id: "primary", label: "Primary", value: 72, color: "primary" },
        { id: "secondary", label: "Secondary", value: 72, color: "secondary" },
        { id: "tertiary", label: "Tertiary", value: 72, color: "tertiary" },
      ]}
      max={100}
      thickness="lg"
      accessibilityLabel="Palette colors, without status meaning"
    />
  ),
};

export const Thicknesses: Story = {
  render: () => (
    <VerticalStack gap="2">
      {(["sm", "md", "lg"] as const).map((thickness) => (
        <MeterBar
          key={thickness}
          data={[{ id: thickness, label: thickness, value: 72 }]}
          max={100}
          thickness={thickness}
        />
      ))}
    </VerticalStack>
  ),
};

export const ComparisonStates: Story = {
  name: "Zero and missing values",
  render: () => (
    <MeterBar
      data={[
        { id: "zero", label: "Observed zero", value: 0, color: "primary" },
        { id: "full", label: "At maximum", value: 12, color: "secondary" },
        { id: "missing", label: "No observation", value: null },
        { id: "invalid", label: "Outside supplied scale", value: 14 },
      ]}
      max={12}
      thickness="lg"
      formatValue={formatHours}
    />
  ),
};
