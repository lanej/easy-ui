import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { WaterfallChart } from "./WaterfallChart";
import { waterfallProps } from "../Chart/patternChart.fixtures";

const meta: Meta<typeof WaterfallChart> = {
  id: "components-waterfallchart",
  title: "Organisms/Charts/WaterfallChart",
  component: WaterfallChart,
  args: waterfallProps,
  parameters: {
    docs: {
      description: {
        component:
          "Show signed changes and their running balance. Interval geometry handles negative balances and crossings of zero; the final bar spans zero to the supplied ledger total.",
      },
    },
  },
  argTypes: { steps: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof WaterfallChart>;
export const Default: Story = {};
export const NarrowLayout: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 340, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
export const Bare: Story = { args: { variant: "bare" } };
export const Loading: Story = { args: { status: "loading" } };
export const Empty: Story = {
  args: { steps: [], status: "empty", dataTable: undefined },
};
export const CrossingZero: Story = {
  args: {
    title: "Signed balance bridge",
    description: "Synthetic changes cross zero in both directions.",
    steps: [
      { id: "a", label: "Start", change: 10 },
      { id: "b", label: "Debit", change: -15 },
      { id: "c", label: "Credit", change: 8 },
    ],
    option: undefined,
    dataTable: undefined,
  },
};
export const OpeningBalance: Story = {
  args: { ...CrossingZero.args, initialValue: 20 },
};
export const StyledAxis: Story = {
  args: {
    ...CrossingZero.args,
    option: { xAxis: { name: "Step", axisLabel: { fontSize: 14 } } },
  },
};
