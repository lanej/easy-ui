import React, { Fragment } from "react";
import CloseIcon from "@easypost/easy-ui-icons/Close";
import { IconButton } from "../IconButton";
import type { InvestigationDetailsContext } from "./selection";
import type { RouteHistoryAnnotation } from "./routeHistoryTypes";
import { RouteHistoryScanRow } from "./RouteHistoryLedger";
import { sameRouteMembership } from "./routeHistoryStyle";
import styles from "./RouteHistory.module.scss";

type Props = {
  context: InvestigationDetailsContext;
  annotations?: Readonly<Record<string, RouteHistoryAnnotation | undefined>>;
  timeZoneLabel?: string;
  onInspectEvent: (id: string) => void;
  onClose: () => void;
};

export function RouteHistoryLocationDetails({
  context,
  annotations,
  timeZoneLabel,
  onInspectEvent,
  onClose,
}: Props) {
  const { location, event, paths } = context;
  // Unlocated observations have their own evidence. A missing location ID is not a shared place.
  const events = location ? context.events : event ? [event] : [];
  const sharedStatus = events[0]?.statusLabel;
  const sameStatus = Boolean(
    sharedStatus && events.every((item) => item.statusLabel === sharedStatus),
  );
  const count = events.reduce(
    (sum, item) => sum + (annotations?.[item.id]?.scanCount ?? 1),
    0,
  );

  const membership = (ids?: readonly string[]) =>
    paths
      .filter((path) => ids?.includes(path.id))
      .map((path) => path.label)
      .join(" + ") || "Supporting evidence";
  const sharedMembership = events.every((item) =>
    sameRouteMembership(item.pathIds, events[0]?.pathIds),
  );
  const scope =
    sharedMembership && events.length
      ? membership(events[0].pathIds)
      : undefined;
  const heading =
    location?.label ?? event?.locationLabel ?? "Observation details";

  return (
    <section
      className={styles.inspector}
      aria-label={location ? "Location details" : "Observation details"}
    >
      <header className={styles.inspectorHeader}>
        <div>
          {location && <p className={styles.eyebrow}>Location details</p>}
          <h3>
            {heading}
            {sameStatus && (
              <span className={styles.status}>{sharedStatus}</span>
            )}
          </h3>
          <p className={styles.meta}>
            {[
              scope,
              count === 1 ? "1 scan" : count + " scans",
              location?.detail,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <IconButton
          size="sm"
          color="secondary"
          variant="outlined"
          icon={CloseIcon}
          accessibilityLabel="Close details"
          onPress={onClose}
        />
      </header>
      {events.length > 0 && (
        <div className={styles.localEvents}>
          {events.map((item, index) => {
            const annotation = annotations?.[item.id];
            const day = annotation?.dayLabel;
            const startsDay =
              index === 0 ||
              day !== annotations?.[events[index - 1].id]?.dayLabel;
            return (
              <Fragment key={item.id}>
                {startsDay && (day || timeZoneLabel) && (
                  <div className={styles.day}>
                    <span>{day}</span>
                    <span>{timeZoneLabel}</span>
                  </div>
                )}
                <RouteHistoryScanRow
                  event={item}
                  annotation={annotation}
                  selected={event?.id === item.id}
                  color={
                    paths.find((path) => item.pathIds?.includes(path.id))?.color
                  }
                  membershipLabel={
                    sharedMembership ? undefined : membership(item.pathIds)
                  }
                  showStatus={!sameStatus}
                  onInspect={() => onInspectEvent(item.id)}
                />
              </Fragment>
            );
          })}
        </div>
      )}
      {event?.description && (
        <p className={styles.extra}>{event.description}</p>
      )}
      {event?.receivedTimeLabel && (
        <p className={styles.meta}>Received {event.receivedTimeLabel}</p>
      )}
    </section>
  );
}
