import React from "react";
import { nativeStyleExample } from "../Chart/chartCatalog.fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { GraphChart, type GraphChartProps } from "./GraphChart";

const defaults: GraphChartProps = {
  title: "Facility connections",
  description: "Synthetic relationships · Link width is not a volume measure.",
  series: [
    {
      id: "network",
      layout: "circular",
      roam: true,
      symbolSize: 32,
      label: { show: true, position: "bottom" },
      data: [
        { id: "origin", name: "Origin" },
        { id: "hub", name: "Hub" },
        { id: "destination", name: "Destination" },
      ],
      links: [
        { source: "origin", target: "hub" },
        { source: "hub", target: "destination" },
      ],
    },
  ],
  dataTable: {
    columns: ["Source", "Destination"],
    rows: [
      { id: "a", values: ["Origin", "Hub"] },
      { id: "b", values: ["Hub", "Destination"] },
    ],
  },
};
const meta: Meta<typeof GraphChart> = {
  id: "components-graphchart",
  title: "Organisms/Charts/GraphChart",
  component: GraphChart,
  args: defaults,
  parameters: {
    docs: {
      description: {
        component:
          "Show supplied nodes and links using native graph layouts. This is an abstract relationship view; use NetworkMap for geographical coordinates.",
      },
    },
  },
  argTypes: { series: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof GraphChart>;

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
