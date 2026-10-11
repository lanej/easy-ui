import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScatterChart, type ScatterChartSeries } from "./ScatterChart";
import { scatterExample } from "../Chart/Chart.examples";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = {
  ...seriesExample<ScatterChartSeries>(scatterExample),
  description:
    "Matched service cohorts · Points compare calendar days and rated cost. Parcel counts are retained in exact data.",
  series: seriesExample<ScatterChartSeries>(scatterExample).series.map(
    (entry) => ({ ...entry, symbolSize: 10 }),
  ),
};
const meta: Meta<typeof ScatterChart> = {
  id: "components-scatterchart",
  title: "Organisms/Charts/ScatterChart",
  component: ScatterChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Plot paired numeric observations. A fixed symbol size gives an ordinary scatter plot.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof ScatterChart>;

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
