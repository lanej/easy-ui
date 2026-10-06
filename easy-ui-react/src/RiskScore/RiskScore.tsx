import React from "react";
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
   * Visual size. Use sm in tables and other dense layouts.
   * @default md
   */
  size?: "sm" | "md";

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
   * Localized visible assessment label. Defaults to Low risk, Medium risk,
   * High risk, or Not assessed. Does not change the assessment or its color.
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

/**
 * A bounded risk score with a visible assessment and a proportional meter.
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
  accessibilityLabel = "Risk score",
  accessibilityValueText,
  assessmentLabel,
  formatValue = String,
  isLoading = false,
  loadingLabel = "Scoring…",
  emptyLabel = "Not scored",
}: RiskScoreProps) {
  const hasValue =
    !isLoading &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isFinite(max) &&
    max > 0 &&
    value >= 0 &&
    value <= max;

  if (!hasValue) {
    return (
      <span
        className={styles.root}
        data-size={size}
        data-assessment="unavailable"
        role="group"
        aria-label={accessibilityLabel}
        aria-busy={isLoading}
      >
        <span className={styles.summary}>
          <span className={styles.value} aria-hidden="true">
            —
          </span>
          <span
            className={styles.assessment}
            role={isLoading ? "status" : undefined}
          >
            {isLoading ? loadingLabel : emptyLabel}
          </span>
        </span>
      </span>
    );
  }

  // Unknown runtime assessments remain neutral when consuming unvalidated data.
  const level =
    assessment === "low" || assessment === "medium" || assessment === "high"
      ? assessment
      : "unassessed";
  const label = assessmentLabel ?? assessmentLabels[level];
  const formattedValue = formatValue(value);
  const formattedMax = formatValue(max);

  return (
    <span
      className={styles.root}
      data-size={size}
      data-assessment={level}
      role="meter"
      aria-label={accessibilityLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={
        accessibilityValueText ??
        `${formattedValue} out of ${formattedMax}; ${label}. Higher scores mean higher risk.`
      }
    >
      <span className={styles.summary} aria-hidden="true">
        <span className={styles.score}>
          <span className={styles.value}>{formattedValue}</span>
          <span className={styles.maximum}>/ {formattedMax}</span>
        </span>
        <span className={styles.assessment}>{label}</span>
      </span>
      <span className={styles.track} aria-hidden="true">
        <span
          className={styles.fill}
          style={{ inlineSize: `${(value / max) * 100}%` }}
        />
      </span>
    </span>
  );
}
