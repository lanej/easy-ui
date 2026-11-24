import React, {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  normalizeInvestigationGraph,
  type InvestigationGraph,
} from "./workbenchModel";
import { resolveSelection } from "./selection";
import { RouteHistoryLedger } from "./RouteHistoryLedger";
import { RouteHistoryLocationDetails } from "./RouteHistoryLocationDetails";
import {
  RouteHistoryMap,
  type RouteHistoryMapOptions,
} from "./RouteHistoryMap";
import type {
  RouteHistoryAnnotation,
  RouteHistorySelection,
} from "./routeHistoryTypes";
import styles from "./RouteHistory.module.scss";

export type RouteHistoryProps = {
  graph: InvestigationGraph;
  map: RouteHistoryMapOptions;
  title?: string;
  summary?: ReactNode;
  actions?: ReactNode;
  /** Events and times stay in supplied order and use the caller's time zone. */
  timeZoneLabel?: string;
  eventAnnotations?: Readonly<
    Record<string, RouteHistoryAnnotation | undefined>
  >;
  selection?: RouteHistorySelection;
  defaultSelection?: RouteHistorySelection;
  onSelectionChange?: (selection: RouteHistorySelection) => void;
};

function sameSelection(
  left: RouteHistorySelection,
  right: RouteHistorySelection,
): boolean {
  if (!left || !right) return left === right;
  return (
    left.type === right.type &&
    left.eventId === right.eventId &&
    (left.type !== "location" ||
      (right.type === "location" && left.locationId === right.locationId))
  );
}

/** Compare candidate histories geographically and inspect all observations at a selected place. */
export function RouteHistory({
  graph,
  map,
  title = "Route history",
  summary,
  actions,
  timeZoneLabel,
  eventAnnotations,
  selection: controlledSelection,
  defaultSelection = null,
  onSelectionChange,
}: RouteHistoryProps) {
  const root = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const inspectorId = useId();
  const revealRequest = useRef<RouteHistorySelection>(null);
  const [internalSelection, setInternalSelection] = useState(defaultSelection);
  const [dismissed, setDismissed] = useState<RouteHistorySelection>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const { records, issues } = useMemo(
    () => normalizeInvestigationGraph(graph),
    [graph],
  );
  const selection =
    controlledSelection === undefined ? internalSelection : controlledSelection;
  const context = useMemo(
    () => resolveSelection(records, selection),
    [records, selection],
  );
  const { event, location } = context;
  const focusedPathId = records.paths.some((path) => path.id === focused)
    ? focused
    : null;
  const visibleInspector =
    selection !== null &&
    !sameSelection(selection, dismissed) &&
    context.isAvailable;
  // Location scope offers every visit, even when the active event came from the timeline.
  const detailContext = useMemo(() => {
    if (!location || selection?.type === "location") return context;
    return resolveSelection(records, {
      type: "location",
      locationId: location.id,
      eventId: event?.id,
    });
  }, [records, context, location, event?.id, selection?.type]);

  // Keep a dismissal attached to the accepted record; a deferred controlled
  // request must not reopen the old record while its replacement is pending.
  useLayoutEffect(() => {
    if (dismissed && !sameSelection(dismissed, selection)) setDismissed(null);
  }, [dismissed, selection]);

  // At narrow widths the inspector sits above the timeline. Reveal it only
  // for an explicit inspection, after a controlled caller accepts the selection.
  useLayoutEffect(() => {
    if (
      !root.current ||
      !visibleInspector ||
      !revealRequest.current ||
      !sameSelection(revealRequest.current, selection)
    )
      return;
    revealRequest.current = null;
    if (root.current.getBoundingClientRect().width > 665) return;
    const panel = root.current.ownerDocument.getElementById(inspectorId);
    const bounds = panel?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight))
      panel?.scrollIntoView?.({ block: "nearest" });
  });

  function belongsToPath(next: RouteHistorySelection, pathId: string) {
    const scope = resolveSelection(records, next);
    return scope.event
      ? scope.event.pathIds?.includes(pathId)
      : scope.paths.some((path) => path.id === pathId);
  }

  function changeSelection(next: RouteHistorySelection) {
    if (controlledSelection === undefined) setInternalSelection(next);
    onSelectionChange?.(next);
  }

  function focusPath(id: string) {
    if (id === focusedPathId) {
      setFocused(null);
      return;
    }
    if (selection && !belongsToPath(selection, id)) changeSelection(null);
    setFocused(id);
  }

  function inspect(next: NonNullable<RouteHistorySelection>) {
    const source = root.current?.ownerDocument.activeElement;
    if (
      source instanceof HTMLElement &&
      root.current?.contains(source) &&
      !root.current.ownerDocument.getElementById(inspectorId)?.contains(source)
    ) {
      opener.current = source;
      revealRequest.current = next;
    }
    if (focusedPathId && !belongsToPath(next, focusedPathId)) setFocused(null);
    if (sameSelection(dismissed, next)) setDismissed(null);
    changeSelection(next);
  }

  function inspectEvent(eventId: string) {
    inspect({ type: "event", eventId });
  }

  function inspectLocation(locationId: string) {
    inspect({ type: "location", locationId });
  }

  function inspectLocalEvent(eventId: string) {
    if (location)
      inspect({ type: "location", locationId: location.id, eventId });
    else inspectEvent(eventId);
  }

  function closeDetails() {
    revealRequest.current = null;
    setDismissed(selection);
    if (opener.current?.isConnected && root.current?.contains(opener.current)) {
      opener.current.focus({ preventScroll: true });
      return;
    }
    // The original marker can be replaced when the map style or dataset changes.
    const fallback = Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        "[data-route-event], [data-route-location]",
      ) ?? [],
    ).find(
      (item) =>
        (event && item.dataset.routeEvent === event.id) ||
        (location && item.dataset.routeLocation === location.id),
    );
    fallback?.focus({ preventScroll: true });
  }

  if (issues.length) {
    return (
      <section className={styles.root} aria-label={title}>
        <div role="alert" className={styles.error}>
          <h2>Route data needs attention</h2>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={root}
      aria-label={title}
      className={styles.root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented && visibleInspector) {
          e.preventDefault();
          closeDetails();
        }
      }}
    >
      <header className={styles.header}>
        <div>
          <h2>{title}</h2>
          {summary && <div className={styles.meta}>{summary}</div>}
        </div>
        {actions}
      </header>
      <div className={styles.body}>
        <div className={styles.timeline}>
          <RouteHistoryLedger
            records={records}
            eventAnnotations={eventAnnotations}
            timeZoneLabel={timeZoneLabel}
            selectedEventId={event?.id}
            selectedLocationId={event ? undefined : location?.id}
            focusedPathId={focusedPathId ?? undefined}
            inspectorId={inspectorId}
            inspectedLocationId={visibleInspector ? location?.id : undefined}
            onInspectEvent={inspectEvent}
            onInspectLocation={inspectLocation}
          />
        </div>
        <div className={styles.analysis}>
          <RouteHistoryMap
            records={records}
            map={map}
            focusedPathId={focusedPathId}
            selectedLocationId={location?.id}
            selectedAnnotation={[event?.statusLabel, event?.detailLabel]
              .filter(Boolean)
              .join(" · ")}
            onInspectLocation={inspectLocation}
            onFocusPath={focusPath}
          />
          <div id={inspectorId} hidden={!visibleInspector}>
            {visibleInspector && (
              <RouteHistoryLocationDetails
                context={detailContext}
                annotations={eventAnnotations}
                timeZoneLabel={timeZoneLabel}
                onClose={closeDetails}
                onInspectEvent={inspectLocalEvent}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
