import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { StatusDot } from "./StatusDot";

const meta: Meta<typeof StatusDot> = {
  title: "Atoms/Feedback/StatusDot",
  component: StatusDot,
  parameters: { layout: "padded" },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "success", "warning", "danger", "primary"],
    },
  },
};
export default meta;
type Story = StoryObj<typeof StatusDot>;
export const Default: Story = { args: { label: "Available", tone: "success" } };
export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <StatusDot label="Unknown" />
      <StatusDot label="Available" tone="success" />
      <StatusDot label="Delayed" tone="warning" />
      <StatusDot label="Unavailable" tone="danger" />
      <StatusDot label="Active" tone="primary" />
    </div>
  ),
};
export const Compact: Story = {
  args: { label: "Available", tone: "success", size: "sm" },
};
