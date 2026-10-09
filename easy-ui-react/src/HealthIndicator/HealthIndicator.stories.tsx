import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { HealthIndicator } from "./HealthIndicator";

const meta: Meta<typeof HealthIndicator> = {
  title: "Atoms/Feedback/HealthIndicator",
  component: HealthIndicator,
  parameters: { layout: "padded" },
  argTypes: {
    assessment: {
      control: "select",
      options: ["healthy", "degraded", "unhealthy", null],
    },
    availability: {
      control: "inline-radio",
      options: ["available", "unavailable"],
    },
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
};
export default meta;
type Story = StoryObj<typeof HealthIndicator>;

export const Default: Story = { args: { assessment: "healthy" } };
export const AllStates: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <HealthIndicator assessment="healthy" />
      <HealthIndicator assessment="degraded" />
      <HealthIndicator assessment="unhealthy" />
      <HealthIndicator />
      <HealthIndicator assessment="healthy" availability="unavailable" />
      <HealthIndicator assessment="healthy" isLoading />
    </div>
  ),
};
export const Compact: Story = { args: { assessment: "degraded", size: "sm" } };
export const Loading: Story = {
  args: { assessment: "healthy", isLoading: true },
};
export const Unavailable: Story = {
  args: { assessment: "healthy", availability: "unavailable" },
};
export const Unassessed: Story = { args: { assessment: null } };
export const LocalizedNarrow: Story = {
  args: {
    assessment: "healthy",
    label: "Fonctionnement conforme aux attentes",
    accessibilityLabel: "État du service",
  },
  render: (args) => (
    <div lang="fr" style={{ width: 140, maxWidth: "100%" }}>
      <HealthIndicator {...args} />
    </div>
  ),
};
export const LargeText: Story = {
  render: () => (
    <div style={{ width: 180, zoom: 2 }}>
      <HealthIndicator
        assessment="degraded"
        label="Performance below the expected range"
      />
    </div>
  ),
};
