import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LineChart, type LineChartSeries } from "./LineChart";
import { timeSeriesExample } from "../Chart/Chart.examples";
import {
  annotatedTrendExample,
  scenarioExample,
} from "../Chart/Chart.extensions";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<LineChartSeries>(timeSeriesExample);
const meta: Meta<typeof LineChart> = {
  id: "components-linechart",
  title: "Organisms/Charts/LineChart",
  component: LineChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Compare observations over time or a numeric response axis. Null observations remain gaps.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof LineChart>;

export const Default: Story = {};
export const Minimal: Story = {
  args: {
    title: "Minimal series configuration",
    description:
      "Synthetic observations using the default category and value axes.",
    series: [{ id: "observations", data: [1, 3, 2] }],
    option: undefined,
    dataTable: undefined,
  },
};
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
export const Annotated: Story = {
  args: seriesExample<LineChartSeries>(annotatedTrendExample),
};
export const ScenarioResponse: Story = {
  args: seriesExample<LineChartSeries>(scenarioExample),
};
