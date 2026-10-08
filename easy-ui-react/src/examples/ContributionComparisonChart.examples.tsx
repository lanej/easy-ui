import React from "react";
import type { Proposal } from "./DesignGuide.fixtures";
import {
  PricingReviewChartFrame,
  pricingAmount,
  pricingCurrency,
  usePricingReviewColors,
} from "./PricingReviewChartFrame.examples";

export type ContributionComparisonChartProps = {
  proposals: Proposal[];
  showDataTable?: boolean;
};

export function ContributionComparisonChart({
  proposals,
  showDataTable,
}: ContributionComparisonChartProps) {
  const colors = usePricingReviewColors();
  const bounds = proposals.map((proposal) => {
    const [lower, upper] = proposal.range.split(" to ").map(pricingAmount);
    return { id: proposal.id, lower, upper };
  });
  const categories = proposals.map((proposal) => proposal.id);

  return (
    <PricingReviewChartFrame
      showDataTable={showDataTable}
      title="Contribution / day"
      description="Scenario bounds · USD · dashed line $0"
      option={{
        legend: { show: false },
        xAxis: {
          type: "value",
          min: -50,
          max: 150,
          interval: 50,
          axisLabel: { formatter: pricingCurrency },
        },
        yAxis: { type: "category", data: categories, inverse: true },
        tooltip: { trigger: "item" },
        series: bounds.map((bound, index) => ({
          id: bound.id,
          name: `Proposal ${bound.id} · scenario bounds`,
          type: "line",
          symbol: "rect",
          symbolSize: [3, 14],
          lineStyle: { width: 4, color: colors[bound.id] },
          itemStyle: { color: colors[bound.id] },
          data: [
            [bound.lower, bound.id],
            [bound.upper, bound.id],
          ],
          markLine:
            index === 0
              ? {
                  silent: true,
                  symbol: "none",
                  label: { show: false },
                  lineStyle: { type: "dashed", width: 1 },
                  data: [{ xAxis: 0 }],
                }
              : undefined,
        })),
      }}
      dataTableLabel="View scenario bounds"
      dataTable={{
        columns: ["Proposal", "Lower ($/day)", "Upper ($/day)"],
        rows: bounds.map((bound) => ({
          id: bound.id,
          values: [bound.id, bound.lower, bound.upper],
        })),
      }}
    />
  );
}
