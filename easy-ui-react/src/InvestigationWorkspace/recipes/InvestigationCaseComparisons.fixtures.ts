import type { ComparisonExampleData } from "../../PathComparison/PathComparison.examples";
import { comparisonRows } from "../../PathComparison/PathComparison.fixtures";
import { investigationRecords } from "../InvestigationWorkspace.fixtures";

type CaseObservations = {
  paths: string[];
  /** Caller-formatted occurrence and receipt labels for this case's records. */
  times: Record<string, readonly [string, string]>;
  selected: string;
};

function caseComparison(
  caseId: string,
  { paths: pathIds, times, selected }: CaseObservations,
): ComparisonExampleData {
  const paths = investigationRecords.paths.filter((path) =>
    pathIds.includes(path.id),
  );
  const eventId = (id: string) => `${caseId}:${id}`;
  const events = investigationRecords.events
    .filter((event) => times[event.id])
    .map((event) => ({
      ...event,
      id: eventId(event.id),
      timeLabel: times[event.id][0],
      receivedTimeLabel: times[event.id][1],
      pathIds: event.pathIds?.filter((id) => pathIds.includes(id)),
      // Context about a different fixture's conflicting times must not leak.
      description: undefined,
    }));
  const segmentIds = new Set(paths.flatMap((path) => [...path.segmentIds]));
  return {
    records: {
      locations: investigationRecords.locations,
      segments: investigationRecords.segments.filter((segment) =>
        segmentIds.has(segment.id),
      ),
      paths,
      events,
    },
    rows: comparisonRows.map((row) => ({
      ...row,
      label: row.id === "processing" ? "Processing" : row.label,
      description:
        row.id === "exchange" && times.duplicate
          ? "Two separate observations"
          : undefined,
      cells: row.cells
        .filter((cell) => pathIds.includes(cell.pathId))
        .map((cell) => ({
          ...cell,
          eventIds: cell.eventIds.filter((id) => times[id]).map(eventId),
        })),
    })),
    initialSelection: {
      type: "path",
      pathId: pathIds[0],
      eventId: eventId(selected),
    },
    sourceLabel: "Tracking feed",
  };
}

/** Independent synthetic observation snapshots; the fictional network is shared. */
export const caseComparisons: Record<
  string,
  ComparisonExampleData | undefined
> = {
  "CASE-1042": caseComparison("CASE-1042", {
    paths: ["north", "south"],
    selected: "north-scan",
    times: {
      accepted: ["08:00", "08:02"],
      arrived: ["10:30", "10:34"],
      duplicate: ["10:30", "11:05"],
      "north-scan": ["14:10", "14:12"],
      "south-scan": ["14:10", "14:18"],
    },
  }),
  "CASE-1038": caseComparison("CASE-1038", {
    paths: ["north"],
    selected: "arrived",
    times: {
      accepted: ["07:10", "07:12"],
      arrived: ["08:40", "08:47"],
    },
  }),
  "CASE-1029": caseComparison("CASE-1029", {
    paths: ["north"],
    selected: "north-scan",
    times: {
      accepted: ["9 Oct, 13:00", "9 Oct, 13:02"],
      "north-scan": ["9 Oct, 17:05", "9 Oct, 17:09"],
    },
  }),
  "CASE-1017": caseComparison("CASE-1017", {
    paths: ["south"],
    selected: "south-scan",
    times: {
      accepted: ["06:10", "06:12"],
      arrived: ["08:20", "08:23"],
      "south-scan": ["12:16", "12:19"],
    },
  }),
  "CASE-1014": undefined,
  "CASE-1008": caseComparison("CASE-1008", {
    paths: ["north", "south"],
    selected: "duplicate",
    times: {
      accepted: ["9 Oct, 06:40", "9 Oct, 06:43"],
      arrived: ["9 Oct, 08:00", "9 Oct, 08:04"],
      duplicate: ["9 Oct, 08:00", "9 Oct, 08:20"],
    },
  }),
  "CASE-1003": caseComparison("CASE-1003", {
    paths: ["south"],
    selected: "south-scan",
    times: {
      accepted: ["05:30", "05:33"],
      "south-scan": ["11:30", "11:34"],
    },
  }),
};
