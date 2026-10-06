import React from "react";
import type { Proposal } from "./DesignGuide.fixtures";
import { PriceComparisonChart } from "./PriceComparisonChart.examples";
import { ContributionComparisonChart } from "./ContributionComparisonChart.examples";
import { DemandComparisonChart } from "./DemandComparisonChart.examples";
import styles from "./PricingReview.module.scss";

export function PricingReviewCharts({
  proposals,
  showDataTable,
}: {
  proposals: Proposal[];
  showDataTable?: boolean;
}) {
  return (
    <section
      className={styles.comparisons}
      aria-label="Graphical proposal comparisons"
      data-review-comparisons
    >
      <PriceComparisonChart
        proposals={proposals}
        showDataTable={showDataTable}
      />
      <ContributionComparisonChart
        proposals={proposals}
        showDataTable={showDataTable}
      />
      <DemandComparisonChart
        proposals={proposals}
        showDataTable={showDataTable}
      />
    </section>
  );
}
