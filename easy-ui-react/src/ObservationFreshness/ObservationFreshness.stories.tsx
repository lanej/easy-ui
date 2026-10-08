import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { Box } from "../Box";
import { VerticalStack } from "../VerticalStack";
import { ObservationFreshness } from "./ObservationFreshness";

const meta: Meta<typeof ObservationFreshness> = {
  title: "Molecules/Feedback/ObservationFreshness",
  component: ObservationFreshness,
  parameters: { layout: "padded" },
  argTypes: { formatObservedAt: { control: false } },
};
export default meta;
type Story = StoryObj<typeof ObservationFreshness>;
const timestamp = "2026-01-15T10:30:00Z";
export const Default: Story = {
  args: { state: "fresh", observedAt: timestamp },
};
export const States: Story = {
  render: () => (
    <VerticalStack gap="3">
      <ObservationFreshness state="fresh" observedAt={timestamp} />
      <ObservationFreshness state="stale" observedAt={timestamp} />
      <ObservationFreshness />
      <ObservationFreshness state="fresh" observedAt={timestamp} isLoading />
    </VerticalStack>
  ),
};
export const Compact: Story = {
  args: { state: "stale", observedAt: timestamp, size: "sm" },
};
export const Narrow: Story = {
  args: { state: "stale", observedAt: timestamp },
  render: (args) => (
    <Box width={150} maxWidth="100%">
      <ObservationFreshness {...args} />
    </Box>
  ),
};
export const LargeText: Story = {
  args: { state: "stale", observedAt: timestamp },
  render: (args) => (
    <div style={{ zoom: 2, maxWidth: 180 }}>
      <ObservationFreshness {...args} />
    </div>
  ),
};
export const Localized: Story = {
  args: {
    state: "stale",
    observedAt: timestamp,
    stateLabel: "Données anciennes",
    accessibilityLabel: "Actualité des observations",
    observedAtLabel: "Observé le",
    emptyLabel: "Indisponible",
    loadingLabel: "Chargement…",
    formatObservedAt: (value) =>
      new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value)),
  },
  render: (args) => (
    <Box width={180} maxWidth="100%" lang="fr">
      <ObservationFreshness {...args} />
    </Box>
  ),
};
