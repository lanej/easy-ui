import React, { useMemo, useRef } from "react";
import type { EventTimelineEvent } from "../EventTimeline";
import { ConnectionGraph } from "../EventTimeline/ConnectionRail";
import { getConnectionGraphLayout } from "../EventTimeline/connectionGraph";
import type { InvestigationRecords } from "./selection";
import type { RouteHistoryAnnotation } from "./routeHistoryTypes";
import { dashedRoute, sameRouteMembership } from "./routeHistoryStyle";
import styles from "./RouteHistoryLedger.module.scss";

type Props = {
  records: Required<InvestigationRecords>;
  eventAnnotations?: Readonly<
    Record<string, RouteHistoryAnnotation | undefined>
  >;
  timeZoneLabel?: string;
  selectedEventId?: string;
  selectedLocationId?: string;
  focusedPathId?: string;
  inspectorId: string;
  inspectedLocationId?: string;
  onInspectEvent(id: string): void;
  onInspectLocation(id: string): void;
};

type Group = {
  dayLabel?: string;
  events: EventTimelineEvent[];
};

/** Share a heading only across consecutive records with the same known location and memberships. */
function groupEvents(
  events: readonly EventTimelineEvent[],
  annotations: Props["eventAnnotations"],
) {
  const groups: Group[] = [];
  for (const event of events) {
    const group = groups[groups.length - 1];
    const first = group?.events[0];
    const dayLabel = annotations?.[event.id]?.dayLabel;
    const paths = event.pathIds ?? [];
    if (
      first &&
      group.dayLabel === dayLabel &&
      event.locationId &&
      event.locationId === first.locationId &&
      sameRouteMembership(paths, first.pathIds)
    ) {
      group.events.push(event);
    } else {
      groups.push({ dayLabel, events: [event] });
    }
  }
  return groups;
}

type ScanRowProps = {
  event: EventTimelineEvent;
  annotation?: RouteHistoryAnnotation;
  selected: boolean;
  showStatus: boolean;
  onInspect(): void;
  color?: string;
  ariaLabel?: string;
  membershipLabel?: string;
  rowRef?: React.Ref<HTMLButtonElement>;
  ledger?: { related: boolean; muted: boolean; inspectorId: string };
};

/** The timeline and inspector refer to the same source record and expose the same annotations. */
export function RouteHistoryScanRow({
  event,
  annotation,
  selected,
  showStatus,
  onInspect,
  color,
  ariaLabel,
  membershipLabel,
  rowRef,
  ledger,
}: ScanRowProps) {
  const reference = annotation?.referenceLabel ?? event.id;
  return (
    <button
      className={styles.scan}
      type="button"
      data-route-event={ledger ? event.id : undefined}
      data-inspector-event={ledger ? undefined : event.id}
      data-related={ledger?.related || undefined}
      data-muted={ledger?.muted || undefined}
      aria-label={ariaLabel}
      aria-pressed={selected}
      aria-controls={ledger?.inspectorId}
      style={
        color ? ({ "--route-color": color } as React.CSSProperties) : undefined
      }
      ref={rowRef}
      onClick={onInspect}
    >
      <span className={styles.time}>{event.timeLabel ?? "—"}</span>
      <span>
        {event.label}
        {membershipLabel && (
          <span className={styles.annotation}>{membershipLabel}</span>
        )}
        {event.detailLabel && (
          <span className={styles.annotation}>{event.detailLabel}</span>
        )}
        {showStatus && event.statusLabel && (
          <span className={styles.annotation}>{event.statusLabel}</span>
        )}
      </span>
      <span className={styles.reference}>{reference}</span>
    </button>
  );
}

export function RouteHistoryLedger({
  records,
  eventAnnotations,
  timeZoneLabel,
  selectedEventId,
  selectedLocationId,
  focusedPathId,
  inspectorId,
  inspectedLocationId,
  onInspectEvent,
  onInspectLocation,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const groups = useMemo(
    () => groupEvents(records.events, eventAnnotations),
    [records.events, eventAnnotations],
  );
  const facilities = useMemo(
    () => new Map(records.locations.map((location) => [location.id, location])),
    [records.locations],
  );
  const pathColors = useMemo(
    () =>
      Object.fromEntries(
        records.paths.flatMap((path) =>
          path.color ? [[path.id, path.color]] : [],
        ),
      ),
    [records.paths],
  );
  const pathLabels = useMemo(
    () => new Map(records.paths.map((path) => [path.id, path.label])),
    [records.paths],
  );
  const dashedPathIds = useMemo(
    () =>
      new Set(
        records.paths.filter((_, i) => dashedRoute(i)).map((path) => path.id),
      ),
    [records.paths],
  );
  const graph = useMemo(
    () => getConnectionGraphLayout(records.events, records.connections),
    [records.events, records.connections],
  );
  return (
    <section className={styles.ledger} aria-label="Scan timeline">
      <header className={styles.header}>
        <h3>Scan timeline</h3>
        {timeZoneLabel && <span>{timeZoneLabel}</span>}
      </header>
      <div
        ref={root}
        className={styles.content}
        style={
          { "--route-gutter": `${graph.width + 6}px` } as React.CSSProperties
        }
      >
        {groups.length === 0 && <p className={styles.empty}>No scans</p>}
        <ol className={styles.groups}>
          {groups.map(({ dayLabel, events }, i) => {
            const first = events[0];
            const facility = first.locationId
              ? facilities.get(first.locationId)
              : undefined;
            const place =
              facility?.label ?? first.locationLabel ?? "Location unavailable";
            const status = events.every(
              (e) => e.statusLabel === first.statusLabel,
            )
              ? first.statusLabel
              : undefined;
            const paths = first.pathIds ?? [];
            const memberships = paths.map((id) => pathLabels.get(id) ?? id);
            return (
              <li key={first.id} className={styles.group}>
                {dayLabel && dayLabel !== groups[i - 1]?.dayLabel && (
                  <div className={styles.day}>{dayLabel}</div>
                )}
                <div
                  className={styles.place}
                  data-muted={
                    Boolean(focusedPathId && !paths.includes(focusedPathId)) ||
                    undefined
                  }
                >
                  {facility ? (
                    <button
                      type="button"
                      data-route-location={facility.id}
                      aria-label={`Inspect ${place}`}
                      aria-controls={inspectorId}
                      aria-expanded={inspectedLocationId === facility.id}
                      onClick={() => onInspectLocation(facility.id)}
                    >
                      {place}
                    </button>
                  ) : (
                    <strong>{place}</strong>
                  )}
                  {status && (
                    <span className={styles.annotation}>{status}</span>
                  )}
                </div>
                <ol className={styles.scans} aria-label={`Scans at ${place}`}>
                  {events.map((event) => {
                    const reference =
                      eventAnnotations?.[event.id]?.referenceLabel ?? event.id;
                    const selected = event.id === selectedEventId;
                    const related = Boolean(
                      selectedLocationId &&
                      event.locationId === selectedLocationId &&
                      !selectedEventId,
                    );
                    const color =
                      paths.length === 1 ? pathColors[paths[0]] : undefined;
                    const description = [
                      dayLabel,
                      event.timeLabel ?? "Time unknown",
                      timeZoneLabel,
                      place,
                      event.label,
                      event.detailLabel,
                      event.statusLabel,
                      reference,
                      ...memberships,
                    ]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <li key={event.id}>
                        <RouteHistoryScanRow
                          event={event}
                          annotation={eventAnnotations?.[event.id]}
                          selected={selected}
                          showStatus={!status}
                          color={color}
                          ariaLabel={description}
                          ledger={{
                            related,
                            muted: Boolean(
                              focusedPathId && !paths.includes(focusedPathId),
                            ),
                            inspectorId,
                          }}
                          rowRef={(node) => {
                            if (node) buttons.current.set(event.id, node);
                            else buttons.current.delete(event.id);
                          }}
                          onInspect={() => onInspectEvent(event.id)}
                        />
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>
        <ConnectionGraph
          events={records.events}
          connections={records.connections}
          pathColors={pathColors}
          routeAppearance={{ dashedPathIds, focusedPathId, selectedEventId }}
          rowElements={buttons.current}
          rootRef={root}
        />
      </div>
    </section>
  );
}
