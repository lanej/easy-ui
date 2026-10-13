import type { EventTimelineEvent } from "../EventTimeline";
import type { MapFacility, MapSegment } from "../NetworkMap";

/** A caller-supplied candidate history. Shared segment IDs retain shared geometry. */
export type InvestigationPath = {
  id: string;
  label: string;
  segmentIds: readonly string[];
  description?: string;
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
  /** False when the selected record was removed from the supplied snapshot. */
  isAvailable: boolean;
};

export type InvestigationRecords = {
  events: readonly EventTimelineEvent[];
  locations: readonly MapFacility[];
  segments: readonly MapSegment[];
  paths: readonly InvestigationPath[];
};

export function resolveSelection(
  records: InvestigationRecords,
  selection: InvestigationSelection,
): InvestigationDetailsContext {
  const { events, locations, segments, paths } = records;
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
    isAvailable:
      selection === null ||
      Boolean(
        selection.type === "event"
          ? event
          : selection.type === "location"
            ? location
            : selection.type === "path"
              ? path
              : segment,
      ),
  };
}

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
