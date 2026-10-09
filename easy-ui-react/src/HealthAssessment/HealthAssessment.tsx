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
  /** Optional caller-supplied submetrics beside the headline duration. */
  observationDetails?: ReactNode;
  /** Optional caller-classified freshness; no aging policy is inferred. */
  freshness?: Omit<ObservationFreshnessProps, "size" | "isLoading">;
  /** Optional reference description or visualization supplied by the caller. */
  reference?: ReactNode;
  /** Optional supporting content below the primary reference; included in the reference column height. */
  referenceDetails?: ReactNode;
  /** Compact keeps reference content beside the observation at narrower widths. */
  referenceLayout?: "auto" | "compact";
  /** Presentation form; responsive progressively reveals supplied content by container width. */
  variant?: "compact" | "detailed" | "default" | "wide" | "responsive";
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
  observationDetails,
  reference,
  referenceDetails,
  referenceLayout = "auto",
  variant = "default",
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
  const showInformation = variant !== "detailed";
  const showContext = variant !== "compact";
  const showReference = variant !== "compact" && reference != null;
  const showMetrics = variant !== "compact" && observationDetails != null;
  const showReferenceDetails =
    showReference && variant !== "detailed" && referenceDetails != null;
  const stacked =
    size === "md" &&
    !isLoading &&
    (showReference || variant === "compact" || variant === "responsive");
  const duration = observation !== undefined && (
    <DurationValue
      {...observation}
      size={size === "md" && showReference ? "lg" : size}
      isLoading={isLoading}
    />
  );
  const indicator =
    observation === undefined || (!isLoading && !missingObservation) ? (
      <HealthIndicator {...health} size="sm" isLoading={isLoading} />
    ) : null;
  return (
    <div
      className={styles.root}
      data-size={size}
      data-variant={variant}
      role="group"
      aria-label={
        !showContext || !showInformation || label == null
          ? typeof label === "string"
            ? label
            : accessibilityLabel
          : undefined
      }
      aria-labelledby={
        showContext && showInformation && label != null ? labelId : undefined
      }
      aria-busy={isLoading}
    >
      <div
        className={styles.layout}
        data-reference-layout={referenceLayout}
        data-has-reference={!isLoading && showReference}
        data-has-reference-details={!isLoading && showReferenceDetails}
      >
        {!showInformation && isLoading && (
          <span role="status">
            <Text as="span">Loading…</Text>
          </span>
        )}
        {showInformation && (
          <div className={styles.information}>
            {showContext && label != null && (
              <div id={labelId} className={styles.label}>
                <Text
                  as="p"
                  variant={stacked ? "caption" : "body2"}
                  color="neutral.700"
                >
                  {label}
                </Text>
              </div>
            )}
            <div className={styles.summary} data-stacked={stacked}>
              {stacked ? (
                <>
                  {indicator}
                  {showMetrics ? (
                    <div className={styles.headline}>
                      {duration}
                      <div className={styles.observationDetails}>
                        {observationDetails}
                      </div>
                    </div>
                  ) : (
                    duration
                  )}
                </>
              ) : (
                <>
                  {duration}
                  {indicator}
                </>
              )}
            </div>
            {!isLoading && !stacked && showMetrics && (
              <div className={styles.observationDetails}>
                {observationDetails}
              </div>
            )}
            {!isLoading &&
              showContext &&
              freshness !== undefined &&
              !(
                missingObservation &&
                freshness.state !== "fresh" &&
                freshness.state !== "stale"
              ) && (
                <div className={styles.freshness}>
                  <ObservationFreshness {...freshness} size={size} />
                </div>
              )}
          </div>
        )}
        {!isLoading && showReference && (
          <div className={styles.reference}>{reference}</div>
        )}
        {!isLoading && showReferenceDetails && (
          <div className={styles.referenceDetails}>{referenceDetails}</div>
        )}
      </div>
    </div>
  );
}
