import React, { type ReactNode } from "react";
import { HealthIndicator, type HealthIndicatorProps } from "../HealthIndicator";
import { DurationValue, type DurationValueProps } from "../DurationValue";
import {
  ObservationFreshness,
  type ObservationFreshnessProps,
} from "../ObservationFreshness";
import styles from "./HealthAssessment.module.scss";

export type HealthAssessmentProps = {
  /** Application-supplied assessment and localized labels. */
  health: Omit<HealthIndicatorProps, "size" | "isLoading">;
  /** Optional duration observation. Invalid or missing values suppress health. */
  observation?: Omit<DurationValueProps, "size" | "isLoading">;
  /** Optional caller-classified freshness; no aging policy is inferred. */
  freshness?: Omit<ObservationFreshnessProps, "size" | "isLoading">;
  /** Optional reference description or visualization supplied by the caller. */
  reference?: ReactNode;
  size?: "sm" | "md";
  isLoading?: boolean;
  accessibilityLabel?: string;
};

/** Composes supplied observation, assessment, and freshness without thresholds. */
export function HealthAssessment({
  health,
  observation,
  freshness,
  reference,
  size = "md",
  isLoading = false,
  accessibilityLabel = "Health assessment",
}: HealthAssessmentProps) {
  const missingObservation =
    observation !== undefined &&
    (typeof observation.value !== "number" ||
      !Number.isFinite(observation.value) ||
      observation.value < 0);
  return (
    <div
      className={styles.root}
      data-size={size}
      role="group"
      aria-label={accessibilityLabel}
      aria-busy={isLoading}
    >
      <div className={styles.summary}>
        {observation !== undefined && (
          <DurationValue {...observation} size={size} isLoading={isLoading} />
        )}
        <HealthIndicator
          {...health}
          size={size}
          isLoading={isLoading}
          availability={
            missingObservation ? "unavailable" : health.availability
          }
        />
      </div>
      {!isLoading && reference != null && (
        <div className={styles.reference}>{reference}</div>
      )}
      {freshness !== undefined && (
        <ObservationFreshness
          {...freshness}
          size={size}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
