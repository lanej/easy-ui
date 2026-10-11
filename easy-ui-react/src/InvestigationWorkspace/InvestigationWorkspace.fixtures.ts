import type { InvestigationRecords } from "./selection";

/** Intentionally synthetic positions and observations, never an inferred journey. */
export const investigationRecords: InvestigationRecords = {
  locations: [
    {
      id: "origin",
      label: "North Harbor",
      kind: "warehouse",
      coordinates: [-3, 0],
      detail: "Distribution center · FAC-014",
    },
    {
      id: "shared",
      label: "Central Exchange",
      kind: "hub",
      coordinates: [-0.8, 0],
    },
    { id: "north", label: "North Gate", kind: "hub", coordinates: [1, 1] },
    { id: "south", label: "South Gate", kind: "hub", coordinates: [1, -1] },
    {
      id: "destination",
      label: "Destination",
      kind: "destination",
      coordinates: [3, 0],
    },
    {
      id: "unobserved",
      label: "West Annex",
      kind: "hub",
      coordinates: [-2, 1.3],
    },
  ],
  segments: [
    {
      id: "shared-leg",
      from: "origin",
      to: "shared",
      label: "North Harbor → Central Exchange",
      evidence: "transfer",
    },
    {
      id: "north-leg",
      from: "shared",
      to: "north",
      label: "Central Exchange → North Gate",
      evidence: "inferred",
    },
    {
      id: "north-end",
      from: "north",
      to: "destination",
      label: "North Gate → Destination",
      evidence: "planned",
    },
    {
      id: "south-leg",
      from: "shared",
      to: "south",
      label: "Central Exchange → South Gate",
      evidence: "inferred",
    },
    {
      id: "south-end",
      from: "south",
      to: "destination",
      label: "South Gate → Destination",
      evidence: "planned",
    },
  ],
  paths: [
    {
      id: "north",
      label: "Via North Gate",
      segmentIds: ["shared-leg", "north-leg", "north-end"],
      description:
        "Candidate history A. Shares its first connection with history B.",
    },
    {
      id: "south",
      label: "Via South Gate",
      segmentIds: ["shared-leg", "south-leg", "south-end"],
      description:
        "Candidate history B. Supplied independently; neither history is designated as true.",
    },
  ],
  events: [
    {
      id: "accepted",
      label: "Accepted",
      timeLabel: "08:00",
      receivedTimeLabel: "08:02",
      locationId: "origin",
      locationLabel: "North Harbor",
      pathIds: ["north", "south"],
      tone: "success",
    },
    {
      id: "arrived",
      label: "Arrived at exchange",
      timeLabel: "10:30",
      receivedTimeLabel: "10:34",
      locationId: "shared",
      locationLabel: "Central Exchange",
      pathIds: ["north", "south"],
      tone: "success",
    },
    {
      id: "duplicate",
      label: "Arrived at exchange",
      timeLabel: "10:30",
      receivedTimeLabel: "11:05",
      locationId: "shared",
      locationLabel: "Central Exchange",
      pathIds: ["north", "south"],
      tone: "neutral",
      description:
        "Separate observation with the same event time. Both records are retained.",
    },
    {
      id: "north-scan",
      label: "Processed at North Gate",
      timeLabel: "14:10",
      receivedTimeLabel: "14:12",
      locationId: "north",
      locationLabel: "North Gate",
      pathIds: ["north"],
      tone: "warning",
      description:
        "Conflicting location observations are supplied for 14:10. No history is chosen automatically.",
    },
    {
      id: "south-scan",
      label: "Processed at South Gate",
      timeLabel: "14:10",
      receivedTimeLabel: "14:18",
      locationId: "south",
      locationLabel: "South Gate",
      pathIds: ["south"],
      tone: "warning",
    },
    {
      id: "unlocated",
      label: "Location not reported",
      timeLabel: "16:00",
      receivedTimeLabel: "16:03",
      tone: "neutral",
      description:
        "This observation has no supplied location or candidate-path membership.",
    },
    {
      id: "untimed",
      label: "Time not reported",
      receivedTimeLabel: "17:45",
      locationId: "shared",
      locationLabel: "Central Exchange",
      tone: "neutral",
    },
  ],
};
