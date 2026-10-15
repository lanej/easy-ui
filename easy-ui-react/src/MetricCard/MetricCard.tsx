import React, { createContext, useContext, useId } from "react";
import { Pill, type PillTone } from "../Pill";
import { Card } from "../Card";
import { Text } from "../Text";
import {
  visualizationTypographyStyle,
  type VisualizationTypography,
} from "../visualization/typography";
import styles from "./MetricCard.module.scss";

export type MetricLayout = "summary" | "row";
export type MetricSize = "sm" | "md" | "lg";

type MetricDirection = "increase" | "decrease" | "unchanged";
type MetricSentiment = "positive" | "negative" | "neutral";

/** A local baseline, or a reference to a visible baseline shared by a metric group. */
export type MetricComparisonBaseline =
  | { baseline: string; baselineId?: never }
  | { baseline?: never; baselineId: string };

type MetricChange = {
  /** Formatted magnitude with units, or a complete description when direction is omitted. */
  label: string;
  /** Explicit direction, never inferred from a formatted value or sentiment. */
  direction?: MetricDirection;
  /** Localized accessible description of the complete change. */
  accessibilityLabel?: string;
  /** Business meaning independent of direction. Defaults to neutral. */
  sentiment?: MetricSentiment;
};

/** An application-calculated change and its explicit comparison baseline. */
export type MetricComparison = MetricChange & MetricComparisonBaseline;

export type MetricContentProps = {
  /** Name of the metric. */
  label: string;
  /** Application-formatted value. null means unavailable; "0" is an observed zero. */
  value: string | React.ReactElement | null;
  /** Secondary suffix, such as "days" or "USD". Suppressed without a value. */
  unit?: string;
  /** Selected period, coverage, or other metric-specific context. */
  supportingText?: string;
  comparison?: MetricComparison;
  /** Summary places the label above the reading; row uses label/value/change columns. */
  layout?: MetricLayout;
  /** Typography preset, independent of layout. Defaults to md. */
  size?: MetricSize;
  isLoading?: boolean;
  /** Localized loading message. @default Loading… */
  loadingLabel?: string;
  /** Localized unavailable label. @default No data */
  emptyLabel?: string;
  /** Override individual text-role sizes in CSS pixels. */
  typography?: VisualizationTypography;
  /** Override the emphasized value size in CSS pixels. */
  valueSize?: number;
};

export type MetricCardProps = MetricContentProps;
export type MetricComparisonContentProps = MetricComparison & {
  size?: MetricSize;
  typography?: VisualizationTypography;
};
export type MetricGroupProps = {
  /** Direct MetricContent children; the caller owns framing and section headings. */
  children: React.ReactNode;
  layout?: MetricLayout;
  size?: MetricSize;
};

type MetricPreset = {
  value: number;
  title: number;
  description: number;
  detail: number;
};
const presets: Record<MetricSize, MetricPreset> = {
  sm: { value: 20, title: 14, description: 13, detail: 13 },
  md: { value: 24, title: 14, description: 13, detail: 13 },
  lg: { value: 28, title: 15, description: 14, detail: 14 },
};
const groupContext = createContext<{ layout: MetricLayout; size: MetricSize }>({
  layout: "summary",
  size: "md",
});
const comparisonTones: Record<MetricSentiment, PillTone> = {
  positive: "success",
  negative: "danger",
  neutral: "neutral",
};
const directions: Record<MetricDirection, { symbol: string; label: string }> = {
  increase: { symbol: "↑", label: "Increased by" },
  decrease: { symbol: "↓", label: "Decreased by" },
  unchanged: { symbol: "=", label: "Unchanged" },
};

/** Layout only: responsive summaries or rows sharing value and comparison columns. */
export function MetricGroup(props: MetricGroupProps) {
  const { children, layout = "summary", size = "md" } = props;
  return (
    <groupContext.Provider value={{ layout, size }}>
      <div className={styles.container}>
        <div className={styles.group} data-metric-group="" data-layout={layout}>
          {children}
        </div>
      </div>
    </groupContext.Provider>
  );
}

/** A compact tinted comparison with a visible local or shared baseline. */
export function MetricComparisonContent(props: MetricComparisonContentProps) {
  const {
    label,
    direction,
    accessibilityLabel,
    baseline,
    baselineId,
    sentiment = "neutral",
    size = "md",
    typography,
  } = props;
  const localBaselineId = useId();
  const change = direction ? directions[direction] : undefined;
  return (
    <div
      className={styles.comparison}
      data-metric-comparison=""
      data-sentiment={sentiment}
      data-direction={direction}
      role="group"
      aria-label={
        accessibilityLabel ?? (change ? `${change.label} ${label}` : label)
      }
      aria-describedby={baselineId ?? localBaselineId}
      style={visualizationTypographyStyle({ ...presets[size], ...typography })}
    >
      <span className={styles.pill} data-metric-pill="">
        <Pill tone={comparisonTones[sentiment]} size="xs">
          <span className={styles.comparisonLabel}>
            {change && <span aria-hidden="true">{change.symbol}</span>}
            <Text>{label}</Text>
          </span>
        </Pill>
      </span>
      {baseline !== undefined && (
        <span className={styles.baseline} id={localBaselineId}>
          <Text>{baseline}</Text>
        </span>
      )}
    </div>
  );
}

/** Unframed metric content. Layout, typography, and framing are independent. */
export function MetricContent(props: MetricContentProps) {
  const {
    label,
    value,
    unit,
    supportingText,
    comparison,
    layout: requestedLayout,
    size: requestedSize,
    isLoading = false,
    loadingLabel = "Loading…",
    emptyLabel = "No data",
    typography,
    valueSize,
  } = props;
  const group = useContext(groupContext);
  const layout = requestedLayout ?? group.layout;
  const size = requestedSize ?? group.size;
  const localBaselineId = useId();
  const hasValue = value !== null && !isLoading;
  const visibleComparison = hasValue ? comparison : undefined;
  const resolvedValueSize =
    valueSize !== undefined && Number.isFinite(valueSize) && valueSize > 0
      ? valueSize
      : presets[size].value;

  return (
    <div
      className={styles.content}
      data-metric-content=""
      data-layout={layout}
      data-size={size}
      aria-busy={isLoading}
      style={visualizationTypographyStyle({ ...presets[size], ...typography })}
    >
      <div className={styles.header} data-metric-header="">
        <span className={styles.label} data-metric-label="">
          <Text>{label}</Text>
        </span>
        <div className={styles.reading} data-metric-reading="">
          <div className={styles.valueGroup} data-metric-value-group="">
            <div
              className={styles.value}
              data-metric-value=""
              style={{ fontSize: resolvedValueSize }}
            >
              {isLoading ? (
                <span role="status">{loadingLabel}</span>
              ) : (
                <>
                  <strong className={styles.number} data-metric-number="">
                    <Text fontVariantNumeric="tabular-nums">
                      {value === null ? emptyLabel : value}
                    </Text>
                  </strong>
                  {hasValue && unit && (
                    <span className={styles.unit} data-metric-unit="">
                      {` ${unit}`}
                    </span>
                  )}
                </>
              )}
            </div>
            {visibleComparison && (
              <MetricComparisonContent
                label={visibleComparison.label}
                direction={visibleComparison.direction}
                accessibilityLabel={visibleComparison.accessibilityLabel}
                sentiment={visibleComparison.sentiment}
                baselineId={visibleComparison.baselineId ?? localBaselineId}
                typography={typography}
                size={size}
              />
            )}
          </div>
          {visibleComparison?.baseline !== undefined && (
            <span
              className={styles.localBaseline}
              id={localBaselineId}
              data-metric-local-baseline=""
            >
              <Text>{visibleComparison.baseline}</Text>
            </span>
          )}
        </div>
      </div>
      {supportingText && (
        <span className={styles.supportingText} data-metric-context="">
          <Text>{supportingText}</Text>
        </span>
      )}
    </div>
  );
}

/** Optional standalone framing; use MetricContent within an existing section. */
export function MetricCard(props: MetricCardProps) {
  return (
    <Card
      as="section"
      aria-label={props.label}
      aria-busy={props.isLoading ?? false}
      background="primary"
      padding="2"
    >
      <div className={styles.container}>
        <MetricContent {...props} />
      </div>
    </Card>
  );
}
