import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EventDetails } from "./EventDetails";
const meta: Meta<typeof EventDetails> = {
  title: "Molecules/Investigation/EventDetails",
  component: EventDetails,
  args: {
    event: {
      id: "evt-002981",
      timeLabel: "10 Oct 2026, 14:10 UTC",
      receivedTimeLabel: "10 Oct 2026, 14:18 UTC",
      locationLabel: "South Gate",
    },
    sourceLabel: "Tracking feed",
    showEventId: true,
  },
};
export default meta;
type Story = StoryObj<typeof EventDetails>;
export const Inline: Story = {};
export const Stacked: Story = {
  args: {
    layout: "stacked",
    identifiers: [{ label: "Source record", value: "scan-48290" }],
  },
};
export const Unknown: Story = {
  args: {
    event: { id: "evt-unknown", receivedTimeLabel: "10 Oct 2026, 17:45 UTC" },
    sourceLabel: undefined,
  },
};
export const LongIdentifiers: Story = {
  args: {
    identifiers: [
      {
        label: "Source record",
        value:
          "observation_8bed118832934bd1b2a7bddcd21ea6f7_OriginalFeedRecord",
      },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
};
