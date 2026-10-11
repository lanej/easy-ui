import React from "react";
import { useId } from "react-aria";
import { MeterBar } from "../MeterBar";
import {
  visualizationTypographyStyle,
  type VisualizationTypography,
} from "../visualization/typography";
import styles from "./ProportionBar.module.scss";

export type ProportionBarProps = {
  /** Name of the measured population or subset, not a task's progress. */
  label: string;
  /** Finite, non-negative part of total. null means unavailable. */
  value: number | null;
  /** Finite, non-negative population. A zero total has no defined percentage. */
  total: number | null;
  /** Unframed layouts; bar omits valid-data text for caller-owned compositions. */
  presentation?: "compact" | "expanded" | "bar";
  /** Application-owned meaning. Never inferred from the percentage. */
  tone?: "neutral" | "success" | "warning" | "danger";
  /** Formats finite counts; defaults to grouped English numbers. */
  formatValue?: (value: number) => string;
  /** Formats a fraction from 0 to 1, not a number from 0 to 100. */
  formatPercentage?: (fraction: number) => string;
  /** Hide stale values, counts, and the meter while loading. */
  isLoading?: boolean;
  loadingLabel?: string;
  emptyLabel?: string;
  /** Label for 0 / 0, which is not an observed zero percent. */
  emptyTotalLabel?: string;
  /** Label for negative/non-finite values or a part exceeding its total. */
  invalidValueLabel?: string;
  /** Text roles in CSS pixels. Label and detail default to 14px. */
  typography?: VisualizationTypography;
  /** Emphasized value size in CSS pixels; defaults to 18 (compact) or 32 (expanded). */
  valueSize?: number;
};

const counts = new Intl.NumberFormat("en-US", { maximumFractionDigits: 20 });
const percentages = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

type ValueState = "valid" | "missing" | "empty" | "invalid" | "loading";
function valueState(
  value: number | null,
  total: number | null,
  isLoading: boolean,
): ValueState {
  if (isLoading) return "loading";
  if (
    (value !== null && (!Number.isFinite(value) || value < 0)) ||
    (total !== null && (!Number.isFinite(total) || total < 0))
  )
    return "invalid";
  if (value === null || total === null) return "missing";
  if (value > total) return "invalid";
  if (total === 0) return "empty";
  return "valid";
}

/** A part-to-whole metric and optional summary, with no card or chart engine. */
export function ProportionBar({
  label,
  value,
  total,
  presentation = "compact",
  tone = "neutral",
  formatValue = counts.format,
  formatPercentage = percentages.format,
  isLoading = false,
  loadingLabel = "Loading…",
  emptyLabel = "No data",
  emptyTotalLabel = "No population",
  invalidValueLabel = "Invalid proportion",
  typography,
  valueSize,
}: ProportionBarProps) {
  const id = useId();
  const state = valueState(value, total, isLoading);
  const fraction =
    state === "valid" && value !== null && total !== null
      ? value / total
      : null;
  const valid = fraction !== null;
  const summary = presentation !== "bar" || !valid;
  const formatCount = (count: number | null) =>
    count !== null && Number.isFinite(count) ? formatValue(count) : "—";
  // Loading never calls formatters with stale observations.
  const ratioText = isLoading
    ? ""
    : `${formatCount(value)} / ${formatCount(total)}`;
  const valueText = valid
    ? formatPercentage(fraction)
    : state === "loading"
      ? loadingLabel
      : state === "missing"
        ? emptyLabel
        : state === "empty"
          ? emptyTotalLabel
          : invalidValueLabel;
  const defaultSize = presentation === "expanded" ? 32 : 18;
  const size =
    valueSize !== undefined && Number.isFinite(valueSize) && valueSize > 0
      ? valueSize
      : defaultSize;

  return (
    <div
      className={styles.root}
      data-proportion-bar=""
      data-presentation={presentation}
      data-value-state={state}
      data-tone={valid ? tone : "neutral"}
      style={visualizationTypographyStyle(typography)}
      role={valid ? "meter" : undefined}
      aria-labelledby={summary ? `${id}-label` : undefined}
      aria-label={summary ? undefined : label}
      aria-valuemin={valid ? 0 : undefined}
      aria-valuemax={valid ? (total ?? undefined) : undefined}
      aria-valuenow={valid ? (value ?? undefined) : undefined}
      aria-valuetext={valid ? `${valueText} (${ratioText})` : undefined}
      aria-busy={isLoading}
    >
      {summary && (
        <div className={styles.summary}>
          <span
            className={styles.percentage}
            style={{ fontSize: size }}
            role={isLoading ? "status" : undefined}
          >
            {valueText}
          </span>
          <div className={styles.details}>
            <span id={`${id}-label`} className={styles.label}>
              {label}
            </span>
            {!isLoading && <span className={styles.counts}>{ratioText}</span>}
          </div>
        </div>
      )}
      {valid && value !== null && total !== null && (
        <MeterBar
          value={value}
          max={total}
          tone={tone}
          thickness={presentation === "expanded" ? "lg" : "md"}
        />
      )}
    </div>
  );
}
