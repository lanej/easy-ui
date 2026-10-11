import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IntervalChart } from "./IntervalChart";
import {
  intervalProps,
  warehouseIntervalProps,
} from "../Chart/patternChart.fixtures";

const meta: Meta<typeof IntervalChart> = {
  id: "components-intervalchart",
  title: "Organisms/Charts/IntervalChart",
  component: IntervalChart,
  args: intervalProps,
  parameters: {
    docs: {
      description: {
        component:
          "Draw supplied start/end spans on named lanes. Multiple intervals can share a lane. Missing or reversed spans stay in exact data and have no invented geometry.",
      },
    },
  },
  argTypes: { intervals: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof IntervalChart>;
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
  args: { intervals: [], status: "empty", dataTable: undefined },
};
export const MultipleLanes: Story = { args: warehouseIntervalProps };
export const MissingEndpoints: Story = {
  args: {
    intervals: [
      {
        id: "missing",
        row: "In transit",
        label: "Unknown end",
        start: 5,
        end: null,
      },
    ],
  },
};
