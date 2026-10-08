import React from "react";
import tokens from "@easypost/easy-ui-tokens/js/tokens";
import {
  ChartDataView,
  ChartHeading,
  ChartLegend,
  ChartProvider,
  ChartSurface,
} from "../Chart";
import type { ChartLegendItem, ChartProps } from "../Chart";
import { useColorScheme } from "../Theme";
import styles from "./PricingReview.module.scss";

export function pricingAmount(value: string) {
  return Number(value.replace("−", "-").replace(/[^\d.-]/g, ""));
}

const plotHeight = 200;
const plotGrid = {
  left: 40,
  right: 24,
  top: 16,
  bottom: 32,
  containLabel: false,
};
const typography = { title: 16, description: 12, control: 12 };

type ComparisonChartProps = Pick<
  ChartProps,
  "option" | "dataTable" | "dataTableLabel" | "showDataTable"
> & { title: string; description: string; legend?: readonly ChartLegendItem[] };

export function PricingReviewChartFrame({
  title,
  description,
  option,
  dataTable,
  dataTableLabel,
  showDataTable = true,
  legend = [],
}: ComparisonChartProps) {
  return (
    <ChartProvider>
      <section
        className={styles.comparison}
        aria-label={title}
        data-review-comparison
      >
        <div className={styles.comparisonHeading} data-review-chart-heading>
          <ChartHeading title={title} typography={typography} />
          <p className={styles.comparisonDescription}>{description}</p>
        </div>
        <ChartSurface
          aria-label={description}
          option={{ ...option, grid: plotGrid, legend: { show: false } }}
          height={plotHeight}
          layout="native"
          typography={typography}
        />
        {(legend.length > 0 || (showDataTable && dataTable)) && (
          <div className={styles.comparisonFooter} data-review-chart-footer>
            <ChartLegend items={legend} typography={typography} />
            {showDataTable && dataTable && (
              <ChartDataView
                title={title}
                dataTable={dataTable}
                disclosureLabel={dataTableLabel}
                typography={typography}
              />
            )}
          </div>
        )}
      </section>
    </ChartProvider>
  );
}

export function usePricingReviewColors() {
  const { resolvedColorScheme } = useColorScheme();
  const scheme = resolvedColorScheme === "dark" ? "dark" : "light";
  const colors: Record<string, string> = {
    A: tokens[`theme.${scheme}.color.primary.600`],
    B: tokens[`theme.${scheme}.color.secondary.600`],
    C: tokens[`theme.${scheme}.color.positive.700`],
  };
  return colors;
}

export function pricingCurrency(value: number) {
  return value < 0 ? `−$${Math.abs(value)}` : `$${value}`;
}
