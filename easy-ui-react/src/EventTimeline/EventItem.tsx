import React from "react";
import { StatusDot, type StatusDotTone } from "../StatusDot";
import styles from "./EventTimeline.module.scss";

/** IDs refer to observations, not inferred physical journeys. */
export type EventTimelineEvent = {
  id: string;
  label: string;
  /** Occurrence time, formatted by the caller. */
  timeLabel?: string;
  /** Receipt time is distinct from occurrence time. */
  receivedTimeLabel?: string;
  locationLabel?: string;
  locationTypeLabel?: string;
  locationId?: string;
  pathIds?: readonly string[];
  tone?: StatusDotTone;
  statusLabel?: string;
  description?: string;
  /** Short caller-supplied distinction, such as source or receipt time. */
  detailLabel?: string;
};

export type EventItemProps = {
  event: EventTimelineEvent;
  current?: boolean;
  size?: "compact" | "default" | "detailed";
  onSelect?: () => void;
  onKeyDown?: (key: string) => boolean;
  registerButton?: (node: HTMLButtonElement | null) => void;
  /** Caller-owned summary outside the selection button; never a nested button. */
  trailing?: React.ReactNode;
};

/** Reusable event row; timing, locations, and status have no domain dictionary. */
export function EventItem({
  event,
  current = false,
  size = "default",
  onSelect,
  onKeyDown,
  registerButton,
  trailing,
}: EventItemProps) {
  return (
    <div
      className={styles.item}
      data-size={size}
      data-current={current || undefined}
    >
      <button
        ref={registerButton}
        type="button"
        className={styles.select}
        aria-current={current ? "true" : undefined}
        aria-description={size === "compact" ? event.detailLabel : undefined}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (
            ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) &&
            onKeyDown?.(e.key)
          )
            e.preventDefault();
        }}
      >
        <span className={styles.time}>{event.timeLabel ?? "Time unknown"}</span>
        <span className={styles.dot}>
          <StatusDot
            label={event.statusLabel ?? event.label}
            tone={event.tone}
            current={current}
          />
        </span>
        <span className={styles.content}>
          <span className={styles.title}>{event.label}</span>
          {size !== "compact" &&
            (event.locationLabel || event.locationTypeLabel) && (
              <span className={styles.location}>
                {[event.locationTypeLabel, event.locationLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          {size !== "compact" && event.detailLabel && (
            <span className={styles.received}>{event.detailLabel}</span>
          )}
          {size === "detailed" && event.receivedTimeLabel && (
            <span className={styles.received}>
              Received: {event.receivedTimeLabel}
            </span>
          )}
          {size === "detailed" && event.description && (
            <span className={styles.received}>{event.description}</span>
          )}
        </span>
      </button>
      {trailing != null && <div className={styles.trailing}>{trailing}</div>}
    </div>
  );
}
