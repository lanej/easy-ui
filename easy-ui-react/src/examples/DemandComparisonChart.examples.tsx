import React from "react";
import type { Proposal } from "./DesignGuide.fixtures";
import {
  PricingReviewChartFrame,
  usePricingReviewColors,
} from "./PricingReviewChartFrame.examples";

export type DemandComparisonChartProps = {
  proposals: Proposal[];
  showDataTable?: boolean;
};

export function DemandComparisonChart({
  proposals,
  showDataTable,
}: DemandComparisonChartProps) {
  const colors = usePricingReviewColors();
  const categories = proposals.map((proposal) => proposal.id);

  return (
    <PricingReviewChartFrame
      showDataTable={showDataTable}
      title="Demand / day"
      description="Sep 7–13, 2026 UTC · parcels · shared 0–200 scale"
      legend={proposals.map((proposal) => ({
        name: proposal.id,
        color: colors[proposal.id],
        symbol: "line",
      }))}
      option={{
        tooltip: {
          trigger: "axis",
          valueFormatter: (value) => `${value} parcels`,
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: Array.from({ length: 7 }, (_, index) => `Sep ${7 + index}`),
          axisLabel: {
            interval: 6,
            showMinLabel: true,
            showMaxLabel: true,
          },
        },
        yAxis: { type: "value", min: 0, max: 200, interval: 100 },
        series: proposals.map((proposal) => ({
          id: proposal.id,
          name: proposal.id,
          type: "line",
          symbolSize: 5,
          lineStyle: { color: colors[proposal.id] },
          itemStyle: { color: colors[proposal.id] },
          data: proposal.demand,
        })),
      }}
      dataTableLabel="View daily observations"
      dataTable={{
        columns: ["Date (UTC)", ...categories.map((id) => `${id} (parcels)`)],
        rows: Array.from({ length: 7 }, (_, index) => ({
          id: `2026-09-${String(7 + index).padStart(2, "0")}`,
          values: [
            `2026-09-${String(7 + index).padStart(2, "0")}`,
            ...proposals.map((proposal) => proposal.demand[index]),
          ],
        })),
      }}
    />
  );
}
