import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EventMetrics } from "./EventMetrics";
import { createExampleEventMetrics } from "./EventMetrics.examples";

const meta: Meta<typeof EventMetrics> = {
  title: "Molecules/Data Display/EventMetrics",
  component: EventMetrics,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    variant: "compact",
    metrics: createExampleEventMetrics("compact"),
    ariaLabel: "Facility observations",
  },
  argTypes: { metrics: { control: false } },
};
export default meta;
type Story = StoryObj<typeof EventMetrics>;

export const Minimal: Story = {
  args: { variant: "minimal", metrics: createExampleEventMetrics("minimal") },
};

export const Compact: Story = {};

export const Expanded: Story = {
  args: { variant: "expanded", metrics: createExampleEventMetrics("expanded") },
};

export const MissingData: Story = {
  args: {
    metrics: [
      createExampleEventMetrics("compact")[0],
      {
        id: "exception",
        label: "Exception rate",
        valueLabel: "2%",
        assessment: "degraded",
        statusLabel: "Elevated",
        availability: "unavailable",
      },
    ],
  },
};

export const Loading: Story = {
  args: {
    metrics: createExampleEventMetrics("expanded").map((metric) => ({
      ...metric,
      isLoading: true,
    })),
  },
};
