import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DonutChart, type DonutChartSeries } from "./DonutChart";
import { donutExample } from "../Chart/Chart.examples";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<DonutChartSeries>(donutExample);
const meta: Meta<typeof DonutChart> = {
  id: "components-donutchart",
  title: "Organisms/Charts/DonutChart",
  component: DonutChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Compare parts of a stated whole. Native radius defaults to [45%, 70%] and remains overridable.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof DonutChart>;

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
