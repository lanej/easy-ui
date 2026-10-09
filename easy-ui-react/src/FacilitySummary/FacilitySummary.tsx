import React, { useId, type ReactNode } from "react";
import { Text } from "../Text";
import {
  HealthAssessment,
  type HealthAssessmentProps,
} from "../HealthAssessment";
import styles from "./FacilitySummary.module.scss";

export type FacilitySummaryObservation = Omit<
  HealthAssessmentProps,
  "variant" | "size" | "isLoading" | "referenceLayout" | "healthPlacement"
> & {
  /** Stable identity for this independently supplied observation. */
  id: string;
};
export type FacilitySummaryProps = {
  name: ReactNode;
  identifier?: string;
  /** Caller-owned classification, such as distribution center or delivery unit. */
  facilityType?: ReactNode;
  location?: ReactNode;
  observations?: readonly FacilitySummaryObservation[];
  /** Compact headline metrics, default comparisons, or expanded references. */
  variant?: "compact" | "default" | "detailed";
  details?: ReactNode;
  isLoading?: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
  /** Used when the visible name is not plain text. */
  accessibilityLabel?: string;
};

/** Facility identity and independently assessed observations; no facility-wide health is inferred. */
export function FacilitySummary({
  name,
  identifier,
  facilityType,
  location,
  observations = [],
  variant = "default",
  details,
  isLoading = false,
  emptyLabel = "Observations unavailable",
  loadingLabel = "Loading observations…",
  accessibilityLabel = "Facility summary",
}: FacilitySummaryProps) {
  const nameId = useId();
  return (
    <section
      className={styles.root}
      data-variant={variant}
      aria-labelledby={typeof name === "string" ? nameId : undefined}
      aria-label={typeof name === "string" ? undefined : accessibilityLabel}
      aria-busy={isLoading}
    >
      <div className={styles.identity}>
        <div className={styles.name}>
          <Text id={nameId} as="p" variant="body1" weight="semibold">
            {name}
          </Text>
          {identifier && (
            <Text as="span" variant="caption" color="subdued">
              {identifier}
            </Text>
          )}
        </div>
        {(facilityType != null || location != null) && (
          <div className={styles.metadata}>
            {facilityType != null && (
              <Text as="span" variant="caption" color="subdued">
                {facilityType}
              </Text>
            )}
            {location != null && (
              <Text as="span" variant="caption" color="subdued">
                {location}
              </Text>
            )}
          </div>
        )}
      </div>
      {isLoading ? (
        <Text as="p" variant="caption">
          <span role="status">{loadingLabel}</span>
        </Text>
      ) : observations.length ? (
        <div className={styles.observations}>
          {observations.map(({ id, ...observation }) => (
            <div key={id} className={styles.observation}>
              <HealthAssessment
                {...observation}
                health={
                  variant === "compact"
                    ? { ...observation.health, variant: "dot" }
                    : observation.health
                }
                healthPlacement={variant === "compact" ? "label" : "headline"}
                size="sm"
                referenceLayout="below"
                reference={
                  observation.reference != null ? (
                    <div className={styles.reference}>
                      {observation.reference}
                    </div>
                  ) : undefined
                }
                variant={
                  variant === "compact"
                    ? "compact"
                    : variant === "detailed"
                      ? "wide"
                      : "default"
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <Text as="p" variant="caption" color="subdued">
          {emptyLabel}
        </Text>
      )}
      {!isLoading && variant !== "compact" && details != null && (
        <div className={styles.details}>{details}</div>
      )}
    </section>
  );
}
