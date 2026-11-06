import type {
  EventTimelineEvent,
  EventTimelineConnection,
} from "../EventTimeline";
import type { MapFacility, MapSegment } from "../NetworkMap";

/** A caller-supplied candidate history. Shared segment IDs retain shared geometry. */
export type InvestigationPath = {
  id: string;
  label: string;
  segmentIds: readonly string[];
  description?: string;
  /** Stable caller-supplied candidate identity color, using a literal MapLibre paint color. */
  color?: string;
};

/** An explicit candidate relationship between observations, independent of geography. */
export type InvestigationConnection = EventTimelineConnection & {
  /** Optional caller-supplied association; a map segment never establishes event adjacency. */
  segmentId?: string;
};

/** One controlled selection; scoped event stepping retains the selected context. */
export type InvestigationSelection =
  | { type: "event"; eventId: string }
  | { type: "location"; locationId: string; eventId?: string }
  | { type: "path"; pathId: string; eventId?: string }
  | { type: "segment"; segmentId: string; eventId?: string }
  | null;

export type InvestigationDetailsContext = {
  selection: InvestigationSelection;
  event?: EventTimelineEvent;
  location?: MapFacility;
  path?: InvestigationPath;
  segment?: MapSegment;
  /** Caller order is retained, including duplicates with distinct IDs. */
  events: readonly EventTimelineEvent[];
  /** All associated candidates, including shared-segment membership. */
  paths: readonly InvestigationPath[];
  /** Explicit relationships associated with the selected event or scope. */
  connections?: readonly InvestigationConnection[];
  /** False when the selected record was removed from the supplied snapshot. */
  isAvailable: boolean;
};

/** Observations plus optional map and candidate records; event-only inspection needs no geometry. */
export type InvestigationRecords = {
  events: readonly EventTimelineEvent[];
  locations?: readonly MapFacility[];
  segments?: readonly MapSegment[];
  paths?: readonly InvestigationPath[];
  /** Candidate event links. Omission never asks the workspace to infer a journey. */
  connections?: readonly InvestigationConnection[];
};

/** Resolve a controlled selection against the current snapshot without changing it. */
export function resolveSelection(
  records: InvestigationRecords,
  selection: InvestigationSelection,
): InvestigationDetailsContext {
  const {
    events,
    locations = [],
    segments = [],
    paths = [],
    connections,
  } = records;
  const path =
    selection?.type === "path"
      ? paths.find((item) => item.id === selection.pathId)
      : undefined;
  const segment =
    selection?.type === "segment"
      ? segments.find((item) => item.id === selection.segmentId)
      : undefined;
  const relatedPaths =
    selection?.type === "segment"
      ? paths.filter((item) => item.segmentIds.includes(selection.segmentId))
      : path
        ? [path]
        : [];
  const relatedEvents =
    selection?.type === "location"
      ? events.filter((item) => item.locationId === selection.locationId)
      : selection?.type === "path" || selection?.type === "segment"
        ? events.filter((item) =>
            relatedPaths.some((candidate) =>
              item.pathIds?.includes(candidate.id),
            ),
          )
        : events;
  const event = selection?.eventId
    ? relatedEvents.find((item) => item.id === selection.eventId)
    : undefined;
  const location =
    selection?.type === "location"
      ? locations.find((item) => item.id === selection.locationId)
      : locations.find((item) => item.id === event?.locationId);
  const isAvailable =
    selection === null ||
    Boolean(
      selection.type === "event"
        ? event
        : selection.type === "location"
          ? location
          : selection.type === "path"
            ? path
            : segment,
    );
  const relatedEventIds = new Set(relatedEvents.map((item) => item.id));
  const selectedConnections = connections?.filter((connection) => {
    if (!isAvailable) return false;
    if (selection?.type === "event")
      return (
        connection.fromEventId === event?.id ||
        connection.toEventId === event?.id
      );
    if (selection?.type === "path")
      return connection.pathIds?.includes(selection.pathId);
    if (selection?.type === "segment")
      return connection.segmentId === selection.segmentId;
    if (selection?.type === "location")
      return (
        relatedEventIds.has(connection.fromEventId) ||
        relatedEventIds.has(connection.toEventId)
      );
    return true;
  });
  return {
    selection,
    event,
    location,
    path,
    segment,
    events: relatedEvents,
    paths:
      selection?.type === "event"
        ? paths.filter((item) => event?.pathIds?.includes(item.id))
        : selection?.type === "location"
          ? paths.filter((item) =>
              relatedEvents.some((itemEvent) =>
                itemEvent.pathIds?.includes(item.id),
              ),
            )
          : relatedPaths,
    connections: selectedConnections,
    isAvailable,
  };
}

/** Request an event selection, retaining an available scope for its member events. */
export function selectEvent(
  context: InvestigationDetailsContext,
  eventId: string,
): InvestigationSelection {
  return context.selection &&
    context.selection.type !== "event" &&
    context.isAvailable &&
    context.events.some((event) => event.id === eventId)
    ? { ...context.selection, eventId }
    : { type: "event", eventId };
}
