import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HeatmapChart, type HeatmapChartSeries } from "./HeatmapChart";
import { heatmapExample } from "../Chart/Chart.examples";
import { periodicHeatmapExample } from "../Chart/Chart.extensions";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<HeatmapChartSeries>(heatmapExample);
const meta: Meta<typeof HeatmapChart> = {
  id: "components-heatmapchart",
  title: "Organisms/Charts/HeatmapChart",
  component: HeatmapChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Compare a supplied matrix through a native visualMap. Keep missing cells and sample policy explicit.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof HeatmapChart>;

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
export const Empty: Story = { args: { series: [], status: "empty" } };
export const PeriodicMatrix: Story = {
  args: seriesExample<HeatmapChartSeries>(periodicHeatmapExample),
};
