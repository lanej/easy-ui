import React from "react";
import { StatusDot } from "../StatusDot";
import { Text } from "../Text";
import styles from "./ObservationFreshness.module.scss";

export type ObservationFreshnessState = "fresh" | "stale" | "unavailable";

export type ObservationFreshnessProps = {
  /** Caller-supplied freshness; no time thresholds are inferred. */
  state?: ObservationFreshnessState;
  /** ISO date, ISO timestamp with timezone, or Date. Invalid/missing timestamps are omitted without changing state. */
  observedAt?: string | Date;
  /** Caller-owned locale and timezone formatting; defaults to the supplied timestamp. */
  formatObservedAt?: (value: string | Date) => string;
  size?: "sm" | "md";
  isLoading?: boolean;
  accessibilityLabel?: string;
  /** Localized accessible name and hover hint for fresh or stale data. */
  stateLabel?: string;
  /** Show the fresh state label as well as its dot; stale labels are always visible. */
  showStateLabel?: boolean;
  /** Optional visible timestamp prefix; omitted by default. */
  observedAtLabel?: string;
  loadingLabel?: string;
  emptyLabel?: string;
};

function isValidTimestamp(value: string | Date): boolean {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    )
  )
    return false;
  const date = value.slice(0, 10);
  const time = value.split("T")[1];
  if (
    time &&
    (Number(time.slice(0, 2)) > 23 ||
      Number(time.slice(3, 5)) > 59 ||
      Number(time.slice(6, 8).replace(/[Z+-]/g, "")) > 59)
  )
    return false;
  const calendarDate = new Date(`${date}T00:00:00Z`);
  return (
    Number.isFinite(calendarDate.getTime()) &&
    calendarDate.toISOString().slice(0, 10) === date &&
    Number.isFinite(Date.parse(value))
  );
}

export function ObservationFreshness({
  state = "unavailable",
  observedAt,
  formatObservedAt,
  size = "md",
  isLoading = false,
  accessibilityLabel = "Observation freshness",
  stateLabel,
  showStateLabel = false,
  observedAtLabel,
  loadingLabel = "Loading…",
  emptyLabel = "Unavailable",
}: ObservationFreshnessProps) {
  const resolvedState =
    state === "fresh" || state === "stale" ? state : "unavailable";
  const available = !isLoading && resolvedState !== "unavailable";
  const label = isLoading
    ? loadingLabel
    : !available
      ? emptyLabel
      : (stateLabel ?? (resolvedState === "fresh" ? "Fresh" : "Stale"));
  const timestamp =
    available && observedAt !== undefined && isValidTimestamp(observedAt)
      ? observedAt
      : undefined;
  const timestampText =
    timestamp === undefined
      ? undefined
      : formatObservedAt
        ? formatObservedAt(timestamp)
        : timestamp instanceof Date
          ? timestamp.toISOString()
          : timestamp;
  return (
    <span
      className={styles.root}
      role="group"
      aria-label={accessibilityLabel}
      aria-busy={isLoading}
      data-size={size}
      data-state={isLoading ? "loading" : resolvedState}
    >
      {timestampText !== undefined && (
        <Text as="span" variant="caption" color="subdued" breakWord>
          {observedAtLabel && <>{observedAtLabel} </>}
          <time
            dateTime={
              timestamp instanceof Date ? timestamp.toISOString() : timestamp
            }
          >
            {timestampText}
          </time>
        </Text>
      )}
      {available ? (
        <span className={styles.state}>
          <StatusDot
            tone={resolvedState === "fresh" ? "success" : "warning"}
            label={label}
            size="sm"
          />
          {(resolvedState === "stale" || showStateLabel) && (
            <Text as="span" variant="caption">
              {label}
            </Text>
          )}
        </span>
      ) : (
        <span role={isLoading ? "status" : undefined}>
          <Text as="span" variant="caption">
            {label}
          </Text>
        </span>
      )}
    </span>
  );
}
