import React from "react";
import { MeterBar, type MeterBarTone } from "../MeterBar";
import { Pill } from "../Pill";
import { Text } from "../Text";
import styles from "./RiskScore.module.scss";

/** A risk assessment supplied by the application or scoring service. */
export type RiskScoreAssessment = "low" | "medium" | "high";

export type RiskScoreProps = {
  /**
   * Score on a zero-to-max scale. Higher values mean greater risk.
   * null means unavailable; zero is a real score. Nonfinite or out-of-range
   * values are displayed as unavailable, never clamped to a valid score.
   */
  value: number | null;

  /**
   * Caller-supplied risk assessment. No thresholds are inferred from the score.
   * Omit or pass null for a neutral score with an unavailable assessment.
   */
  assessment?: RiskScoreAssessment | null;

  /**
   * Upper bound of the score scale; must be finite and greater than zero.
   * This is a score scale, not a probability or percentage.
   * @default 100
   */
  max?: number;

  /**
   * Visual size. sm colors the score by assessment and omits the pill.
   * The assessment remains in the accessible value and native hover hint.
   * @default md
   */
  size?: "sm" | "md";

  /** Show the proportional bar beneath the score. Accessible range is retained.
   * @default true
   */
  showBar?: boolean;

  /**
   * Accessible name identifying the risk being measured.
   * @default Risk score
   */
  accessibilityLabel?: string;

  /**
   * Localized accessible value, including the score, scale, assessment, and
   * direction. Defaults to a description of those values in English.
   * Ignored while loading or unavailable.
   */
  accessibilityValueText?: string;

  /**
   * Localized assessment label: visible in md, accessible and a hover hint
   * in sm. Defaults to Low risk, Medium risk, High risk, or Not assessed.
   * Does not change the assessment or its color.
   * Ignored while loading or unavailable.
   */
  assessmentLabel?: string;

  /**
   * Formats the score and maximum for display. Defaults to String, preserving
   * the supplied precision. Does not change meter values or geometry.
   */
  formatValue?: (value: number) => string;

  /** Suppress the previous score and assessment while loading. */
  isLoading?: boolean;

  /** Localized loading label. @default Scoring… */
  loadingLabel?: string;

  /** Localized unavailable label. @default Not scored */
  emptyLabel?: string;
};

const assessmentLabels = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  unassessed: "Not assessed",
};
const assessmentTones: Record<RiskScoreAssessment | "unassessed", MeterBarTone> = {
  low: "success",
  medium: "warning",
  high: "danger",
  unassessed: "neutral",
};

/**
 * A bounded risk score with a supplied assessment and a proportional meter.
 * Applications own scoring, assessment thresholds, confidence, and decisions.
 *
 * @example
 * ```tsx
 * <RiskScore value={72} assessment="high" />
 * <RiskScore value={0.18} max={1} assessment="low" size="sm" />
 * <RiskScore value={null} />
 * ```
 */
export function RiskScore({
  value,
  assessment,
  max = 100,
  size = "md",
  showBar = true,
  accessibilityLabel = "Risk score",
  accessibilityValueText,
  assessmentLabel,
  formatValue = String,
  isLoading = false,
  loadingLabel = "Scoring…",
  emptyLabel = "Not scored",
}: RiskScoreProps) {
  const valid =
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isFinite(max) &&
    max > 0 &&
    value >= 0 &&
    value <= max;

  if (isLoading || !valid) {
    return (
      <span
        className={styles.root}
        data-state={isLoading ? "loading" : "empty"}
        data-size={size}
        role={isLoading ? "status" : undefined}
        aria-busy={isLoading || undefined}
      >
        <Text variant="caption" color="subdued">
          {isLoading ? loadingLabel : emptyLabel}
        </Text>
      </span>
    );
  }

  const effectiveAssessment = assessment ?? "unassessed";
  const label = assessmentLabel ?? assessmentLabels[effectiveAssessment];
  const tone = assessmentTones[effectiveAssessment];
  const displayValue = formatValue(value);
  const displayMaximum = formatValue(max);

  return (
    <span
      className={styles.root}
      data-size={size}
      data-assessment={effectiveAssessment}
      role="meter"
      aria-label={accessibilityLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={
        accessibilityValueText ??
        `${displayValue} out of ${displayMaximum}; ${label}; higher means greater risk`
      }
      title={size === "sm" ? label : undefined}
    >
      <span className={styles.valueRow}>
        <bdi
          className={styles.score}
          dir="ltr"
          data-risk-score-expression=""
        >
          <span
            className={styles.value}
            dir="ltr"
            data-risk-score-value=""
          >
            <Text variant={size === "sm" ? "body2" : "heading5"}>
              {displayValue}
            </Text>
          </span>
          <span className={styles.scale} aria-hidden="true" dir="ltr">
            <Text variant="caption" color="subdued">
              {" / "}
              {displayMaximum}
            </Text>
          </span>
        </bdi>
        {size === "sm" ? (
          <span
            className={styles.compactAssessment}
            data-risk-score-compact-label=""
            aria-hidden="true"
          >
            <Text variant="caption">{label}</Text>
          </span>
        ) : (
          <Pill
            background={
              tone === "danger"
                ? "danger"
                : tone === "warning"
                  ? "warning"
                  : tone === "success"
                    ? "success"
                    : "info"
            }
            variant="muted"
          >
            {label}
          </Pill>
        )}
      </span>
      {showBar && (
        <MeterBar
          value={value}
          max={max}
          tone={tone}
          thickness={size === "sm" ? "sm" : "md"}
        />
      )}
    </span>
  );
}
