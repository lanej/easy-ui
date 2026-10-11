import React from "react";
import {
  HealthIndicator,
  type HealthIndicatorAssessment,
} from "../HealthIndicator";
import styles from "./EventMetrics.module.scss";

/** A caller-supplied outcome; neither its value nor its assessment is inferred. */
export type EventMetric = {
  id: string;
  label: string;
  /** Formatted value and unit, such as "6 h" or "2%". Null or blank is unavailable. */
  valueLabel: string | null;
  assessment?: HealthIndicatorAssessment | null;
  /** Optional extra context after the value; omit assessment words conveyed by color. */
  statusLabel?: string;
  /** Localized assessment meaning retained for assistive technology and hover. */
  assessmentLabel?: string;
  availability?: "available" | "unavailable";
  isLoading?: boolean;
  unavailableLabel?: string;
  loadingLabel?: string;
  /** Supplied reference in the same units; never rendered for an unavailable value. */
  reference?: React.ReactNode;
};

export type EventMetricsProps = {
  metrics: readonly EventMetric[];
  /** Outcomes only, inline references, or full references beneath each headline. */
  variant?: "minimal" | "compact" | "expanded";
  ariaLabel?: string;
};

const assessmentLabels = {
  healthy: "Healthy",
  degraded: "Degraded",
  unhealthy: "Unhealthy",
};

/** Independent event outcomes with consistent label-and-value pills at every density. */
export function EventMetrics({
  metrics,
  variant = "compact",
  ariaLabel = "Event metrics",
}: EventMetricsProps) {
  if (!metrics.length) return null;

  return (
    <ul
      className={styles.metrics}
      role="list"
      data-event-metrics
      data-variant={variant}
      aria-label={ariaLabel}
    >
      {metrics.map((metric) => {
        const {
          id,
          label,
          valueLabel,
          assessment,
          statusLabel,
          assessmentLabel,
          availability = "available",
          isLoading = false,
          unavailableLabel = "Unavailable",
          loadingLabel = "Assessing…",
          reference,
        } = metric;
        const resolvedAvailability =
          availability === "unavailable" || !valueLabel?.trim()
            ? "unavailable"
            : "available";
        const available = resolvedAvailability === "available" && !isLoading;
        const outcomeLabel = [valueLabel, statusLabel]
          .filter(Boolean)
          .join(" · ");
        const visibleLabel = `${label} ${outcomeLabel}`;
        const accessibleLabel = isLoading
          ? `${label}: ${loadingLabel}`
          : !available
            ? `${label}: ${unavailableLabel}`
            : `${label}: ${valueLabel}; ${
                assessmentLabel ??
                statusLabel ??
                (assessment && assessmentLabels[assessment]) ??
                "Not assessed"
              }`;
        const showReference =
          variant !== "minimal" && available && reference != null;

        return (
          <li className={styles.metric} key={id} data-metric-id={id}>
            <div
              className={styles.headline}
              title={accessibleLabel}
              data-metric-header
            >
              <HealthIndicator
                assessment={assessment}
                availability={resolvedAvailability}
                isLoading={isLoading}
                size="sm"
                label={visibleLabel}
                accessibilityLabel={accessibleLabel}
                unavailableLabel={`${label} ${unavailableLabel}`}
                loadingLabel={`${label} ${loadingLabel}`}
              />
            </div>
            {showReference && (
              <div className={styles.reference} data-metric-reference>
                {reference}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
