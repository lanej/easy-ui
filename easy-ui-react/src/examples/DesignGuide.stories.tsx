import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { NetworkGuideExample } from "./NetworkGuide.examples";
import { PricingExample, EncodingExamples } from "./DesignGuide.examples";
const meta = {
  title: "Patterns/View Rule",
  component: PricingExample,
} satisfies Meta<typeof PricingExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compact: Story = {};
export const SparseComparison: Story = { args: { initialMode: "sparse" } };
export const Overloaded: Story = { args: { initialMode: "overloaded" } };
export const ClippedIdentities: Story = { args: { initialMode: "clipped" } };
export const MultipleExpanded: Story = { args: { initialOpen: ["A", "B"] } };
export const MultipleAuditDrafts: Story = {
  args: { initialOpen: ["A", "B"], initialTask: "audit" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const note = canvas.getByRole("textbox", {
      name: "Review rationale for proposal A",
    });
    await userEvent.clear(note);
    await userEvent.type(note, "Review the demand assumptions.");
    const toggle = canvas.getByRole("button", {
      name: "Trends and factors for A",
    });
    await userEvent.click(toggle);
    await expect(note).not.toBeVisible();
    await expect(
      canvas.getByRole("textbox", { name: "Review rationale for proposal B" }),
    ).toBeVisible();
    await userEvent.click(toggle);
    await expect(note).toBeVisible();
    await expect(note).toHaveValue("Review the demand assumptions.");
  },
};
export const TableAndDetail: Story = {
  args: { initialMode: "table", initialOpen: ["A"] },
};
export const EssentialTrends: Story = {
  args: { initialMode: "trends", initialTask: "trend" },
};
export const HiddenEssentialTrends: Story = {
  args: { initialMode: "compact", initialTask: "trend" },
};
export const IndividualInvestigation: Story = {
  args: { initialMode: "detail", initialTask: "audit", initialOpen: ["A"] },
};
export const Encodings: Story = { render: () => <EncodingExamples /> };

export const NetworkInvestigation: Story = {
  render: () => <NetworkGuideExample />,
};
export const FragmentedNetwork: Story = {
  render: () => <NetworkGuideExample initialMode="fragmented" />,
};
