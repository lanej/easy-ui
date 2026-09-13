import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
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
