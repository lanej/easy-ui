import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { Box } from "../Box";
import { HorizontalStack } from "../HorizontalStack";
import { DurationValue } from "./DurationValue";

const meta: Meta<typeof DurationValue> = {
  title: "Atoms/Data Display/DurationValue",
  component: DurationValue,
  parameters: { layout: "padded" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    formatValue: { control: false },
  },
};
export default meta;
type Story = StoryObj<typeof DurationValue>;

export const Default: Story = { args: { value: 6, unit: "hours" } };
export const Headline: Story = { args: { ...Default.args, size: "lg" } };
export const Compact: Story = { args: { ...Default.args, size: "sm" } };
export const Zero: Story = { args: { value: 0, unit: "minutes" } };
export const Loading: Story = { args: { ...Default.args, isLoading: true } };
export const Unavailable: Story = { args: { value: null, unit: "hours" } };
export const States: Story = {
  render: () => (
    <HorizontalStack gap="4">
      <DurationValue value={6} unit="hours" />
      <DurationValue value={0} unit="minutes" />
      <DurationValue value={6} unit="hours" isLoading />
      <DurationValue value={null} unit="hours" />
    </HorizontalStack>
  ),
};
export const LocalizedNarrow: Story = {
  args: {
    value: 1234.5,
    unit: "heures écoulées",
    formatValue: (value) => new Intl.NumberFormat("fr-FR").format(value),
    accessibilityLabel: "Durée",
    accessibilityValueText: "1 234,5 heures écoulées",
    loadingLabel: "Chargement…",
    emptyLabel: "Indisponible",
  },
  render: (args) => (
    <Box width={100} maxWidth="100%" lang="fr">
      <DurationValue {...args} />
    </Box>
  ),
};
export const LargeText: Story = {
  args: Default.args,
  render: (args) => (
    <div style={{ width: 160, maxWidth: "100%", zoom: 2 }}>
      <DurationValue {...args} />
    </div>
  ),
};
