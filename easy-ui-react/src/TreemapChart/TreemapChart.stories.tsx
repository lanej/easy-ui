import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TreemapChart, type TreemapChartSeries } from "./TreemapChart";
import { treemapExample } from "../Chart/Chart.examples";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<TreemapChartSeries>(treemapExample);
const meta: Meta<typeof TreemapChart> = {
  id: "components-treemapchart",
  title: "Organisms/Charts/TreemapChart",
  component: TreemapChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Compare supplied hierarchical magnitudes through nested area. Preserve the hierarchy and denominator in exact data.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof TreemapChart>;

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
