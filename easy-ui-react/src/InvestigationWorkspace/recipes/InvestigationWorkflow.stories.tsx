import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InvestigationWorkflow } from "./InvestigationRecipes.examples";
const meta: Meta = {
  title: "Recipes/Investigation/Workflow",
  parameters: { layout: "padded" },
};
export default meta;
export const QueueToReview: StoryObj = {
  render: () => <InvestigationWorkflow />,
};
