import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InvestigationQueue } from "./InvestigationQueue";
import { QueueExample } from "./InvestigationRecipes.examples";
const meta: Meta<typeof InvestigationQueue> = {
  title: "Recipes/Investigation/InvestigationQueue",
  component: InvestigationQueue,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof InvestigationQueue>;
export const Worklist: Story = { render: () => <QueueExample /> };
export const Empty: Story = { render: () => <QueueExample empty /> };
export const Loading: Story = { render: () => <QueueExample loading /> };
export const Retry: Story = { render: () => <QueueExample error /> };
