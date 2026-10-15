import { Meta, StoryObj } from "@storybook/react-vite";
import React, { useId } from "react";
import { Card } from "../Card";
import { SignedValue } from "../SignedValue";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import {
  MetricCard,
  MetricContent,
  MetricComparisonContent,
  MetricGroup,
  type MetricLayout,
  type MetricSize,
} from "./MetricCard";

const meta: Meta<typeof MetricCard> = {
  id: "components-metriccard",
  title: "Molecules/Data Display/MetricCard",
  component: MetricCard,
};
export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Default: Story = {
  args: {
    label: "Average rated cost",
    value: "$5.20",
    unit: "USD",
    supportingText: "June 1–30",
    comparison: {
      label: "4.2%",
      direction: "decrease",
      baseline: "vs previous 30 days",
      sentiment: "positive",
    },
  },
};
export const Row: Story = { args: { ...Default.args, layout: "row" } };

function ShippingMetrics({
  layout = "summary",
  size = "md",
}: {
  layout?: MetricLayout;
  size?: MetricSize;
}) {
  const baselineId = useId();
  return (
    <Card as="section" aria-label="Shipping overview" padding="2">
      <VerticalStack gap="3">
        <VerticalStack gap="0.5">
          <Text as="h2" variant="heading4">
            Shipping overview
          </Text>
          <span id={baselineId} style={{ fontSize: 13 }}>
            <Text color="neutral.600">
              Illustrative · June 1–30 · vs previous 30 days
            </Text>
          </span>
        </VerticalStack>
        <MetricGroup layout={layout} size={size}>
          <MetricContent
            label="Labels purchased"
            value="24,810"
            comparison={{ label: "8.3%", direction: "increase", baselineId }}
          />
          <MetricContent
            label="Average rated cost"
            value="$5.20"
            unit="USD"
            comparison={{
              label: "4.2%",
              direction: "decrease",
              baselineId,
              sentiment: "positive",
            }}
          />
          <MetricContent
            label="On-time delivery rate"
            value="97.8%"
            supportingText="Delivered parcels with an estimate"
            comparison={{
              label: "1.2 pp",
              direction: "increase",
              baselineId,
              sentiment: "positive",
            }}
          />
          <MetricContent
            label="Average transit"
            value="2.4"
            unit="days"
            supportingText="Delivered parcels · calendar days"
            comparison={{
              label: "0.2 days",
              direction: "decrease",
              baselineId,
              sentiment: "positive",
            }}
          />
        </MetricGroup>
      </VerticalStack>
    </Card>
  );
}

export const ShippingOverview: Story = { render: () => <ShippingMetrics /> };
export const ShippingRows: Story = {
  render: () => <ShippingMetrics layout="row" />,
};
export const CompactSummary: Story = {
  render: () => <ShippingMetrics size="sm" />,
};

export const TypographyPresets: Story = {
  render: () => (
    <VerticalStack gap="3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Card
          key={size}
          as="section"
          aria-label={`${size} metric preset`}
          padding="2"
        >
          <MetricGroup size={size}>
            <MetricContent
              {...Default.args}
              label={`Average rated cost · ${size}`}
              value="$5.20"
            />
            <MetricContent
              label="Average transit"
              value="2.4"
              unit="days"
              comparison={{
                label: "0.2 days",
                direction: "decrease",
                sentiment: "positive",
                baseline: "vs previous 30 days",
              }}
            />
          </MetricGroup>
        </Card>
      ))}
    </VerticalStack>
  ),
};
export const ValueAlignment: Story = {
  render: () => (
    <VerticalStack gap="2">
      {[16, 24, 28, 48].map((valueSize) => (
        <MetricCard
          {...Default.args}
          key={valueSize}
          label={`Average rated cost · ${valueSize}px value`}
          value="$5.20"
          valueSize={valueSize}
        />
      ))}
    </VerticalStack>
  ),
};

export const Sentiments: Story = {
  render: () => (
    <MetricGroup>
      <MetricContent
        {...Default.args}
        label="Average rated cost"
        value="$5.20"
      />
      <MetricContent
        label="Labels purchased"
        value="24,810"
        comparison={{
          label: "8.3%",
          direction: "increase",
          baseline: "vs May",
        }}
      />
      <MetricContent
        label="Delivery exception rate"
        value="1.4%"
        comparison={{
          label: "0.3 pp",
          direction: "increase",
          baseline: "vs May",
          sentiment: "negative",
        }}
      />
      <MetricContent
        label="Average transit"
        value="2.4"
        unit="days"
        comparison={{
          label: "0 days",
          direction: "unchanged",
          baseline: "vs May",
        }}
      />
    </MetricGroup>
  ),
};
export const Narrow: Story = {
  render: () => (
    <div style={{ width: 180, maxWidth: "100%" }}>
      <MetricCard
        {...Default.args}
        label="Average international rated cost"
        value="$1,234.56"
      />
    </div>
  ),
};
export const LargeText: Story = {
  args: {
    ...Default.args,
    label: "Average international rated cost including carrier adjustments",
    value: "$1,234,567.89",
    valueSize: 48,
    typography: { title: 28, description: 26, detail: 26 },
  },
};
export const RightToLeft: Story = {
  render: () => (
    <div dir="rtl">
      <MetricCard
        label="Average rated cost"
        value="$5.20"
        unit="USD"
        comparison={{
          label: "4.2%",
          direction: "decrease",
          baseline: "vs previous 30 days",
          sentiment: "positive",
        }}
      />
    </div>
  ),
};
export const RowRightToLeft: Story = {
  render: () => (
    <div dir="rtl">
      <ShippingMetrics layout="row" />
    </div>
  ),
};
export const RowLongContent: Story = {
  render: () => (
    <MetricGroup layout="row">
      <MetricContent
        label="Average international rated cost including carrier adjustments"
        value="$1,234.56"
        unit="USD"
        comparison={{
          label: "4.2%",
          direction: "decrease",
          baseline: "vs the previous reporting period",
          sentiment: "positive",
        }}
      />
      <MetricContent
        label="Delivery exception rate"
        value="1.4%"
        supportingText="Delivered international parcels only"
        comparison={{
          label: "0.3 percentage points",
          direction: "increase",
          baseline: "vs May",
          sentiment: "negative",
        }}
      />
      <MetricContent label="Unavailable" value={null} unit="days" />
    </MetricGroup>
  ),
};
export const Loading: Story = { args: { ...Default.args, isLoading: true } };
export const NoData: Story = { args: { ...Default.args, value: null } };
export const Zero: Story = {
  args: { label: "Delivery exceptions", value: "0" },
};
export const CallerOwnedFrame: Story = {
  render: () => (
    <Card
      as="section"
      aria-label="Caller-owned cost analysis"
      padding="2"
      background="secondary"
    >
      <MetricContent
        {...Default.args}
        label="Average rated cost"
        value="$5.20"
      />
    </Card>
  ),
};
export const ComparisonOnly: Story = {
  render: () => (
    <MetricComparisonContent
      label="4.2%"
      direction="decrease"
      baseline="vs previous 30 days"
      sentiment="positive"
    />
  ),
};
export const SignedValues: Story = {
  render: () => (
    <MetricGroup>
      <MetricContent
        label="Contribution / day"
        value={
          <SignedValue
            value={120}
            colorBySign
            formatValue={(value) => `+$${value}`}
          />
        }
        supportingText="Proposed contribution"
      />
      <MetricContent
        label="Contribution range / day"
        value={
          <>
            <SignedValue value={-20} colorBySign formatValue={() => "−$20"} />{" "}
            to{" "}
            <SignedValue value={100} colorBySign formatValue={() => "+$100"} />
          </>
        }
        supportingText="Scenario bounds"
      />
    </MetricGroup>
  ),
};
