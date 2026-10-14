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

const comparisonData = [
  { id: "sac", label: "Sacramento", value: 4.2 },
  { id: "oak", label: "Oakland", value: 7.8 },
  { id: "sjc", label: "San Jose", value: 3.1 },
];
const formatHours = (value: number) => `${value.toFixed(1)} h`;

export const Comparison: Story = {
  args: {
    data: comparisonData,
    max: 12,
    accessibilityLabel: "Average dwell time by facility, 0 to 12 hours",
    formatValue: formatHours,
  },
};

export const ComparisonNarrow: Story = {
  render: () => (
    <div style={{ inlineSize: 280, maxInlineSize: "100%" }}>
      <MeterBar
        data={comparisonData}
        max={12}
        accessibilityLabel="Average dwell time by facility"
        formatValue={formatHours}
      />
    </div>
  ),
};

export const ComparisonStates: Story = {
  render: () => (
    <MeterBar
      data={[
        { id: "zero", label: "Observed zero", value: 0 },
        { id: "full", label: "At maximum", value: 12 },
        { id: "missing", label: "No observation", value: null },
        { id: "invalid", label: "Outside supplied scale", value: 14 },
        {
          id: "warning",
          label: "Caller-supplied warning",
          value: 7.8,
          tone: "warning",
        },
      ]}
      max={12}
      formatValue={formatHours}
    />
  ),
};

export const ComparisonRightToLeft: Story = {
  render: () => (
    <div dir="rtl" lang="ar">
      <MeterBar
        data={[
          { id: "sac", label: "ساكرامنتو", value: 4.2 },
          { id: "oak", label: "أوكلاند", value: 7.8 },
          { id: "sjc", label: "سان خوسيه", value: 3.1 },
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
        formatValue={formatHours}
      />
    </div>
  ),
};
