import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { Button } from "../Button";
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
    current: { control: "boolean" },
    animate: { control: "boolean" },
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
export const Current: Story = {
  args: { label: "Delayed", tone: "warning", current: true, animate: false },
};
export const CurrentByTone: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 36, padding: 24 }}>
      {(["neutral", "success", "warning", "danger", "primary"] as const).map(
        (tone) => (
          <div
            key={tone}
            style={{ display: "grid", gap: 18, justifyItems: "center" }}
          >
            <StatusDot label={tone} tone={tone} current animate={false} />
            <span>{tone}</span>
          </div>
        ),
      )}
    </div>
  ),
};
function SelectionExample() {
  const [current, setCurrent] = useState(0);
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 24 }}>
      {(["success", "warning", "danger"] as const).map((tone, index) => (
        <Button
          key={tone}
          color="secondary"
          variant="outlined"
          onPress={() => setCurrent(index)}
        >
          <StatusDot label={tone} tone={tone} current={current === index} />
          <span style={{ marginInlineStart: 12 }}>Select {tone}</span>
        </Button>
      ))}
    </div>
  );
}
export const SelectionTransition: Story = {
  render: () => <SelectionExample />,
};
