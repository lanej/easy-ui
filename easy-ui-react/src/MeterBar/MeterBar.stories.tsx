import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProportionBar } from "../ProportionBar";
import { RiskScore } from "../RiskScore";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import { MeterBar } from "./MeterBar";

const meta: Meta<typeof MeterBar> = {
  id: "components-meterbar",
  title: "Atoms/Feedback/MeterBar",
  component: MeterBar,
  decorators: [
    (Story) => (
      <div style={{ maxInlineSize: 720, minInlineSize: 0 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof MeterBar>;

export const Default: Story = {
  args: { value: 72, max: 100 },
  render: (args) => (
    <div
      role="meter"
      aria-label="Example bounded measurement"
      aria-valuemin={0}
      aria-valuemax={args.max}
      aria-valuenow={args.value}
      aria-valuetext={`${args.value} out of ${args.max}`}
    >
      <VerticalStack gap="1">
        <Text>{`${args.value} / ${args.max}`}</Text>
        <MeterBar {...args} />
      </VerticalStack>
    </div>
  ),
};

export const TonesAndThicknesses: Story = {
  render: () => (
    <VerticalStack gap="3">
      {(["neutral", "success", "warning", "danger"] as const).map((tone) => (
        <VerticalStack key={tone} gap="1">
          <Text>{`${tone}: 72 / 100`}</Text>
          {(["sm", "md", "lg"] as const).map((thickness) => (
            <MeterBar
              key={thickness}
              value={72}
              max={100}
              tone={tone}
              thickness={thickness}
            />
          ))}
        </VerticalStack>
      ))}
    </VerticalStack>
  ),
};

function ComposedMetrics() {
  return (
    <VerticalStack gap="3">
      <VerticalStack gap="1">
        <Text as="h3" variant="heading4">
          Observed proportion
        </Text>
        <ProportionBar
          label="Development checkpoints affected"
          value={1184}
          total={1659}
          tone="warning"
          presentation="expanded"
        />
      </VerticalStack>
      <VerticalStack gap="1">
        <Text as="h3" variant="heading4">
          Risk score
        </Text>
        <RiskScore value={72} assessment="high" />
      </VerticalStack>
      <VerticalStack gap="1">
        <Text as="h3" variant="heading4">
          Compact risk score
        </Text>
        <RiskScore value={24} assessment="low" size="sm" />
      </VerticalStack>
      <VerticalStack gap="1">
        <Text as="h3" variant="heading4">
          Custom score scale
        </Text>
        <RiskScore value={0.18765} max={1} assessment="medium" />
      </VerticalStack>
    </VerticalStack>
  );
}

export const Compositions: Story = { render: () => <ComposedMetrics /> };
export const Narrow: Story = {
  render: () => (
    <div style={{ inlineSize: 280, maxInlineSize: "100%" }}>
      <ComposedMetrics />
    </div>
  ),
};
export const RightToLeft: Story = {
  render: () => (
    <div dir="rtl">
      <ComposedMetrics />
    </div>
  ),
};
export const States: Story = {
  render: () => (
    <VerticalStack gap="3">
      <RiskScore value={null} />
      <ProportionBar label="Unavailable share" value={null} total={100} />
      <RiskScore value={72} assessment="high" isLoading />
      <ProportionBar label="Loading share" value={72} total={100} isLoading />
      <RiskScore value={101} />
      <ProportionBar label="Invalid share" value={101} total={100} />
      <ProportionBar label="Empty population" value={0} total={0} />
      <RiskScore value={72} assessment="high" showBar={false} />
    </VerticalStack>
  ),
};
