import type { InvestigationRecords } from "./selection";

/** Synthetic observations matching the compact design example. Relationships are supplied, never inferred. */
export const ledgerRecords = {
  locations: [
    {
      id: "ludington",
      label: "Ludington, MI",
      kind: "hub",
      coordinates: [-86.443, 43.957],
    },
    {
      id: "hammond",
      label: "Hammond, IN",
      kind: "hub",
      coordinates: [-87.491, 41.617],
    },
    {
      id: "avondale",
      label: "Avondale, AZ",
      kind: "hub",
      coordinates: [-112.323, 33.388],
    },
    {
      id: "wellton",
      label: "Wellton, AZ",
      kind: "hub",
      coordinates: [-114.215, 32.64],
    },
    {
      id: "el-cajon",
      label: "El Cajon, CA",
      kind: "delivery",
      coordinates: [-116.96, 32.802],
    },
    {
      id: "kansas-city",
      label: "Kansas City, KS",
      kind: "hub",
      coordinates: [-94.744, 39.124],
    },
    {
      id: "ottawa",
      label: "Ottawa, KS",
      kind: "delivery",
      coordinates: [-95.264, 38.598],
    },
    {
      id: "santa-rosa",
      label: "Santa Rosa, NM",
      kind: "delivery",
      coordinates: [-104.677, 34.936],
    },
  ],
  paths: [
    {
      id: "a",
      label: "A",
      segmentIds: ["shared", "a-transfer", "a-west", "a-return", "a-out"],
      description:
        "Candidate history with a return visit to Avondale. It shares the opening observations and the El Cajon delivery observations with B.",
    },
    {
      id: "b",
      label: "B",
      segmentIds: ["shared", "b-transfer", "b-out"],
      description:
        "Alternative candidate through the later Wellton observation. Supplied links rejoin A at the El Cajon out-for-delivery observation.",
    },
    {
      id: "c",
      label: "C",
      segmentIds: ["c-delivery"],
      description:
        "A disconnected candidate with its own Kansas City origin and Ottawa delivery observation.",
    },
  ],
  events: [
    {
      id: "accepted",
      label: "Accepted",
      locationId: "ludington",
      locationLabel: "Ludington, MI",
      timeLabel: "Oct 22 · 04:04 UTC",
      receivedTimeLabel: "Oct 22 · 04:12 UTC",
      pathIds: ["a", "b"],
    },
    {
      id: "shared-transit",
      label: "In transit",
      locationId: "hammond",
      locationLabel: "Hammond, IN",
      timeLabel: "Oct 22 · 12:23 UTC",
      receivedTimeLabel: "Oct 22 · 12:31 UTC",
      pathIds: ["a", "b"],
    },
    {
      id: "a-transit",
      label: "In transit",
      locationId: "avondale",
      locationLabel: "Avondale, AZ",
      timeLabel: "Oct 23 · 20:19 UTC",
      receivedTimeLabel: "Oct 23 · 20:25 UTC",
      pathIds: ["a"],
    },
    {
      id: "a-wellton",
      label: "In transit",
      locationId: "wellton",
      locationLabel: "Wellton, AZ",
      timeLabel: "Oct 24 · 04:20 UTC",
      receivedTimeLabel: "Oct 24 · 04:28 UTC",
      pathIds: ["a"],
    },
    {
      id: "b-transit",
      label: "In transit",
      locationId: "wellton",
      locationLabel: "Wellton, AZ",
      timeLabel: "Oct 24 · 07:56 UTC",
      receivedTimeLabel: "Oct 24 · 08:04 UTC",
      pathIds: ["b"],
    },
    {
      id: "revisit",
      label: "In transit",
      locationId: "avondale",
      locationLabel: "Avondale, AZ",
      timeLabel: "Oct 24 · 11:25 UTC",
      receivedTimeLabel: "Oct 24 · 11:41 UTC",
      detailLabel: "Return visit",
      pathIds: ["a"],
    },
    {
      id: "out-for-delivery",
      label: "Out for delivery",
      locationId: "el-cajon",
      locationLabel: "El Cajon, CA",
      timeLabel: "Oct 24 · 13:40 UTC",
      receivedTimeLabel: "Oct 24 · 13:44 UTC",
      pathIds: ["a", "b"],
    },
    {
      id: "delivered",
      label: "Delivered",
      locationId: "el-cajon",
      locationLabel: "El Cajon, CA",
      timeLabel: "Oct 24 · 16:55 UTC",
      receivedTimeLabel: "Oct 24 · 17:02 UTC",
      pathIds: ["a", "b"],
    },
    {
      id: "c-accepted",
      label: "Accepted",
      locationId: "kansas-city",
      locationLabel: "Kansas City, KS",
      timeLabel: "Oct 25 · 06:18 UTC",
      receivedTimeLabel: "Oct 25 · 06:21 UTC",
      pathIds: ["c"],
    },
    {
      id: "c-delivered",
      label: "Delivered",
      locationId: "ottawa",
      locationLabel: "Ottawa, KS",
      timeLabel: "Oct 26 · 15:10 UTC",
      receivedTimeLabel: "Oct 26 · 15:18 UTC",
      pathIds: ["c"],
    },
    {
      id: "unassigned-delivery",
      label: "Delivered",
      locationId: "santa-rosa",
      locationLabel: "Santa Rosa, NM",
      timeLabel: "Oct 27 · 13:42 UTC",
      receivedTimeLabel: "Oct 27 · 13:51 UTC",
      detailLabel: "Unassigned",
      description:
        "No candidate membership or connecting evidence was supplied for this delivery report.",
    },
  ],
  segments: [
    {
      id: "shared",
      from: "ludington",
      to: "hammond",
      label: "Shared candidate opening",
      evidence: "inferred",
    },
    {
      id: "a-transfer",
      from: "hammond",
      to: "avondale",
      label: "History A: Hammond to Avondale",
      evidence: "inferred",
    },
    {
      id: "a-west",
      from: "avondale",
      to: "wellton",
      label: "History A: Avondale to Wellton",
      evidence: "inferred",
    },
    {
      id: "a-return",
      from: "wellton",
      to: "avondale",
      label: "History A: return to Avondale",
      evidence: "inferred",
    },
    {
      id: "a-out",
      from: "avondale",
      to: "el-cajon",
      label: "History A: Avondale to El Cajon",
      evidence: "inferred",
    },
    {
      id: "b-transfer",
      from: "hammond",
      to: "wellton",
      label: "History B: Hammond to Wellton",
      evidence: "inferred",
    },
    {
      id: "b-out",
      from: "wellton",
      to: "el-cajon",
      label: "History B: Wellton to El Cajon",
      evidence: "inferred",
    },
    {
      id: "c-delivery",
      from: "kansas-city",
      to: "ottawa",
      label: "History C: Kansas City to Ottawa",
      evidence: "inferred",
    },
  ],
  connections: [
    {
      id: "shared-link",
      fromEventId: "accepted",
      toEventId: "shared-transit",
      pathIds: ["a", "b"],
      segmentId: "shared",
      label: "Shared acceptance → Hammond observation",
    },
    {
      id: "a-transfer-link",
      fromEventId: "shared-transit",
      toEventId: "a-transit",
      pathIds: ["a"],
      segmentId: "a-transfer",
      label: "History A: Hammond → first Avondale visit",
    },
    {
      id: "a-west-link",
      fromEventId: "a-transit",
      toEventId: "a-wellton",
      pathIds: ["a"],
      segmentId: "a-west",
      label: "History A: Avondale → earlier Wellton observation",
    },
    {
      id: "a-return-link",
      fromEventId: "a-wellton",
      toEventId: "revisit",
      pathIds: ["a"],
      segmentId: "a-return",
      label: "History A: Wellton → return to Avondale",
    },
    {
      id: "a-out-link",
      fromEventId: "revisit",
      toEventId: "out-for-delivery",
      pathIds: ["a"],
      segmentId: "a-out",
      label: "History A: return visit → shared out-for-delivery observation",
    },
    {
      id: "b-transfer-link",
      fromEventId: "shared-transit",
      toEventId: "b-transit",
      pathIds: ["b"],
      segmentId: "b-transfer",
      label: "History B: Hammond → later Wellton observation",
    },
    {
      id: "b-out-link",
      fromEventId: "b-transit",
      toEventId: "out-for-delivery",
      pathIds: ["b"],
      segmentId: "b-out",
      label: "History B: Wellton → shared out-for-delivery observation",
    },
    {
      id: "delivery-link",
      fromEventId: "out-for-delivery",
      toEventId: "delivered",
      pathIds: ["a", "b"],
      label:
        "Shared El Cajon out-for-delivery → delivery observation; no geographic movement asserted",
    },
    {
      id: "c-delivery-link",
      fromEventId: "c-accepted",
      toEventId: "c-delivered",
      pathIds: ["c"],
      segmentId: "c-delivery",
      label: "History C: independent acceptance → delivery observation",
    },
  ],
} satisfies InvestigationRecords;

/** Explicit illustrative assessments. Event type and candidate membership do not determine risk. */
export const eventFindings: Record<
  string,
  | {
      level: "high" | "moderate";
      label: string;
      assessedAt: string;
      detail: string;
    }
  | undefined
> = {
  revisit: {
    level: "moderate",
    label: "Moderate",
    assessedAt: "Oct 24 · 12:10 UTC",
    detail:
      "The supplied event assessment flags the repeated facility visit. The earlier Avondale observation remains a separate record.",
  },
  "unassigned-delivery": {
    level: "high",
    label: "High risk",
    assessedAt: "Oct 27 · 14:05 UTC",
    detail:
      "The supplied assessment flags this delivery report. Its reported event type remains Delivered; no candidate history has been assigned.",
  },
};
