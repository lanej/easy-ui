import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import {
  connectionGraphEdgePath,
  connectionGraphLaneX,
  getConnectionGraphLayout,
  type ConnectionGraphOmission,
  type EventTimelineConnection,
} from "./connectionGraph";
import styles from "./ConnectionGraph.module.scss";

type Observation = {
  id: string;
  label: string;
  locationLabel?: string;
  timeLabel?: string;
};

export type ConnectionGraphProps = {
  events: readonly Observation[];
  connections: readonly EventTimelineConnection[];
  selectedConnectionIds?: readonly string[];
  /** Native event buttons supply the headline centers, including wrapped rows. */
  rowElements: ReadonlyMap<string, HTMLElement>;
  /** Positioned ancestor shared by the event list and this decorative layer. */
  rootRef: RefObject<HTMLElement | null>;
};

type Geometry = { height: number; centers: ReadonlyMap<number, number> };

const omissionLabels: Record<ConnectionGraphOmission["reason"], string> = {
  "missing-endpoint": "Endpoint outside this view; no connection is drawn.",
  backward:
    "Points to an earlier row in the supplied order; shown in this list only.",
  self: "Links this event to itself; shown in this list only.",
  "lane-limit":
    "Shown in this list to keep overlapping relationships distinct.",
};

/**
 * A bounded, decorative relationship gutter. The adjacent native disclosure
 * preserves every directed relationship, including those that cannot be drawn.
 * It adds no event selection controls and never claims a physical travel route.
 */
export function ConnectionGraph({
  events,
  connections,
  selectedConnectionIds,
  rowElements,
  rootRef,
}: ConnectionGraphProps) {
  const layout = useMemo(
    () => getConnectionGraphLayout(events, connections),
    [events, connections],
  );
  const selected = new Set(selectedConnectionIds);
  const highlightedEvents = new Set(
    connections.flatMap((connection) =>
      selected.has(connection.id)
        ? [connection.fromEventId, connection.toEventId]
        : [],
    ),
  );
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root || layout.isFallback) {
      setGeometry(null);
      return;
    }
    const bounds = root.getBoundingClientRect();
    const centers = new Map<number, number>();
    if (bounds.width && bounds.height) {
      for (const [rowIndex, event] of events.entries()) {
        const element = rowElements.get(event.id);
        if (!element || !root.contains(element)) continue;
        const anchor = element.getBoundingClientRect();
        if (anchor.width && anchor.height) {
          centers.set(rowIndex, anchor.top + anchor.height / 2 - bounds.top);
        }
      }
    }
    const next = centers.size
      ? { height: Math.max(...centers.values()) + 8, centers }
      : null;
    setGeometry((previous) => {
      if (
        previous?.height === next?.height &&
        previous?.centers.size === next?.centers.size &&
        [...(next?.centers ?? [])].every(
          ([index, center]) => previous?.centers.get(index) === center,
        )
      ) {
        return previous;
      }
      return next;
    });
  }, [events, layout.isFallback, rootRef, rowElements]);

  // The ancestor's ref attaches after child layout effects on initial mount.
  // Refresh after every commit: a layout change can replace button elements
  // while the readonly event array and mutable ref map retain their identities.
  // Equal measurements retain state, so observer notifications settle normally.
  useEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root || layout.isFallback) return;
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(root);
    for (const event of events) {
      const element = rowElements.get(event.id);
      if (!element || !root.contains(element)) continue;
      observer?.observe(element);
      // Changes to metrics and disclosures can move a headline without
      // changing that button's own dimensions or the total list height.
      const row = element.closest("li");
      if (row && root.contains(row)) observer?.observe(row);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  });

  const omitted = new Map(
    layout.omitted.map(({ connection, reason }) => [connection.id, reason]),
  );
  const eventNames = new Map(
    events.map((event, index) => [
      event.id,
      `Event ${index + 1}: ${[event.label, event.locationLabel, event.timeLabel]
        .filter(Boolean)
        .join(" · ")}`,
    ]),
  );
  const eventName = (id: string) =>
    eventNames.get(id) ?? `Event ${id} (outside this view)`;

  return (
    <>
      {geometry && layout.width > 0 && (
        <svg
          className={styles.graph}
          aria-hidden="true"
          focusable="false"
          width={layout.width}
          height={geometry.height}
          viewBox={`0 0 ${layout.width} ${geometry.height}`}
          data-connection-graph
        >
          {layout.edges
            .slice()
            .sort(
              (a, b) =>
                Number(selected.has(a.connection.id)) -
                Number(selected.has(b.connection.id)),
            )
            .map((edge) => {
              const path = connectionGraphEdgePath(edge, geometry.centers);
              if (!path) return null;
              return (
                <g
                  key={edge.connection.id}
                  data-connection-id={edge.connection.id}
                  data-selected={selected.has(edge.connection.id) || undefined}
                  className={styles.edge}
                >
                  <path
                    className={styles.casing}
                    d={path}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    className={styles.rail}
                    d={path}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          {layout.nodes.map((node) => {
            const y = geometry.centers.get(node.rowIndex);
            if (y === undefined) return null;
            return (
              <circle
                key={node.eventId}
                className={styles.node}
                cx={connectionGraphLaneX(node.lane)}
                cy={y}
                r={node.incomingCount > 1 || node.outgoingCount > 1 ? 4 : 3.5}
                data-event-id={node.eventId}
                data-root={node.incomingCount === 0 || undefined}
                data-selected={highlightedEvents.has(node.eventId) || undefined}
              />
            );
          })}
        </svg>
      )}
      {connections.length > 0 && (
        <details
          className={styles.relationships}
          open={layout.isFallback || layout.omitted.length > 0 || undefined}
          data-connection-fallback={layout.isFallback || undefined}
        >
          <summary>
            {connections.length} candidate relationship
            {connections.length === 1 ? "" : "s"}
            {layout.isFallback ? " · list view" : ""}
          </summary>
          <p>
            Candidate connections between recorded events. A connection does not
            establish a physical travel route.
          </p>
          {layout.isFallback && (
            <p>
              Overlapping relationships are shown as a list to keep each
              connection distinct.
            </p>
          )}
          <ul aria-label="Candidate relationships">
            {connections.map((connection) => {
              const reason = omitted.get(connection.id);
              return (
                <li
                  key={connection.id}
                  data-selected={selected.has(connection.id) || undefined}
                >
                  <span>
                    {eventName(connection.fromEventId)} →{" "}
                    {eventName(connection.toEventId)}
                  </span>
                  {connection.label && (
                    <span className={styles.context}>{connection.label}</span>
                  )}
                  {reason && reason !== "lane-limit" && (
                    <span className={styles.context}>
                      {omissionLabels[reason]}
                    </span>
                  )}
                  {selected.has(connection.id) && (
                    <span className={styles.selectedLabel}>
                      In selected context
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </>
  );
}
