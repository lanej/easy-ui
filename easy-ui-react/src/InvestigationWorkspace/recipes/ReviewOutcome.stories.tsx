import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewOutcome } from "./ReviewOutcome";
import { ReviewExample } from "./InvestigationRecipes.examples";
const meta: Meta<typeof ReviewOutcome> = {
  title: "Recipes/Investigation/ReviewOutcome",
  component: ReviewOutcome,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ReviewOutcome>;
export const RecordReview: Story = { render: () => <ReviewExample /> };
export const FailedSave: Story = { render: () => <ReviewExample failFirst /> };
export const EmptyHistory: Story = { render: () => <ReviewExample empty /> };
