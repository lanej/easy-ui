import React from "react";
import type { Proposal } from "./DesignGuide.fixtures";
import {
  PricingReviewChartFrame,
  pricingAmount,
  pricingCurrency,
  usePricingReviewColors,
} from "./PricingReviewChartFrame.examples";

export type PriceComparisonChartProps = {
  proposals: Proposal[];
  showDataTable?: boolean;
};

export function PriceComparisonChart({
  proposals,
  showDataTable,
}: PriceComparisonChartProps) {
  const colors = usePricingReviewColors();
  const prices = proposals.map((proposal) => {
    const [current, proposed] = proposal.price.split(" → ").map(pricingAmount);
    return { id: proposal.id, current, proposed };
  });
  const categories = proposals.map((proposal) => proposal.id);

  return (
    <PricingReviewChartFrame
      showDataTable={showDataTable}
      title="Price / parcel"
      description="Current vs proposed · USD"
      legend={[
        { name: "Current", color: colors.A },
        { name: "Proposed", color: colors.B },
      ]}
      option={{
        xAxis: {
          type: "value",
          min: 0,
          max: 8,
          interval: 2,
          axisLabel: { formatter: pricingCurrency },
        },
        yAxis: { type: "category", data: categories, inverse: true },
        tooltip: {
          trigger: "axis",
          valueFormatter: (value) => `$${Number(value).toFixed(2)}`,
        },
        series: [
          {
            id: "current",
            name: "Current",
            type: "bar",
            barMaxWidth: 14,
            itemStyle: { color: colors.A },
            data: prices.map((price) => price.current),
          },
          {
            id: "proposed",
            name: "Proposed",
            type: "bar",
            barMaxWidth: 14,
            itemStyle: { color: colors.B },
            data: prices.map((price) => price.proposed),
          },
        ],
      }}
      dataTableLabel="View exact prices"
      dataTable={{
        columns: ["Proposal", "Current ($/parcel)", "Proposed ($/parcel)"],
        rows: prices.map((price) => ({
          id: price.id,
          values: [
            price.id,
            price.current.toFixed(2),
            price.proposed.toFixed(2),
          ],
        })),
      }}
    />
  );
}
