import React, { useId, useState, type ReactNode } from "react";
import ArrowBackIcon from "@easypost/easy-ui-icons/ArrowBack";
import ArrowForwardIcon from "@easypost/easy-ui-icons/ArrowForward";
import CloseIcon from "@easypost/easy-ui-icons/Close";
import { Button } from "../Button";
import { IconButton } from "../IconButton";
import { Text } from "../Text";
import type { InvestigationDetailsContext } from "./selection";
import styles from "./InvestigationWorkspace.module.scss";

/** One persistent inspector; the timeline remains the only list of events. */
export function InvestigationDetails({
  context,
  isNarrow,
  chooseEvent,
  clear,
  renderDetails,
  labels,
}: {
  context: InvestigationDetailsContext;
  isNarrow: boolean;
  chooseEvent: (id: string) => void;
  clear: () => void;
  renderDetails?: (context: InvestigationDetailsContext) => ReactNode;
  labels: Record<
    | "details"
    | "clear"
    | "previous"
    | "next"
    | "empty"
    | "showDetails"
    | "hideDetails",
    string
  >;
}) {
  const bodyId = useId();
  const [expanded, setExpanded] = useState(false);
  const {
    selection,
    event,
    location,
    path,
    segment,
    isAvailable,
    events,
    paths,
  } = context;
  const index = events.findIndex((item) => item.id === event?.id);
  const scope =
    path?.label ??
    segment?.label ??
    (selection?.type === "location" ? location?.label : undefined);
  const position =
    index < 0
      ? `${events.length} events`
      : `Event ${index + 1} of ${events.length}`;
  const scopeLabel = event
    ? `${scope ?? "All events"} · ${position}`
    : `${path ? "Candidate path" : segment ? "Connection" : "Location"} · ${position}${segment ? " across candidate paths" : ""}`;
  const title = !isAvailable
    ? "Selection unavailable"
    : (event?.label ??
      location?.label ??
      path?.label ??
      segment?.label ??
      labels.details);
  const description =
    event?.description ?? path?.description ?? location?.detail;
  const extra = selection && isAvailable ? renderDetails?.(context) : null;
  const hasMore = Boolean(description || extra);
  return (
    <section
      className={styles.details}
      aria-label={labels.details}
      data-expanded={!isNarrow || expanded}
    >
      <div className={styles.detailHeader}>
        <div className={styles.identity}>
          {selection && isAvailable && (
            <p className={styles.scope}>{scopeLabel}</p>
          )}
          <Text as="h3" variant="heading5">
            {title}
          </Text>
        </div>
        <div className={styles.actions}>
          {selection && isAvailable && events.length > 0 && (
            <nav className={styles.stepping} aria-label="Event navigation">
              <IconButton
                size="sm"
                variant="outlined"
                icon={ArrowBackIcon}
                accessibilityLabel={labels.previous}
                isDisabled={index <= 0}
                onPress={() => chooseEvent(events[index - 1].id)}
              />
              <IconButton
                size="sm"
                variant="outlined"
                icon={ArrowForwardIcon}
                accessibilityLabel={labels.next}
                isDisabled={index === events.length - 1}
                onPress={() => chooseEvent(events[index + 1].id)}
              />
            </nav>
          )}
          {selection && (
            <IconButton
              size="sm"
              variant="outlined"
              icon={CloseIcon}
              accessibilityLabel={labels.clear}
              onPress={clear}
            />
          )}
        </div>
      </div>
      <span className={styles.announcement} role="status">
        {selection
          ? `${title}${event ? ` · ${event.timeLabel ?? "Time unknown"} · ${event.receivedTimeLabel ? `Received ${event.receivedTimeLabel} · ` : ""}${position}` : ""}`
          : "Selection cleared"}
      </span>
      {!selection ? (
        <Text as="p" color="subdued">
          {labels.empty}
        </Text>
      ) : !isAvailable ? (
        <Text as="p" color="subdued">
          The selected record is no longer in this view.
        </Text>
      ) : (
        <>
          {selection.eventId !== undefined && !event && (
            <Text as="p" variant="body2" color="subdued">
              The selected event is not available in this context.
            </Text>
          )}
          <div className={styles.metadata}>
            {event && (
              <dl className={styles.facts}>
                <div>
                  <dt>Event</dt>
                  <dd>{event.timeLabel ?? "Unknown"}</dd>
                </div>
                {event.receivedTimeLabel && (
                  <div>
                    <dt>Received</dt>
                    <dd>{event.receivedTimeLabel}</dd>
                  </div>
                )}
                <div>
                  <dt>Location</dt>
                  <dd>
                    {event.locationLabel ?? location?.label ?? "Not supplied"}
                  </dd>
                </div>
              </dl>
            )}
            {isNarrow && hasMore && (
              <Button
                size="sm"
                variant="text"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onPress={() => setExpanded(!expanded)}
              >
                {expanded ? labels.hideDetails : labels.showDetails}
              </Button>
            )}
          </div>
          {segment && (
            <p className={styles.relationship}>
              {paths.length > 1
                ? `Shared by ${paths.length} candidate paths`
                : paths.length === 1
                  ? "Part of 1 candidate path"
                  : "No candidate membership supplied"}{" "}
              · {segment.evidence}
            </p>
          )}

          <div
            id={bodyId}
            className={styles.detailBody}
            hidden={isNarrow && !expanded}
          >
            {description && (
              <Text as="p" variant="body2" color="subdued">
                {description}
              </Text>
            )}
            {extra && <div className={styles.content}>{extra}</div>}
          </div>
        </>
      )}
    </section>
  );
}
