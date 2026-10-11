import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CumulativeDistributionChart,
  type CumulativeDistributionChartSeries,
} from "./CumulativeDistributionChart";
import { cumulativeExample } from "../Chart/Chart.extensions";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults =
  seriesExample<CumulativeDistributionChartSeries>(cumulativeExample);
const meta: Meta<typeof CumulativeDistributionChart> = {
  id: "components-cumulativedistributionchart",
  title: "Organisms/Charts/CumulativeDistributionChart",
  component: CumulativeDistributionChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Show supplied cumulative points. The default step interpolation can be overridden per series; specify fractions or percentages in the axis.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof CumulativeDistributionChart>;

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
