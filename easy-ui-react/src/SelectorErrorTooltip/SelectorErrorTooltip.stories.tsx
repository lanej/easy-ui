import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { SelectorErrorTooltip } from "./SelectorErrorTooltip";

const meta: Meta<typeof SelectorErrorTooltip> = {
  id: "components-selectorerrortooltip",
  title: "Atoms/Feedback/SelectorErrorTooltip",
  component: SelectorErrorTooltip,
  args: {
    content: "Select an option before continuing.",
    isImmediate: true,
  },
  decorators: [
    (Story) => (
      <div style={{ padding: "64px 24px" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SelectorErrorTooltip>;

export const Default: Story = {};

export const Open: Story = {
  args: { isOpen: true },
};

export const FocusOnly: Story = {
  args: { trigger: "focus" },
};

export const LongMessage: Story = {
  args: {
    isOpen: true,
    content:
      "Choose at least one delivery service. Your selection determines which services are available when creating a shipment.",
  },
};
