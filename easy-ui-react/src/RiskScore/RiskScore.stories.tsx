import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { Box } from "../Box";
import { DataGrid } from "../DataGrid";
import { HorizontalStack } from "../HorizontalStack";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import { RiskScore, type RiskScoreProps } from "./RiskScore";

const meta: Meta<typeof RiskScore> = {
  title: "Molecules/Feedback/RiskScore",
  id: "components-riskscore",
  component: RiskScore,
  parameters: { layout: "padded" },
  argTypes: {
    assessment: {
      control: "select",
      options: ["low", "medium", "high", null],
    },
    size: { control: "inline-radio", options: ["sm", "md"] },
    formatValue: { control: false },
  },
};
export default meta;
type Story = StoryObj<typeof RiskScore>;

export const Default: Story = {
  args: { value: 87, assessment: "high" },
};

export const Assessments: Story = {
  render: () => (
    <HorizontalStack gap="4" blockAlign="start">
      <RiskScore value={19} assessment="low" />
      <RiskScore value={52} assessment="medium" />
      <RiskScore value={87} assessment="high" />
    </HorizontalStack>
  ),
  parameters: { controls: { disable: true } },
};

const trackingRows: {
  key: string;
  trackingNumber: string;
  risk: RiskScoreProps;
}[] = [
  {
    key: "1",
    trackingNumber: "TRK-1041",
    risk: { value: 19, assessment: "low" },
  },
  {
    key: "2",
    trackingNumber: "TRK-1042",
    risk: { value: 52, assessment: "medium" },
  },
  {
    key: "3",
    trackingNumber: "TRK-1043",
    risk: { value: 87, assessment: "high" },
  },
  {
    key: "4",
    trackingNumber: "TRK-1044",
    risk: { value: 87, assessment: "high", isLoading: true },
  },
  { key: "5", trackingNumber: "TRK-1045", risk: { value: null } },
];

export const CompactTrackingTable: Story = {
  render: () => (
    <Box maxWidth={640}>
      <DataGrid
        aria-label="Sample parcel risk scores"
        columns={[
          { key: "trackingNumber", name: "Tracking number" },
          { key: "risk", name: "Risk score" },
        ]}
        rows={trackingRows}
        size="sm"
        selectionMode="none"
        renderColumnCell={(column) => String(column.name)}
        renderRowCell={(cell, columnKey, row) =>
          columnKey === "risk" ? (
            <RiskScore
              {...row.risk}
              size="sm"
              accessibilityLabel={`Risk score for ${row.trackingNumber}`}
            />
          ) : (
            String(cell)
          )
        }
      />
    </Box>
  ),
  parameters: { controls: { disable: true } },
};

export const Loading: Story = {
  args: { ...Default.args, isLoading: true },
};

export const Unavailable: Story = {
  args: { value: null, assessment: "high" },
};

export const Unassessed: Story = {
  args: { value: 87, assessment: null },
};

export const ZeroAndCustomScale: Story = {
  render: () => (
    <HorizontalStack gap="4" blockAlign="start">
      <VerticalStack gap="1" inlineAlign="start">
        <Text variant="body2">Observed zero</Text>
        <RiskScore value={0} assessment="low" />
      </VerticalStack>
      <VerticalStack gap="1" inlineAlign="start">
        <Text variant="body2">Score on a 0–1 scale</Text>
        <RiskScore value={0.87} max={1} assessment="high" />
      </VerticalStack>
    </HorizontalStack>
  ),
  parameters: { controls: { disable: true } },
};

const frenchNumber = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const LocalizedNarrow: Story = {
  args: {
    value: 0.87,
    max: 1,
    assessment: "high",
    assessmentLabel: "Risque élevé de non-conformité du colis",
    accessibilityLabel: "Risque du colis",
    accessibilityValueText:
      "0,87 sur 1,00 ; risque élevé de non-conformité du colis. Un score plus élevé indique un risque plus élevé.",
    formatValue: (value) => frenchNumber.format(value),
    loadingLabel: "Évaluation en cours…",
    emptyLabel: "Score indisponible",
  },
  render: (args) => (
    <Box width={160} maxWidth="100%" lang="fr">
      <RiskScore {...args} />
    </Box>
  ),
};
