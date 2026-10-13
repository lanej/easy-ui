import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HistogramChart, type HistogramChartSeries } from "./HistogramChart";
import { histogramExample } from "../Chart/Chart.extensions";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<HistogramChartSeries>(histogramExample);
const meta: Meta<typeof HistogramChart> = {
  id: "components-histogramchart",
  title: "Organisms/Charts/HistogramChart",
  component: HistogramChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Show supplied counts for equal-width buckets. It does not bin raw observations or infer a density.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof HistogramChart>;

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
