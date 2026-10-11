import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BubbleChart, type BubbleChartSeries } from "./BubbleChart";
import { scatterExample } from "../Chart/Chart.examples";
import { seriesExample } from "../Chart/chartCatalog.fixtures";

const defaults = seriesExample<BubbleChartSeries>(scatterExample);
const meta: Meta<typeof BubbleChart> = {
  id: "components-bubblechart",
  title: "Organisms/Charts/BubbleChart",
  component: BubbleChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Plot numeric observations with an explicit magnitude-to-symbolSize mapping. The application supplies its units and scaling.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof BubbleChart>;

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
