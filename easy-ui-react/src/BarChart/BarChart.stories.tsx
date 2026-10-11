import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart, type BarChartSeries } from "./BarChart";
import { barExample } from "../Chart/Chart.examples";
import { labeledBarsExample } from "../Chart/Chart.extensions";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<BarChartSeries>(barExample);
const meta: Meta<typeof BarChart> = {
  id: "components-barchart",
  title: "Organisms/Charts/BarChart",
  component: BarChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Compare categories with native grouped bars, in either axis orientation.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof BarChart>;

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
export const DirectLabels: Story = {
  args: seriesExample<BarChartSeries>(labeledBarsExample),
};
