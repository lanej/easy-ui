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
  /** Ledger makes location the headline and retains the event type and time beneath it. */
  variant?: "timeline" | "ledger";
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
  variant = "timeline",
  onSelect,
  onKeyDown,
  registerButton,
  trailing,
  inlineMetrics,
  inline = inlineMetrics != null,
}: EventItemProps) {
  const id = useId();
  const hasLocation = Boolean(event.locationLabel || event.locationTypeLabel);
  const showDetail =
    (size !== "compact" || variant === "ledger") && Boolean(event.detailLabel);
  const showReceived =
    (size === "detailed" || (variant === "ledger" && !event.timeLabel)) &&
    Boolean(event.receivedTimeLabel);
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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) &&
      onKeyDown?.(e.key)
    )
      e.preventDefault();
  };

  if (variant === "ledger") {
    const hasLocationLabel = Boolean(event.locationLabel);
    const showEventType =
      hasLocationLabel && event.label !== event.locationLabel;
    const metadata = [
      event.locationTypeLabel,
      event.statusLabel !== event.label ? event.statusLabel : undefined,
    ]
      .filter(Boolean)
      .join(". ");
    return (
      <div
        className={styles.item}
        data-variant="ledger"
        data-size={size}
        data-current={current || undefined}
      >
        <div className={styles.ledgerContent} data-event-content>
          <button
            ref={registerButton}
            type="button"
            className={styles.ledgerSelect}
            aria-current={current ? "true" : undefined}
            aria-labelledby={[
              `${id}-ledger-title`,
              showEventType && `${id}-ledger-type`,
              `${id}-time`,
              showDetail && `${id}-detail`,
              showReceived && `${id}-received`,
              showDescription && `${id}-description`,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-describedby={
              [
                metadata && `${id}-ledger-metadata`,
                trailing != null && `${id}-trailing`,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            onClick={onSelect}
            onKeyDown={handleKeyDown}
          >
            <span id={`${id}-ledger-title`} className={styles.ledgerTitle}>
              {event.locationIcon && (
                <span className={styles.locationIcon} aria-hidden="true">
                  {event.locationIcon}
                </span>
              )}
              <span>{event.locationLabel || event.label}</span>
            </span>
          </button>
          {showEventType && (
            <span id={`${id}-ledger-type`} className={styles.ledgerType}>
              {event.label}
            </span>
          )}
          {time}
          {context}
          {metadata && (
            <span
              id={`${id}-ledger-metadata`}
              className={styles.visuallyHidden}
            >
              {metadata}
            </span>
          )}
          {inlineMetrics != null && (
            <div className={styles.inlineMetrics} data-inline-metrics>
              {inlineMetrics}
            </div>
          )}
        </div>
        {trailing != null && (
          <div id={`${id}-trailing`} className={styles.ledgerTrailing}>
            {trailing}
          </div>
        )}
      </div>
    );
  }

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
      onKeyDown={handleKeyDown}
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
