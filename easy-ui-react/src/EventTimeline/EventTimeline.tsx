import React, { useMemo, useRef, useState } from "react";
import { EventItem, type EventTimelineEvent } from "./EventItem";
import { ConnectionGraph } from "./ConnectionGraph";
import {
  getConnectionGraphLayout,
  type EventTimelineConnection,
} from "./connectionGraph";
import styles from "./EventTimeline.module.scss";

export type EventTimelineConnectionContext = {
  connection: EventTimelineConnection;
  fromEvent: EventTimelineEvent;
  toEvent: EventTimelineEvent;
};

export type EventTimelineProps = {
  /** Caller-ordered observations; never sorted or deduplicated internally. */
  events: readonly EventTimelineEvent[];
  /** Controlled event selection, including selection driven by another view. */
  selectedId?: string | null;
  /** Emphasize observations belonging to an externally selected context without filtering. */
  relatedIds?: readonly string[];
  defaultSelectedId?: string | null;
  onSelectedIdChange?: (
    id: string,
    modifiers?: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => void;
  /** Highlight a selected set without implying relationships between its members. */
  selectedIds?: readonly string[];
  /** Row buttons act as selection toggles, including on touch devices. */
  multiSelectable?: boolean;
  /** Optional map coordination. This does not navigate or zoom a map itself. */
  onLocationSelect?: (locationId: string, eventId: string) => void;
  /** Optional right-side summary, separate from the selected event button. */
  renderTrailing?: (event: EventTimelineEvent) => React.ReactNode;
  /** Independent metric outcomes on every event, including the final event. */
  renderMetrics?: (event: EventTimelineEvent) => React.ReactNode;
  /** Flow metrics with event identity, or place them beneath it. */
  metricsPlacement?: "inline" | "below";
  /** Compact incoming-connection evidence. Never uses chronological adjacency. */
  renderConnectionMetrics?: (
    context: EventTimelineConnectionContext,
  ) => React.ReactNode;
  /** Side-by-side timestamp, event and evidence when the ledger has enough width. */
  ledgerColumns?: boolean;
  /** Content associated with the interval following an event; not used with explicit connections. */
  renderInterval?: (
    event: EventTimelineEvent,
    following: EventTimelineEvent | undefined,
  ) => React.ReactNode;
  /** Rich context outside the event's selection button. */
  renderDetails?: (event: EventTimelineEvent) => React.ReactNode;
  emptyLabel?: string;
  ariaLabel?: string;
  size?: "compact" | "default" | "detailed";
  /** Compact event type, location, and occurrence rows; optional supplied graph connections. */
  variant?: "timeline" | "ledger";
  /** Explicit candidate relationships. Supplying [] also suppresses the ordinary connector. */
  connections?: readonly EventTimelineConnection[];
  /** Emphasize supplied relationships without deriving them from timestamp adjacency. */
  selectedConnectionIds?: readonly string[];
  /** Stable CSS colors keyed by explicit event/connection pathIds; selection retains them. */
  pathColors?: Readonly<Record<string, string>>;
};

/** Evidence-oriented chronology, with controlled selection and explicit caller ordering. */
export function EventTimeline({
  events,
  selectedId,
  relatedIds,
  defaultSelectedId = null,
  onSelectedIdChange,
  selectedIds,
  multiSelectable = false,
  onLocationSelect,
  renderInterval,
  renderConnectionMetrics,
  ledgerColumns = false,
  renderDetails,
  renderTrailing,
  renderMetrics,
  metricsPlacement = "below",
  emptyLabel = "No observations",
  ariaLabel = "Event timeline",
  size = "default",
  variant = "timeline",
  connections,
  selectedConnectionIds,
  pathColors,
}: EventTimelineProps) {
  const [internalId, setInternalId] = useState<string | null>(
    defaultSelectedId,
  );
  const activeId = selectedId === undefined ? internalId : selectedId;
  const related = relatedIds && new Set(relatedIds);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const graphRoot = useRef<HTMLDivElement>(null);
  const graph = useMemo(
    () =>
      connections === undefined
        ? undefined
        : getConnectionGraphLayout(events, connections),
    [events, connections],
  );
  const incoming = useMemo(() => {
    const byId = new Map(events.map((event) => [event.id, event]));
    const result = new Map<string, EventTimelineConnectionContext[]>();
    for (const connection of connections ?? []) {
      const fromEvent = byId.get(connection.fromEventId);
      const toEvent = byId.get(connection.toEventId);
      if (!fromEvent || !toEvent) continue;
      const contexts = result.get(toEvent.id) ?? [];
      contexts.push({ connection, fromEvent, toEvent });
      result.set(toEvent.id, contexts);
    }
    return result;
  }, [events, connections]);
  const choose = (
    event: EventTimelineEvent,
    modifiers?: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => {
    if (selectedId === undefined) setInternalId(event.id);
    onSelectedIdChange?.(event.id, modifiers);
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
  const timeline = events.length ? (
    <ol
      className={styles.timeline}
      aria-label={ariaLabel}
      data-size={size}
      data-variant={variant}
      data-ledger-columns={ledgerColumns || undefined}
      data-connected={connections !== undefined || undefined}
    >
      {events.map((event, index) => {
        const details = renderDetails?.(event);
        const eventMetrics = renderMetrics?.(event);
        const connectionMetrics = (incoming.get(event.id) ?? []).flatMap(
          (context) => {
            const rendered = renderConnectionMetrics?.(context);
            return rendered == null || rendered === false
              ? []
              : [
                  <React.Fragment key={context.connection.id}>
                    {rendered}
                  </React.Fragment>,
                ];
          },
        );
        const metrics = connectionMetrics.length ? (
          <>
            {eventMetrics}
            {connectionMetrics}
          </>
        ) : (
          eventMetrics
        );
        return (
          <li
            className={styles.entry}
            key={event.id}
            data-related={related?.has(event.id) || undefined}
            data-marked={selectedIds?.includes(event.id) || undefined}
            aria-description={
              related?.has(event.id) ? "In selected context" : undefined
            }
          >
            <EventItem
              event={event}
              size={size}
              variant={variant}
              trailing={renderTrailing?.(event)}
              inline={metricsPlacement === "inline"}
              inlineMetrics={
                metricsPlacement === "inline" ? metrics : undefined
              }
              current={event.id === activeId}
              marked={selectedIds?.includes(event.id)}
              multiSelectable={multiSelectable}
              registerButton={(node) => {
                if (node) buttons.current.set(event.id, node);
                else buttons.current.delete(event.id);
              }}
              onSelect={(modifiers) => choose(event, modifiers)}
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
            {connections === undefined &&
              renderInterval &&
              index < events.length - 1 && (
                <div className={styles.interval}>
                  {renderInterval(event, events[index + 1])}
                </div>
              )}
          </li>
        );
      })}
    </ol>
  ) : (
    <div className={styles.empty}>{emptyLabel}</div>
  );
  if (connections === undefined || !graph) return timeline;
  return (
    <div
      ref={graphRoot}
      className={styles.graphTimeline}
      style={
        { "--connection-gutter": `${graph.width}px` } as React.CSSProperties
      }
    >
      {timeline}
      <ConnectionGraph
        events={events}
        connections={connections}
        selectedConnectionIds={selectedConnectionIds}
        pathColors={pathColors}
        rowElements={buttons.current}
        rootRef={graphRoot}
      />
    </div>
  );
}
