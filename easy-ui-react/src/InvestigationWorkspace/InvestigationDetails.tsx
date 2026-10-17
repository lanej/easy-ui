import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ArrowBackIcon from "@easypost/easy-ui-icons/ArrowBack";
import ArrowForwardIcon from "@easypost/easy-ui-icons/ArrowForward";
import CloseIcon from "@easypost/easy-ui-icons/Close";
import { Button } from "../Button";
import { IconButton } from "../IconButton";
import { Text } from "../Text";
import { EventDetails } from "../EventDetails";
import type { InvestigationDetailsContext } from "./selection";
import styles from "./InvestigationWorkspace.module.scss";

export type InvestigationDetailsLabels = Record<
  | "details"
  | "clear"
  | "previous"
  | "next"
  | "empty"
  | "showDetails"
  | "hideDetails",
  string
>;

export type InvestigationDetailsProps = {
  context: InvestigationDetailsContext;
  /** Override automatic container-width detection when composed in a workspace. */
  isNarrow?: boolean;
  chooseEvent: (id: string) => void;
  clear: () => void;
  renderDetails?: (context: InvestigationDetailsContext) => ReactNode;
  labels?: Partial<InvestigationDetailsLabels>;
};

/** Persistent inspector, usable with EventTimeline without a map or workspace. */
export function InvestigationDetails({
  context,
  isNarrow: narrowOverride,
  chooseEvent,
  clear,
  renderDetails,
  labels,
}: InvestigationDetailsProps) {
  const text: InvestigationDetailsLabels = {
    details: "Selection details",
    clear: "Clear selection",
    previous: "Previous event",
    next: "Next event",
    empty: "Select an event, location, or candidate path.",
    showDetails: "Show details",
    hideDetails: "Hide details",
    ...labels,
  };
  const root = useRef<HTMLElement>(null);
  const restoreDisclosureFocus = useRef(false);
  const disclosureFocused = useRef(false);
  const [autoNarrow, setAutoNarrow] = useState(false);
  const isNarrow = narrowOverride ?? autoNarrow;
  useEffect(() => {
    const element = root.current;
    if (
      narrowOverride !== undefined ||
      !element ||
      typeof ResizeObserver === "undefined"
    )
      return;
    const update = () => {
      const width = element.getBoundingClientRect().width;
      if (width <= 0) return;
      const narrow = width <= 740;
      const active = document.activeElement;
      restoreDisclosureFocus.current =
        narrow &&
        active instanceof HTMLElement &&
        Boolean(
          element
            .querySelector("[data-investigation-details-body]")
            ?.contains(active),
        );
      setAutoNarrow(narrow);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [narrowOverride]);
  useLayoutEffect(() => {
    if (isNarrow) {
      const body = root.current?.querySelector<HTMLElement>(
        "[data-investigation-details-body]",
      );
      if (
        body?.hidden &&
        (restoreDisclosureFocus.current ||
          body.contains(document.activeElement))
      )
        root.current
          ?.querySelector<HTMLButtonElement>("button[aria-controls]")
          ?.focus({ preventScroll: true });
    }
    if (!isNarrow && disclosureFocused.current) {
      // The focused disclosure was removed during this commit. Keep the
      // keyboard user's position in the persistent inspector region.
      const active = document.activeElement;
      if (
        active === document.body ||
        active === document.documentElement ||
        active === root.current
      )
        root.current?.focus({ preventScroll: true });
      disclosureFocused.current = false;
    }
    restoreDisclosureFocus.current = false;
  }, [isNarrow]);
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
      text.details);
  const description =
    event?.description ?? path?.description ?? location?.detail;
  const extra = selection && isAvailable ? renderDetails?.(context) : null;
  const hasMore = Boolean(description || extra);
  return (
    <section
      ref={root}
      tabIndex={-1}
      data-narrow={isNarrow}
      className={styles.details}
      aria-label={text.details}
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
                accessibilityLabel={text.previous}
                isDisabled={index <= 0}
                onPress={() => chooseEvent(events[index - 1].id)}
              />
              <IconButton
                size="sm"
                variant="outlined"
                icon={ArrowForwardIcon}
                accessibilityLabel={text.next}
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
              accessibilityLabel={text.clear}
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
          {text.empty}
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
              <EventDetails event={event} locationLabel={location?.label} />
            )}
            {isNarrow && hasMore && (
              <Button
                size="sm"
                variant="text"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onFocus={() => {
                  disclosureFocused.current = true;
                }}
                onBlur={() => {
                  disclosureFocused.current = false;
                }}
                onPress={() => setExpanded(!expanded)}
              >
                {expanded ? text.hideDetails : text.showDetails}
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
            data-investigation-details-body
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
