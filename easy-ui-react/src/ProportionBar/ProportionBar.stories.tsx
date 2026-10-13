import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MetricContent } from "../MetricCard";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import { ProportionBar } from "./ProportionBar";

const meta: Meta<typeof ProportionBar> = {
  id: "components-proportionbar",
  title: "Molecules/Data Display/ProportionBar",
  component: ProportionBar,
  decorators: [
    (Story) => (
      <div style={{ maxInlineSize: 720, minInlineSize: 0 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ProportionBar>;

const audit = {
  label: "Development checkpoints affected",
  value: 1184,
  total: 1659,
  tone: "warning" as const,
};
export const Default: Story = {
  args: { label: "Checkpoints affected", value: 1184, total: 1659 },
};
export const Expanded: Story = { args: { ...audit, presentation: "expanded" } };
export const Responsive: Story = {
  render: () => (
    <VerticalStack gap="4">
      {[720, 480, 280].map((width) => (
        <div key={width} style={{ inlineSize: width, maxInlineSize: "100%" }}>
          <VerticalStack gap="2">
            <Text as="h3" variant="heading4">
              {width}px container
            </Text>
            <ProportionBar {...audit} presentation="expanded" />
          </VerticalStack>
        </div>
      ))}
    </VerticalStack>
  ),
};
export const Presentations: Story = {
  render: () => (
    <VerticalStack gap="4">
      <VerticalStack gap="2">
        <Text as="h3" variant="heading4">
          Expanded
        </Text>
        <ProportionBar {...audit} presentation="expanded" />
      </VerticalStack>
      <VerticalStack gap="2">
        <Text as="h3" variant="heading4">
          Compact
        </Text>
        <ProportionBar {...audit} />
      </VerticalStack>
      <VerticalStack gap="2">
        <Text as="h3" variant="heading4">
          Composed with MetricContent
        </Text>
        <MetricContent
          label="Development checkpoints affected"
          value="71.4%"
          supportingText="1,184 / 1,659 checkpoints"
        />
        <ProportionBar {...audit} presentation="bar" />
      </VerticalStack>
    </VerticalStack>
  ),
};
export const BarOnly: Story = { args: { ...audit, presentation: "bar" } };
export const Tones: Story = {
  render: () => (
    <VerticalStack gap="3">
      <ProportionBar label="Observed share" value={71.4} total={100} />
      <ProportionBar
        label="Verified coverage"
        value={71.4}
        total={100}
        tone="success"
      />
      <ProportionBar
        label="Affected checkpoints"
        value={71.4}
        total={100}
        tone="warning"
      />
      <ProportionBar
        label="Rejected records"
        value={71.4}
        total={100}
        tone="danger"
      />
    </VerticalStack>
  ),
};
export const Zero: Story = {
  args: { label: "Affected checkpoints", value: 0, total: 1659 },
};
export const Full: Story = {
  args: { label: "Verified checkpoints", value: 1659, total: 1659 },
};
export const NoData: Story = { args: { ...audit, value: null } };
export const EmptyPopulation: Story = {
  args: { ...audit, value: 0, total: 0 },
};
export const InvalidData: Story = { args: { ...audit, value: 1700 } };
export const Loading: Story = { args: { ...audit, isLoading: true } };
export const Narrow: Story = {
  render: () => (
    <div style={{ inlineSize: 280, maxInlineSize: "100%" }}>
      <VerticalStack gap="3">
        <ProportionBar {...audit} />
        <ProportionBar {...audit} presentation="expanded" />
      </VerticalStack>
    </div>
  ),
};
export const LargeText: Story = {
  render: () => (
    <div style={{ inlineSize: 280, maxInlineSize: "100%" }}>
      <VerticalStack gap="3">
        <ProportionBar
          {...audit}
          label="Affected checkpoints across regional operations and comparison periods"
          typography={{ label: 20, detail: 20 }}
          valueSize={36}
        />
        <ProportionBar
          {...audit}
          presentation="expanded"
          typography={{ label: 20, detail: 20 }}
          valueSize={48}
        />
      </VerticalStack>
    </div>
  ),
};
export const RightToLeft: Story = {
  render: () => (
    <div dir="rtl">
      <ProportionBar {...audit} presentation="expanded" />
    </div>
  ),
};
