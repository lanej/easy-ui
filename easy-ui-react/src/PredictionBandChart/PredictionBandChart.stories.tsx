import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PredictionBandChart } from "./PredictionBandChart";
import { predictionBandProps } from "../Chart/patternChart.fixtures";

const meta: Meta<typeof PredictionBandChart> = {
  id: "components-predictionbandchart",
  title: "Organisms/Charts/PredictionBandChart",
  component: PredictionBandChart,
  args: predictionBandProps,
  parameters: {
    docs: {
      description: {
        component:
          "Show observed and predicted values with supplied lower and upper bounds. The component does not fit a model or assign confidence; disconnected bounds remain gaps.",
      },
    },
  },
  argTypes: { points: { control: false }, option: { control: false } },
};
export default meta;
type Story = StoryObj<typeof PredictionBandChart>;
export const Default: Story = {};
export const ZoomedSpan: Story = {
  args: {
    title: "Supplied bounds across zoom boundaries",
    description:
      "Synthetic bounds remain visible where supplied segments overlap the zoom window.",
    points: [0, 10, 20].map((x) => ({
      id: String(x),
      x,
      observed: x,
      predicted: x,
      lower: x - 2,
      upper: x + 2,
    })),
    observedSeries: undefined,
    predictedSeries: undefined,
    dataTable: undefined,
    option: { dataZoom: { type: "inside", startValue: 5, endValue: 15 } },
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
export const Empty: Story = {
  args: { points: [], status: "empty", dataTable: undefined },
};
export const NegativeBounds: Story = {
  args: {
    title: "Supplied interval crossing zero",
    description: "Synthetic bounds; no interval is fitted.",
    points: [
      { id: "a", x: 0, observed: null, predicted: 0, lower: -2, upper: 2 },
      { id: "b", x: 1, observed: null, predicted: 1, lower: -1, upper: 3 },
    ],
    option: undefined,
    dataTable: undefined,
  },
};
export const MissingBounds: Story = {
  args: {
    points: predictionBandProps.points.map((point, index) =>
      index === 6 ? { ...point, lower: null, upper: null } : point,
    ),
    dataTable: undefined,
  },
};
