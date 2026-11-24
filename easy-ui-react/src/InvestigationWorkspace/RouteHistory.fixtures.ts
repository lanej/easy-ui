import type { MapCoordinate, MapFacility, MapSegment } from "../NetworkMap";
import type { InvestigationGraph } from "./workbenchModel";
import type { RouteHistoryAnnotation } from "./routeHistoryTypes";

const cityCenters = {
  manhattan: { label: "New York, NY", coordinates: [-74.006, 40.7128] },
  brooklyn: { label: "Brooklyn, NY", coordinates: [-73.9442, 40.6782] },
  jamaica: { label: "Jamaica, NY", coordinates: [-73.8057, 40.7027] },
  westbury: { label: "Westbury, NY", coordinates: [-73.5876, 40.7557] },
  bethpage: { label: "Bethpage, NY", coordinates: [-73.4673, 40.7443] },
  katy: { label: "Katy, TX", coordinates: [-95.8244, 29.7858] },
} as const satisfies Record<
  string,
  { label: string; coordinates: MapCoordinate }
>;

type City = keyof typeof cityCenters;

function location(id: City, scanInterval?: string): MapFacility {
  return {
    id,
    ...cityCenters[id],
    kind: "hub",
    detail: [scanInterval, "City-level map point"].filter(Boolean).join(" · "),
  };
}

function scan(
  id: string,
  locationId: City,
  timeLabel: string | undefined,
  label: string,
  detailLabel?: string,
  statusLabel?: string,
): InvestigationGraph["events"][number] {
  return {
    id,
    locationId,
    locationLabel: cityCenters[locationId].label,
    timeLabel,
    label,
    detailLabel,
    statusLabel,
  };
}

function connection(
  fromEventId: string,
  toEventId: string,
  segmentId?: string,
) {
  return {
    id: `${fromEventId}-${toEventId}`,
    fromEventId,
    toEventId,
    segmentId,
  };
}

function segment(from: City, to: City): MapSegment {
  return {
    id: `${from}-${to}`,
    from,
    to,
    evidence: "inferred",
    label: `Candidate connection from ${cityCenters[from].label} to ${cityCenters[to].label}`,
  };
}

const routeA = {
  id: "a",
  label: "Route A",
  color: "#68beed",
  kind: "candidate",
} as const;
const routeB = {
  id: "b",
  label: "Route B",
  color: "#c1a4f7",
  kind: "candidate",
} as const;

/** Invented observations illustrate a fork. Every relationship below is explicit. */
export const forkedRouteHistory: InvestigationGraph = {
  locations: [
    location("manhattan"),
    location("brooklyn", "5 min apart"),
    location("westbury", "26 min apart"),
    location("jamaica"),
    location("bethpage"),
  ],
  events: [
    scan("1", "manhattan", "04:12", "Accepted at facility"),
    scan("2", "brooklyn", "05:38", "Arrived at facility", "A1", "In transit"),
    scan("3", "brooklyn", "05:43", "Arrived at facility", "U1", "In transit"),
    scan("4", "westbury", "05:51", "Arrived at facility", "A1", "In transit"),
    scan("5", "westbury", "06:17", "Departed facility", "SF", "In transit"),
    scan("6", "jamaica", "06:42", "Arrived at facility", "A1", "In transit"),
    scan("7", "bethpage", "07:09", "Arrived at facility", "A1", "In transit"),
  ],
  segments: [
    segment("manhattan", "brooklyn"),
    segment("brooklyn", "jamaica"),
    segment("manhattan", "westbury"),
    segment("westbury", "bethpage"),
  ],
  connections: [
    connection("1", "2", "manhattan-brooklyn"),
    connection("2", "3"),
    connection("3", "6", "brooklyn-jamaica"),
    connection("1", "4", "manhattan-westbury"),
    connection("4", "5"),
    connection("5", "7", "westbury-bethpage"),
  ],
  paths: [
    {
      ...routeA,
      description: "New York → Brooklyn → Jamaica",
      connectionIds: ["1-2", "2-3", "3-6"],
    },
    {
      ...routeB,
      description: "New York → Westbury → Bethpage",
      connectionIds: ["1-4", "4-5", "5-7"],
    },
  ],
};

/** The source groups scans 5–7. Only their departure is individually timed. */
export const disjointRouteHistory: InvestigationGraph = {
  locations: [
    location("manhattan"),
    location("katy", "1 h 1 min apart"),
    location("bethpage"),
    location("westbury"),
    location("brooklyn", "42 min from first to last scan"),
  ],
  events: [
    scan("1", "manhattan", "10:58", "Pre-transit"),
    scan("2", "katy", "21:36", "Arrival scan"),
    scan("3", "bethpage", undefined, "Location scan"),
    scan("4", "katy", "22:37", "Departed facility", "SF", "In transit"),
    scan("5–7", "bethpage", "04:09", "Departure recorded"),
    scan("8", "westbury", "04:38", "Carrier notification", "TL", "In transit"),
    scan("9", "brooklyn", "05:38", "Arrived at facility", "A1", "In transit"),
    scan("10", "brooklyn", "05:43", "Arrived at facility", "U1", "In transit"),
    scan("11", "brooklyn", "06:20", "Status update", "10", "In transit"),
  ],
  segments: [segment("bethpage", "brooklyn")],
  connections: [
    connection("2", "4"),
    connection("3", "5–7"),
    connection("5–7", "9", "bethpage-brooklyn"),
    connection("9", "10"),
    connection("10", "11"),
  ],
  paths: [
    {
      ...routeA,
      description: "Katy · 2 scans at one location",
      connectionIds: ["2-4"],
    },
    {
      ...routeB,
      description: "Bethpage → Brooklyn",
      connectionIds: ["3-5–7", "5–7-9", "9-10", "10-11"],
    },
  ],
};

const firstDay = new Set(["1", "2", "3", "4"]);

export function routeHistoryAnnotations(graph: InvestigationGraph) {
  const excerpt = graph === disjointRouteHistory;
  return Object.fromEntries(
    graph.events.map(({ id }) => [
      id,
      {
        dayLabel: excerpt && firstDay.has(id) ? "Oct 26, 2026" : "Oct 27, 2026",
        referenceLabel: `#${id}`,
        scanCount: id === "5–7" ? 3 : 1,
      } satisfies RouteHistoryAnnotation,
    ]),
  );
}
