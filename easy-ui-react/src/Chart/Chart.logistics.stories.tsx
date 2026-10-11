import React, { useState } from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { Chart } from "./Chart";
import { ChartExample } from "./chartCatalog.examples";
import {
  logisticsExamples,
  reliabilityExample,
  competitivenessExample,
  priceResponseExample,
  capacityExample,
  shipmentTimelineExample,
  warehouseProgressExample,
} from "./Chart.logistics";
import styles from "./examples.module.scss";

const meta: Meta<typeof Chart> = {
  id: "components-chart-logistics",
  title: "Organisms/Charts/Chart/Logistics",
  component: Chart,
  excludeStories: ["LogisticsExamples"],
};
export default meta;
type Story = StoryObj<typeof Chart>;
export const TransitReliability: Story = {
  args: reliabilityExample,
  render: (args) => (
    <ChartExample example={reliabilityExample} overrides={args} />
  ),
};
export const RateCompetitiveness: Story = {
  args: competitivenessExample,
  render: (args) => (
    <ChartExample example={competitivenessExample} overrides={args} />
  ),
};
export const PriceVolumeResponse: Story = {
  args: priceResponseExample,
  render: (args) => (
    <ChartExample example={priceResponseExample} overrides={args} />
  ),
};
export const CapacityPlanning: Story = {
  args: capacityExample,
  render: (args) => <ChartExample example={capacityExample} overrides={args} />,
};
export const ShipmentTimeline: Story = {
  args: shipmentTimelineExample,
  render: (args) => (
    <ChartExample example={shipmentTimelineExample} overrides={args} />
  ),
};
export const WarehouseParcelProgress: Story = {
  args: warehouseProgressExample,
  render: (args) => (
    <ChartExample example={warehouseProgressExample} overrides={args} />
  ),
};

export function LogisticsExamples({
  renderer = "svg",
}: {
  renderer?: "svg" | "canvas";
}) {
  const [scenario, setScenario] = useState<string | null>(null);
  return (
    <div className={styles.gallery}>
      {logisticsExamples.map((example) => (
        <ChartExample
          key={example.title}
          example={example}
          overrides={{
            renderer,
            ...(example === priceResponseExample
              ? {
                  onRowSelect: setScenario,
                  notice: scenario
                    ? `Selected scenario: ${scenario}. ${example.notice}`
                    : example.notice,
                }
              : {}),
          }}
        />
      ))}
    </div>
  );
}
export const LogisticsIntelligence: Story = {
  render: () => <LogisticsExamples />,
};
