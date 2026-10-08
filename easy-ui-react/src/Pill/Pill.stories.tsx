import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { Pill, PillButton } from "./Pill";

const meta = {
  title: "Atoms/Feedback/Pill",
  component: Pill,
  args: { children: "Capacity review" },
} satisfies Meta<typeof Pill>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Pill>Pending</Pill>
      <Pill tone="primary">Queued</Pill>
      <Pill tone="success">Approved</Pill>
      <Pill tone="warning">Capacity review</Pill>
      <Pill tone="danger">Blocked</Pill>
    </div>
  ),
};
export const Selectable: Story = {
  render: function Selectable() {
    const [selected, setSelected] = React.useState("All proposals");
    return (
      <div
        role="group"
        aria-label="Proposal filters"
        style={{ display: "flex", gap: 8 }}
      >
        {["All proposals", "Needs review", "Queued"].map((label) => (
          <PillButton
            key={label}
            isSelected={selected === label}
            onPress={() => setSelected(label)}
          >
            {label}
          </PillButton>
        ))}
      </div>
    );
  },
};
export const Disabled: Story = {
  render: () => <PillButton isDisabled>Unavailable action</PillButton>,
};
