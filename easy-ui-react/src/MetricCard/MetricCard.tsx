import React from "react";
import { Badge, BadgeVariant } from "../Badge";
import { Card } from "../Card";
import { Sparkline, SparklineProps } from "../Sparkline";
import {
  visualizationTypographyStyle,
  type VisualizationTypography,
} from "../visualization/typography";
import styles from "./MetricCard.module.scss";

/** An application-calculated comparison with its explicit baseline and meaning. */
export type MetricComparison = {
  /** Formatted change, including direction and units, e.g. "4.2% lower". */
  label: string;
  /** Explicit comparison period or baseline, e.g. "vs previous 30 days". */
  baseline: string;
  /** Business meaning, independent of direction. Defaults to neutral. */
  sentiment?: "positive" | "negative" | "neutral";
};

/** Exact KPI content, optional comparison, and optional compact trend. */
export type MetricContentProps = {
  /** Name of the metric. */
  label: string;
  /** Formatted value with units. null means unavailable; "0" is a real value. */
  value: string | null;
  /** Selected period, coverage, or other metric context. */
  supportingText?: string;
  /** Change relative to an explicit baseline, calculated by the caller. */
  comparison?: MetricComparison;
  /** Optional compact trend with an accessible summary. */
  trend?: SparklineProps;
  /** Show a loading status and suppress the previous value and trend. */
  isLoading?: boolean;
  /** Localized loading message; defaults to "Loading…". */
  loadingLabel?: string;
  /** Localized label for an unavailable value; defaults to "No data". */
  emptyLabel?: string;
  /** Text sizes in CSS pixels, independently configurable by role. */
  typography?: VisualizationTypography;
  /** Size of the emphasized metric value in CSS pixels; defaults to 28. */
  valueSize?: number;
};

/** Framed recipe for the same independently usable metric content. */
export type MetricCardProps = MetricContentProps;
export type MetricComparisonContentProps = MetricComparison & {
  /** Text sizes in CSS pixels, independently configurable by role. */
  typography?: VisualizationTypography;
};

const comparisonVariants: Record<
  NonNullable<MetricComparison["sentiment"]>,
  BadgeVariant
> = {
  positive: "success",
  negative: "danger",
  neutral: "gray",
};

/** Comparison content can be placed independently while keeping its baseline and sentiment explicit. */
export function MetricComparisonContent({
  label,
  baseline,
  sentiment = "neutral",
  typography,
}: MetricComparisonContentProps) {
  return (
    <div
      className={styles.comparison}
      data-sentiment={sentiment}
      style={visualizationTypographyStyle(typography)}
    >
      <Badge variant={comparisonVariants[sentiment]}>
        <span className={styles.comparisonLabel} data-sentiment={sentiment}>
          {label}
        </span>
      </Badge>
      <span className={styles.baseline}>{baseline}</span>
    </div>
  );
}

/** Unframed metric content for caller-owned cards, sections, and dense layouts. */
export function MetricContent({
  label,
  value,
  supportingText,
  comparison,
  trend,
  isLoading = false,
  loadingLabel = "Loading…",
  emptyLabel = "No data",
  typography,
  valueSize = 28,
}: MetricContentProps) {
  const hasValue = value !== null && !isLoading;

  return (
    <div
      className={styles.content}
      aria-busy={isLoading}
      style={visualizationTypographyStyle(typography)}
    >
      <span className={styles.label}>{label}</span>
      <div
        className={styles.value}
        style={{
          fontSize:
            Number.isFinite(valueSize) && valueSize > 0 ? valueSize : 28,
        }}
      >
        {isLoading ? (
          <span role="status">{loadingLabel}</span>
        ) : (
          <strong>{value === null ? emptyLabel : value}</strong>
        )}
      </div>
      {supportingText && (
        <span className={styles.supportingText}>{supportingText}</span>
      )}
      {hasValue && trend && <Sparkline {...trend} />}
      {hasValue && comparison && (
        <MetricComparisonContent {...comparison} typography={typography} />
      )}
    </div>
  );
}

/** Default card framing, composed from the independently reusable metric content. */
export function MetricCard(props: MetricCardProps) {
  return (
    <Card
      as="section"
      aria-label={props.label}
      aria-busy={props.isLoading ?? false}
      background="primary"
      padding="2"
    >
      <MetricContent {...props} />
    </Card>
  );
}
