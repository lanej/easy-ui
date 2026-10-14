import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProportionBar } from "../ProportionBar";
import { RiskScore } from "../RiskScore";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import { MeterBar } from "./MeterBar";

// These are browser regression fixtures, not MeterBar usage examples.
// Keep them directly addressable for tests, outside the sidebar and docs.
const meta: Meta<typeof MeterBar> = {
  id: "test-meterbar",
  title: "Internal tests/MeterBar",
  component: MeterBar,
  tags: ["!dev", "!autodocs"],
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

export const Compositions: Story = {
  render: () => <ComposedMetrics />,
};
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

export const LocalizedRightToLeft: Story = {
  render: () => {
    const formatValue = new Intl.NumberFormat("ar-EG").format;
    return (
      <div dir="rtl" lang="ar">
        <VerticalStack gap="3">
          <ProportionBar
            label="نقاط الفحص المتأثرة"
            value={1184}
            total={1659}
            formatValue={formatValue}
          />
          <ProportionBar
            label="نقاط الفحص المتأثرة"
            value={1184}
            total={1659}
            formatValue={formatValue}
            presentation="expanded"
          />
          <RiskScore
            value={72}
            assessment="high"
            assessmentLabel="مخاطر عالية"
            accessibilityLabel="درجة المخاطر"
            accessibilityValueText="٧٢ من ١٠٠؛ مخاطر عالية"
            formatValue={formatValue}
          />
          <RiskScore
            value={0.18}
            max={1}
            assessment="low"
            assessmentLabel="مخاطر منخفضة"
            accessibilityLabel="درجة المخاطر"
            accessibilityValueText="٠٫١٨ من ١؛ مخاطر منخفضة"
            formatValue={formatValue}
            size="sm"
          />
        </VerticalStack>
      </div>
    );
  },
};

export const ComparisonRightToLeft: Story = {
  render: () => (
    <div dir="rtl" lang="ar">
      <MeterBar
        data={[
          { id: "sac", label: "ساكرامنتو", value: 4.2, color: "primary" },
          { id: "oak", label: "أوكلاند", value: 7.8, color: "secondary" },
          { id: "sjc", label: "سان خوسيه", value: 3.1, color: "tertiary" },
        ]}
        max={12}
        formatValue={(value) => new Intl.NumberFormat("ar-EG").format(value)}
      />
    </div>
  ),
};

export const ComparisonLargeText: Story = {
  render: () => (
    <div style={{ inlineSize: 320, maxInlineSize: "100%", fontSize: "200%" }}>
      <MeterBar
        data={[
          { id: "a", label: "Regional processing facility", value: 4.2 },
          { id: "b", label: "Missing observation", value: null },
        ]}
        max={12}
        formatValue={(value) => `${value.toFixed(1)} h`}
      />
    </div>
  ),
};
