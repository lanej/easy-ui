import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { SignedValue } from "./SignedValue";

const meta = {
  id: "primitives-signedvalue",
  title: "Atoms/Typography/SignedValue",
  component: SignedValue,
  args: { value: 120, colorBySign: true },
} satisfies Meta<typeof SignedValue>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Positive: Story = {};
export const Negative: Story = { args: { value: -20 } };
export const Zero: Story = { args: { value: 0 } };
export const Uncolored: Story = { args: { colorBySign: false } };
export const MixedRange: Story = {
  render: () => (
    <strong>
      <SignedValue
        value={-20}
        colorBySign
        formatValue={(value) => `−$${Math.abs(value)}`}
      />{" "}
      to{" "}
      <SignedValue
        value={100}
        colorBySign
        formatValue={(value) => `+$${value}`}
      />
    </strong>
  ),
};
