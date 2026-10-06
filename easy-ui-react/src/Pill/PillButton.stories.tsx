import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { PillButton } from "./Pill";

const meta = {
  title: "Atoms/Actions/PillButton",
  component: PillButton,
  args: { children: "Needs review" },
} satisfies Meta<typeof PillButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { isSelected: true } };
export const Disabled: Story = { args: { isDisabled: true } };
export const Controlled: Story = {
  render: function Controlled() {
    const [selected, setSelected] = React.useState("All proposals");
    return (
      <div
        role="group"
        aria-label="Proposal filters"
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
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
