import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PathComparison } from "./PathComparison";
import { ComparisonExample } from "./PathComparison.examples";

const meta: Meta<typeof PathComparison> = {
  title: "Organisms/Investigation/PathComparison",
  component: PathComparison,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof PathComparison>;
export const CandidateHistories: Story = {
  render: () => <ComparisonExample />,
};
export const LinkedMap: Story = { render: () => <ComparisonExample withMap /> };
export const Narrow: Story = { render: () => <ComparisonExample narrow /> };
export const MissingRecords: Story = {
  args: {
    paths: [
      { id: "a", label: "Candidate A" },
      { id: "b", label: "Candidate B" },
    ],
    events: [],
    rows: [
      {
        id: "one",
        label: "Supplied group",
        cells: [
          { pathId: "a", eventIds: ["removed-observation"] },
          {
            pathId: "b",
            eventIds: [],
            note: "No location observations supplied",
          },
        ],
      },
    ],
    selection: null,
    onSelectionChange: () => {},
  },
};
export const Empty: Story = {
  args: {
    paths: [],
    events: [],
    rows: [],
    selection: null,
    onSelectionChange: () => {},
  },
};
