import React from "react";
import type { EventTimelineEvent } from "../EventTimeline";
import styles from "./EventDetails.module.scss";

export type EventDetailsIdentifier = { label: string; value: string };
export type EventDetailsProps = {
  event: Pick<
    EventTimelineEvent,
    "id" | "timeLabel" | "receivedTimeLabel" | "locationLabel"
  >;
  /** Fallback location name from the caller's location records. */
  locationLabel?: string;
  /** Provenance supplied by the application, never inferred from the event. */
  sourceLabel?: string;
  identifiers?: readonly EventDetailsIdentifier[];
  showEventId?: boolean;
  layout?: "inline" | "stacked";
  labels?: Partial<
    Record<
      | "event"
      | "received"
      | "location"
      | "source"
      | "id"
      | "unknown"
      | "notSupplied",
      string
    >
  >;
};

/** Exact observation metadata; occurrence and receipt are always separate facts. */
export function EventDetails({
  event,
  locationLabel,
  sourceLabel,
  identifiers = [],
  showEventId = false,
  layout = "inline",
  labels,
}: EventDetailsProps) {
  const text = {
    event: "Event",
    received: "Received",
    location: "Location",
    source: "Source",
    id: "Event ID",
    unknown: "Unknown",
    notSupplied: "Not supplied",
    ...labels,
  };
  const facts: EventDetailsIdentifier[] = [
    { label: text.event, value: event.timeLabel || text.unknown },
    ...(event.receivedTimeLabel
      ? [{ label: text.received, value: event.receivedTimeLabel }]
      : []),
    {
      label: text.location,
      value: event.locationLabel || locationLabel || text.notSupplied,
    },
    ...(sourceLabel ? [{ label: text.source, value: sourceLabel }] : []),
    ...(showEventId ? [{ label: text.id, value: event.id }] : []),
    ...identifiers,
  ];
  return (
    <dl className={styles.facts} data-layout={layout}>
      {facts.map(({ label, value }, index) => (
        <div key={index}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
