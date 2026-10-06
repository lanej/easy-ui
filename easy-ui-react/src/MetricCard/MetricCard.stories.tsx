import { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { HorizontalGrid } from "../HorizontalGrid";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import {
  MetricCard,
  MetricContent,
  MetricComparisonContent,
} from "./MetricCard";
import { Card } from "../Card";
import { SignedValue } from "../SignedValue";

const meta: Meta<typeof MetricCard> = {
  id: "components-metriccard",
  title: "Molecules/Feedback/MetricCard",
  component: MetricCard,
};
export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Default: Story = {
  args: {
    label: "Average rated cost",
    value: "$5.20",
    supportingText: "June 1–30 · USD",
    comparison: {
      label: "4.2% lower",
      baseline: "vs previous 30 days",
      sentiment: "positive",
    },
  },
};

export const ShippingOverview: Story = {
  render: () => (
    <VerticalStack gap="3">
      <Text as="h2" variant="heading4">
        Shipping overview
      </Text>
      <Text color="neutral.600">
        Illustrative data · June 1–30 · Comparisons use the previous 30 days
      </Text>
      <HorizontalGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="2">
        <MetricCard
          label="Labels purchased"
          value="24,810"
          supportingText="June 1–30"
          comparison={{ label: "8.3% higher", baseline: "vs previous 30 days" }}
        />
        <MetricCard
          {...Default.args}
          label="Average rated cost"
          value="$5.20"
        />
        <MetricCard
          label="On-time delivery rate"
          value="97.8%"
          supportingText="Delivered parcels with an estimate"
          comparison={{
            label: "1.2 pp higher",
            baseline: "vs previous 30 days",
            sentiment: "positive",
          }}
        />
        <MetricCard
          label="Average transit"
          value="2.4 days"
          supportingText="Delivered parcels · calendar days"
          comparison={{
            label: "0.2 days lower",
            baseline: "vs previous 30 days",
            sentiment: "positive",
          }}
        />
      </HorizontalGrid>
    </VerticalStack>
  ),
};

export const Loading: Story = {
  ...Default,
  args: { ...Default.args, isLoading: true },
};
export const NoData: Story = {
  ...Default,
  args: { ...Default.args, value: null },
};
export const Zero: Story = {
  args: { label: "Delivery exceptions", value: "0" },
};
export const CallerOwnedFrame: Story = {
  render: () => (
    <Card
      as="section"
      aria-label="Caller-owned cost analysis"
      padding="3"
      background="secondary"
    >
      <VerticalStack gap="3">
        <MetricContent
          label="Average rated cost"
          value="$5.20"
          supportingText="USD · June"
        />
        <MetricComparisonContent
          label="4.2% lower"
          baseline="vs previous 30 days"
          sentiment="positive"
        />
      </VerticalStack>
    </Card>
  ),
};

export const SignedValues: Story = {
  render: () => (
    <HorizontalGrid columns={{ xs: 1, sm: 2 }} gap="2">
      <MetricCard
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
      <MetricCard
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
    </HorizontalGrid>
  ),
};
