import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { WaffleChart } from "./WaffleChart";
import {
  ControlledWaffleInspection,
  LinkedWaffleGroups,
} from "./WaffleChart.examples";
import { waffleCategories, waffleItems } from "./WaffleChart.fixtures";

const meta: Meta<typeof WaffleChart> = {
  id: "components-wafflechart",
  title: "Organisms/Charts/WaffleChart",
  component: WaffleChart,
  args: {
    accessibilityLabel: "Synthetic resources",
    items: waffleItems,
    categories: waffleCategories,
  },
  parameters: {
    docs: {
      description: {
        component:
          "One cell per supplied resource. Applications own grouping, relationships, and interpretation; counts are never normalized.",
      },
    },
  },
  argTypes: {
    items: { control: false },
    categories: { control: false },
    groups: { control: false },
    renderDetails: { control: false },
    onGroupAnchorsChange: { control: false },
  },
};
export default meta;
type Story = StoryObj<typeof WaffleChart>;

export const Default: Story = {};
export const CompactLinkedSummary: Story = {
  render: () => (
    <a
      href="#synthetic-priority"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        maxWidth: 480,
        padding: 14,
        border: "1px solid var(--ezui-color-neutral-300)",
        borderRadius: 6,
        color: "var(--ezui-color-primary-700)",
        textDecoration: "none",
      }}
    >
      <span>Synthetic priority</span>
      <WaffleChart
        accessibilityLabel="Priority resources"
        items={waffleItems.slice(0, 11)}
        categories={waffleCategories}
        variant="compact"
        maxColumns={6}
      />
    </a>
  ),
};
export const LinkedGroups: Story = { render: () => <LinkedWaffleGroups /> };
export const ControlledInspection: Story = {
  render: () => <ControlledWaffleInspection />,
};
export const UnknownAndEmpty: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 36, maxWidth: 440 }}>
      <WaffleChart
        accessibilityLabel="Unknown and unmatched data"
        categories={waffleCategories}
        groups={[{ id: "named", label: "Named group" }]}
        items={[
          {
            id: "unknown",
            label: "Unclassified resource",
            categoryId: "not-supplied",
            groupId: "not-supplied",
            draft: true,
          },
          {
            id: "known",
            label: "Known resource",
            categoryId: "engineering",
            groupId: "named",
            muted: true,
          },
        ]}
      />
      <WaffleChart
        accessibilityLabel="Empty supplied pool"
        categories={waffleCategories}
        items={[]}
      />
    </div>
  ),
};
export const NarrowLayout: Story = {
  render: () => (
    <div style={{ width: 280, maxWidth: "100%" }}>
      <LinkedWaffleGroups />
    </div>
  ),
};
export const ManyItems: Story = {
  args: {
    items: Array.from({ length: 137 }, (_, index) => ({
      id: `item-${index + 1}`,
      label: `Synthetic resource ${index + 1}`,
      categoryId: waffleCategories[index % 3].id,
      draft: index % 29 === 0,
    })),
    maxColumns: 18,
  },
};
export const Dark: Story = {
  globals: { colorScheme: "dark" },
  render: () => <LinkedWaffleGroups />,
};
