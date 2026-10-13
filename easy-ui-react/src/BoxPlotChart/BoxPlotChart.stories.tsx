import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BoxPlotChart, type BoxPlotChartSeries } from "./BoxPlotChart";
import { boxPlotExample } from "../Chart/Chart.extensions";
import {
  seriesExample,
  nativeStyleExample,
} from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<BoxPlotChartSeries>(boxPlotExample);
const meta: Meta<typeof BoxPlotChart> = {
  id: "components-boxplotchart",
  title: "Organisms/Charts/BoxPlotChart",
  component: BoxPlotChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Show explicitly supplied five-number summaries in min, P25, median, P75, max order. The component does not calculate quantiles.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof BoxPlotChart>;

export const Default: Story = {};
export const ThemeDefaults: Story = { args: nativeStyleExample(defaults) };
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
