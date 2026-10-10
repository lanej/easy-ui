import React, { useRef, useState } from "react";
import { EventItem, type EventTimelineEvent } from "./EventItem";
import styles from "./EventTimeline.module.scss";

export type EventTimelineProps = {
  /** Caller-ordered observations; never sorted or deduplicated internally. */
  events: readonly EventTimelineEvent[];
  /** Controlled event selection, including selection driven by another view. */
  selectedId?: string | null;
  /** Emphasize observations belonging to an externally selected context without filtering. */
  relatedIds?: readonly string[];
  defaultSelectedId?: string | null;
  onSelectedIdChange?: (id: string) => void;
  /** Optional map coordination. This does not navigate or zoom a map itself. */
  onLocationSelect?: (locationId: string, eventId: string) => void;
  /** Optional right-side summary, separate from the selected event button. */
  renderTrailing?: (event: EventTimelineEvent) => React.ReactNode;
  /** Independent metric outcomes on every event, including the final event. */
  renderMetrics?: (event: EventTimelineEvent) => React.ReactNode;
  /** Flow metrics with event identity, or place them beneath it. */
  metricsPlacement?: "inline" | "below";
  /** Content associated with the interval following an event. */
  renderInterval?: (
    event: EventTimelineEvent,
    following: EventTimelineEvent | undefined,
  ) => React.ReactNode;
  /** Rich context outside the event's selection button. */
  renderDetails?: (event: EventTimelineEvent) => React.ReactNode;
  emptyLabel?: string;
  ariaLabel?: string;
  size?: "compact" | "default" | "detailed";
};

/** Evidence-oriented chronology, with controlled selection and explicit caller ordering. */
export function EventTimeline({
  events,
  selectedId,
  relatedIds,
  defaultSelectedId = null,
  onSelectedIdChange,
  onLocationSelect,
  renderInterval,
  renderDetails,
  renderTrailing,
  renderMetrics,
  metricsPlacement = "below",
  emptyLabel = "No observations",
  ariaLabel = "Event timeline",
  size = "default",
}: EventTimelineProps) {
  const [internalId, setInternalId] = useState<string | null>(
    defaultSelectedId,
  );
  const activeId = selectedId === undefined ? internalId : selectedId;
  const related = relatedIds && new Set(relatedIds);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const choose = (event: EventTimelineEvent) => {
    if (selectedId === undefined) setInternalId(event.id);
    onSelectedIdChange?.(event.id);
  };
  const navigate = (event: EventTimelineEvent, key: string) => {
    const index = events.findIndex((candidate) => candidate.id === event.id);
    const next =
      key === "ArrowDown"
        ? index + 1
        : key === "ArrowUp"
          ? index - 1
          : key === "Home"
            ? 0
            : events.length - 1;
    if (next < 0 || next >= events.length) return false;
    const target = events[next];
    choose(target);
    buttons.current.get(target.id)?.focus();
    return true;
  };
  if (!events.length) return <div className={styles.empty}>{emptyLabel}</div>;
  return (
    <ol className={styles.timeline} aria-label={ariaLabel} data-size={size}>
      {events.map((event, index) => {
        const details = renderDetails?.(event);
        const metrics = renderMetrics?.(event);
        return (
          <li
            className={styles.entry}
            key={event.id}
            data-related={related?.has(event.id) || undefined}
            aria-description={
              related?.has(event.id) ? "In selected context" : undefined
            }
          >
            <EventItem
              event={event}
              size={size}
              trailing={renderTrailing?.(event)}
              inline={metricsPlacement === "inline"}
              inlineMetrics={
                metricsPlacement === "inline" ? metrics : undefined
              }
              current={event.id === activeId}
              registerButton={(node) => {
                if (node) buttons.current.set(event.id, node);
                else buttons.current.delete(event.id);
              }}
              onSelect={() => choose(event)}
              onKeyDown={(key) => navigate(event, key)}
            />
            {metricsPlacement === "below" && metrics != null && (
              <div className={styles.metrics}>{metrics}</div>
            )}
            {event.locationId && onLocationSelect && (
              <button
                className={styles.mapLink}
                type="button"
                onClick={() => onLocationSelect(event.locationId!, event.id)}
              >
                Show location
              </button>
            )}
            {details != null && <div className={styles.details}>{details}</div>}
            {renderInterval && index < events.length - 1 && (
              <div className={styles.interval}>
                {renderInterval(event, events[index + 1])}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
