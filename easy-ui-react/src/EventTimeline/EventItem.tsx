import React from "react";
import { useId } from "@react-aria/utils";
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
  /** Decorative facility category icon; locationTypeLabel supplies its meaning. */
  locationIcon?: React.ReactNode;
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
  /** Metrics in the event's content flow, outside its selection button. */
  inlineMetrics?: React.ReactNode;
  /** Keep event identity in the same wrapping flow, including events without metrics. */
  inline?: boolean;
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
  inlineMetrics,
  inline = inlineMetrics != null,
}: EventItemProps) {
  const id = useId();
  const hasLocation = Boolean(event.locationLabel || event.locationTypeLabel);
  const showDetail = size !== "compact" && Boolean(event.detailLabel);
  const showReceived = size === "detailed" && Boolean(event.receivedTimeLabel);
  const showDescription = size === "detailed" && Boolean(event.description);
  const time = (
    <span id={`${id}-time`} className={styles.time}>
      {event.timeLabel ?? "Time unknown"}
    </span>
  );
  const dot = (
    <span id={`${id}-status`} className={styles.dot}>
      <StatusDot
        label={event.statusLabel ?? event.label}
        tone={event.tone}
        current={current}
      />
    </span>
  );
  const title = (
    <span id={`${id}-title`} className={styles.title}>
      {event.label}
    </span>
  );
  const location = hasLocation && (
    <span id={`${id}-location`} className={styles.location}>
      {event.locationIcon && (
        <span className={styles.locationIcon} aria-hidden="true">
          {event.locationIcon}
        </span>
      )}
      <span>
        {size === "compact" && !inline
          ? event.locationLabel || event.locationTypeLabel
          : [event.locationTypeLabel, event.locationLabel]
              .filter(Boolean)
              .join(" · ")}
      </span>
    </span>
  );
  const context = (
    <>
      {showDetail && (
        <span id={`${id}-detail`} className={styles.received}>
          {event.detailLabel}
        </span>
      )}
      {showReceived && (
        <span id={`${id}-received`} className={styles.received}>
          Received: {event.receivedTimeLabel}
        </span>
      )}
      {showDescription && (
        <span id={`${id}-description`} className={styles.received}>
          {event.description}
        </span>
      )}
    </>
  );
  const selection = (
    <button
      ref={registerButton}
      type="button"
      className={styles.select}
      aria-current={current ? "true" : undefined}
      aria-labelledby={
        inline
          ? [
              `${id}-time`,
              event.statusLabel && `${id}-status`,
              `${id}-title`,
              hasLocation && `${id}-location`,
              showDetail && `${id}-detail`,
              showReceived && `${id}-received`,
              showDescription && `${id}-description`,
            ]
              .filter(Boolean)
              .join(" ")
          : undefined
      }
      aria-description={
        size === "compact"
          ? [!inline && event.locationTypeLabel, event.detailLabel]
              .filter(Boolean)
              .join(". ") || undefined
          : undefined
      }
      onClick={onSelect}
      onKeyDown={(e) => {
        if (
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) &&
          onKeyDown?.(e.key)
        )
          e.preventDefault();
      }}
    >
      {inline ? (
        title
      ) : (
        <>
          {time}
          {dot}
          <span className={styles.content}>
            {title}
            {location}
            {context}
          </span>
        </>
      )}
    </button>
  );
  return (
    <div
      className={styles.item}
      data-size={size}
      data-current={current || undefined}
      data-has-trailing={trailing != null || undefined}
      data-metrics-placement={inline ? "inline" : undefined}
    >
      {inline ? (
        <>
          {time}
          {dot}
          <div className={styles.content} data-event-content>
            <div className={styles.headline} data-event-headline>
              {selection} {hasLocation && <>{location} </>}
              <div className={styles.inlineMetrics} data-inline-metrics>
                {inlineMetrics}
              </div>
            </div>
            {context}
          </div>
        </>
      ) : (
        selection
      )}
      {trailing != null && <div className={styles.trailing}>{trailing}</div>}
    </div>
  );
}
