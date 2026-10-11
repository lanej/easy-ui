import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AreaChart, type AreaChartSeries } from "./AreaChart";
import { areaExample } from "../Chart/Chart.examples";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<AreaChartSeries>(areaExample);
const meta: Meta<typeof AreaChart> = {
  id: "components-areachart",
  title: "Organisms/Charts/AreaChart",
  component: AreaChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Show magnitudes with filled line series. Supply an explicit stack when the series are additive.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof AreaChart>;

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
export const Unstacked: Story = {
  args: {
    series: defaults.series.map((entry) => ({ ...entry, stack: undefined })),
  },
};
