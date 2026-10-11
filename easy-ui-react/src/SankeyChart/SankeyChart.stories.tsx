import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SankeyChart, type SankeyChartSeries } from "./SankeyChart";
import { sankeyExample } from "../Chart/Chart.examples";
import {
  seriesExample,
  nativeStyleExample,
} from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<SankeyChartSeries>(sankeyExample);
const meta: Meta<typeof SankeyChart> = {
  id: "components-sankeychart",
  title: "Organisms/Charts/SankeyChart",
  component: SankeyChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Show supplied weighted flows between nodes. Applications own aggregation and flow conservation.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof SankeyChart>;

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
