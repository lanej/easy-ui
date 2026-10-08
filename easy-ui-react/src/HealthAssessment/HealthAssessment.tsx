import React, { useId, type ReactNode } from "react";
import { Text } from "../Text";
import { HealthIndicator, type HealthIndicatorProps } from "../HealthIndicator";
import { DurationValue, type DurationValueProps } from "../DurationValue";
import {
  ObservationFreshness,
  type ObservationFreshnessProps,
} from "../ObservationFreshness";
import styles from "./HealthAssessment.module.scss";

export type HealthAssessmentProps = {
  /** Visible name of the observation; also labels the assessment group. */
  label?: ReactNode;
  /** Application-supplied assessment and localized labels. */
  health: Omit<HealthIndicatorProps, "size" | "isLoading">;
  /** Optional duration observation. Invalid or missing values suppress health. */
  observation?: Omit<DurationValueProps, "size" | "isLoading">;
  /** Optional caller-classified freshness; no aging policy is inferred. */
  freshness?: Omit<ObservationFreshnessProps, "size" | "isLoading">;
  /** Optional reference description or visualization supplied by the caller. */
  reference?: ReactNode;
  /** Optional supporting content below the primary reference; does not affect observation alignment. */
  referenceDetails?: ReactNode;
  size?: "sm" | "md";
  isLoading?: boolean;
  accessibilityLabel?: string;
};

/** Composes supplied observation, assessment, and freshness without thresholds. */
export function HealthAssessment({
  label,
  health,
  observation,
  freshness,
  reference,
  referenceDetails,
  size = "md",
  isLoading = false,
  accessibilityLabel = "Health assessment",
}: HealthAssessmentProps) {
  const labelId = useId();
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
      aria-label={label == null ? accessibilityLabel : undefined}
      aria-labelledby={label != null ? labelId : undefined}
      aria-busy={isLoading}
    >
      <div
        className={styles.layout}
        data-has-reference={!isLoading && reference != null}
      >
        <div className={styles.information}>
          {label != null && (
            <div id={labelId} className={styles.label}>
              <Text as="span" variant="body2" color="neutral.700">
                {label}
              </Text>
            </div>
          )}
          <div className={styles.summary}>
            {observation !== undefined && (
              <DurationValue
                {...observation}
                size={size === "md" && reference != null ? "lg" : size}
                isLoading={isLoading}
              />
            )}
            {observation === undefined ||
            (!isLoading && !missingObservation) ? (
              <HealthIndicator {...health} size="sm" isLoading={isLoading} />
            ) : null}
          </div>
          {!isLoading &&
            freshness !== undefined &&
            !(
              missingObservation &&
              freshness.state !== "fresh" &&
              freshness.state !== "stale"
            ) && <ObservationFreshness {...freshness} size={size} />}
        </div>
        {!isLoading && reference != null && (
          <div className={styles.reference}>{reference}</div>
        )}
        {!isLoading && reference != null && referenceDetails != null && (
          <div className={styles.referenceDetails}>{referenceDetails}</div>
        )}
      </div>
    </div>
  );
}
