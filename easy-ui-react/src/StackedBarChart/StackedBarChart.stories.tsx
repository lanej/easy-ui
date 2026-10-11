import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StackedBarChart, type StackedBarChartSeries } from "./StackedBarChart";
import { stackedBarExample } from "../Chart/Chart.examples";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<StackedBarChartSeries>(stackedBarExample);
const meta: Meta<typeof StackedBarChart> = {
  id: "components-stackedbarchart",
  title: "Organisms/Charts/StackedBarChart",
  component: StackedBarChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Show additive parts using a shared default stack. Percentage normalization belongs to the application.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof StackedBarChart>;

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
export const WithoutDataTable: Story = { args: { showDataTable: false } };
export const Loading: Story = { args: { status: "loading" } };
export const Empty: Story = { args: { series: [], status: "empty" } };
