import React from "react";
import { Pill, type PillTone } from "../Pill";
import { StatusDot } from "../StatusDot";
import styles from "./HealthIndicator.module.scss";

/** An assessment supplied by the application, never inferred by the indicator. */
export type HealthIndicatorAssessment = "healthy" | "degraded" | "unhealthy";

export type HealthIndicatorProps = {
  assessment?: HealthIndicatorAssessment | null;
  /** Unavailable observations suppress any previously supplied assessment. */
  availability?: "available" | "unavailable";
  /** Loading suppresses previous assessments, including unavailable state. */
  isLoading?: boolean;
  size?: "sm" | "md";
  /** Dot retains the assessment text as an accessible name and tooltip. */
  variant?: "pill" | "dot";
  /** Visible localized assessment or unassessed label. */
  label?: string;
  loadingLabel?: string;
  unavailableLabel?: string;
  /** Optional name identifying what is being assessed. */
  accessibilityLabel?: string;
};

const labels = {
  healthy: "Healthy",
  degraded: "Degraded",
  unhealthy: "Unhealthy",
  unassessed: "Not assessed",
};
const tones: Record<keyof typeof labels, PillTone> = {
  healthy: "success",
  degraded: "warning",
  unhealthy: "danger",
  unassessed: "neutral",
};

/** A compact, text-labeled health assessment with distinct neutral data states. */
export function HealthIndicator({
  assessment,
  availability = "available",
  isLoading = false,
  size = "md",
  variant = "pill",
  label,
  loadingLabel = "Assessing…",
  unavailableLabel = "Unavailable",
  accessibilityLabel,
}: HealthIndicatorProps) {
  const level =
    assessment === "healthy" ||
    assessment === "degraded" ||
    assessment === "unhealthy"
      ? assessment
      : "unassessed";
  const state = isLoading
    ? "loading"
    : availability === "unavailable"
      ? "unavailable"
      : level;
  const text = isLoading
    ? loadingLabel
    : state === "unavailable"
      ? unavailableLabel
      : (label ?? labels[level]);
  const tone =
    state === "loading" || state === "unavailable" ? "neutral" : tones[level];

  return (
    <span
      className={styles.root}
      data-assessment={state}
      data-size={size}
      role={
        isLoading && variant === "dot"
          ? "status"
          : accessibilityLabel
            ? "group"
            : undefined
      }
      aria-label={accessibilityLabel}
      aria-busy={isLoading || undefined}
    >
      {variant === "dot" ? (
        <StatusDot
          label={text}
          tone={
            tone === "neutral"
              ? "neutral"
              : tone === "success"
                ? "success"
                : tone === "warning"
                  ? "warning"
                  : "danger"
          }
          size={size}
        />
      ) : (
        <Pill tone={tone} size={size}>
          <span
            className={styles.label}
            role={isLoading ? "status" : undefined}
          >
            {text}
          </span>
        </Pill>
      )}
    </span>
  );
}
