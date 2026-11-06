import type { EventTimelineEvent } from "../EventTimeline";
import type { MapCoordinate, MapFacility, MapSegment } from "../NetworkMap";
import type {
  InvestigationConnection,
  InvestigationRecords,
} from "./selection";

/** One source of membership: candidates name explicit connections, never adjacent rows. */
export type InvestigationGraph = {
  events: readonly Omit<EventTimelineEvent, "pathIds">[];
  connections: readonly Omit<InvestigationConnection, "pathIds">[];
  paths: readonly {
    id: string;
    label: string;
    color: string;
    kind?: "recorded" | "candidate";
    description?: string;
    connectionIds: readonly string[];
    /** Membership without a connecting claim, such as an independent singleton origin. */
    isolatedEventIds?: readonly string[];
  }[];
  locations?: readonly MapFacility[];
  segments?: readonly MapSegment[];
};

/** Forecast geometry is not a collection of recorded observations. */
export type InvestigationPrediction = {
  id: string;
  pathId: string;
  label: string;
  color: string;
  source: string;
  asOf: string;
  /** Disjoint lines remain disjoint; no gaps are bridged by the component. */
  lines: readonly (readonly MapCoordinate[])[];
  dash?: readonly number[];
  /** Caller-defined score and meaning, not a calibrated probability inferred by the UI. */
  confidence?: { valueLabel: string; description: string };
};

/** A supplied assessment. Neither geometry nor a reference percentile creates a finding. */
export type InvestigationDeviation = {
  id: string;
  predictionId: string;
  eventId: string;
  firstDivergenceEventId?: string;
  summary: string;
  facts: readonly { label: string; value: string }[];
  source: string;
  asOf: string;
};

export type InvestigationAssessment = {
  id: string;
  target:
    | { type: "event"; eventId: string }
    | { type: "connection"; connectionId: string }
    | { type: "path"; pathId: string };
  label: string;
  tone: "neutral" | "warning" | "danger";
  summary: string;
  source: string;
  asOf: string;
};

export type InvestigationModelIssue = {
  code:
    | "duplicate-id"
    | "missing-reference"
    | "inconsistent-segment"
    | "invalid-geometry"
    | "invalid-prediction"
    | "invalid-deviation"
    | "invalid-assessment";
  message: string;
};

export type NormalizedInvestigationGraph = {
  records: Required<InvestigationRecords>;
  issues: readonly InvestigationModelIssue[];
};

/** Validate without repairing timestamps, dropping duplicates, or inventing relationships. */
export function normalizeInvestigationGraph(
  graph: InvestigationGraph,
): NormalizedInvestigationGraph {
  const issues: InvestigationModelIssue[] = [];
  const index = <T extends { id: string }>(
    items: readonly T[],
    kind: string,
  ) => {
    const result = new Map<string, T>();
    for (const item of items) {
      if (!item.id.trim() || result.has(item.id))
        issues.push({
          code: "duplicate-id",
          message: `${kind} has an empty or repeated ID: ${item.id}.`,
        });
      result.set(item.id, item);
    }
    return result;
  };
  const events = index(graph.events, "Observation");
  const connections = index(graph.connections, "Connection");
  index(graph.paths, "History");
  const locations = index(graph.locations ?? [], "Location");
  const segments = index(graph.segments ?? [], "Map segment");
  for (const event of graph.events) {
    if (event.locationId && !locations.has(event.locationId))
      issues.push({
        code: "missing-reference",
        message: `Observation ${event.id} references missing location ${event.locationId}.`,
      });
  }
  for (const segment of segments.values()) {
    if (!locations.has(segment.from) || !locations.has(segment.to))
      issues.push({
        code: "missing-reference",
        message: `Map segment ${segment.id} has a missing location.`,
      });
  }
  for (const connection of connections.values()) {
    const from = events.get(connection.fromEventId);
    const to = events.get(connection.toEventId);
    if (!from || !to)
      issues.push({
        code: "missing-reference",
        message: `Connection ${connection.id} has a missing observation.`,
      });
    if (connection.segmentId) {
      const segment = segments.get(connection.segmentId);
      if (!segment)
        issues.push({
          code: "missing-reference",
          message: `Connection ${connection.id} references missing segment ${connection.segmentId}.`,
        });
      else if (
        (from?.locationId && from.locationId !== segment.from) ||
        (to?.locationId && to.locationId !== segment.to)
      )
        issues.push({
          code: "inconsistent-segment",
          message: `Connection ${connection.id} and map segment ${segment.id} disagree on their endpoints.`,
        });
    }
  }
  const eventMembership = new Map<string, Set<string>>();
  const connectionMembership = new Map<string, Set<string>>();
  const add = (
    members: Map<string, Set<string>>,
    id: string,
    pathId: string,
  ) => {
    const set = members.get(id) ?? new Set<string>();
    set.add(pathId);
    members.set(id, set);
  };
  const paths = graph.paths.map((path) => {
    const segmentIds = new Set<string>();
    for (const id of path.connectionIds) {
      const connection = connections.get(id);
      if (!connection) {
        issues.push({
          code: "missing-reference",
          message: `History ${path.id} references missing connection ${id}.`,
        });
        continue;
      }
      add(connectionMembership, id, path.id);
      add(eventMembership, connection.fromEventId, path.id);
      add(eventMembership, connection.toEventId, path.id);
      if (connection.segmentId) segmentIds.add(connection.segmentId);
    }
    for (const id of path.isolatedEventIds ?? []) {
      if (!events.has(id))
        issues.push({
          code: "missing-reference",
          message: `History ${path.id} references missing isolated observation ${id}.`,
        });
      add(eventMembership, id, path.id);
    }
    return {
      id: path.id,
      label: path.label,
      description: path.description,
      color: path.color,
      segmentIds: [...segmentIds],
    };
  });
  return {
    records: {
      events: graph.events.map((event) => ({
        ...event,
        pathIds: [...(eventMembership.get(event.id) ?? [])],
      })),
      connections: graph.connections.map((connection) => ({
        ...connection,
        pathIds: [...(connectionMembership.get(connection.id) ?? [])],
      })),
      paths,
      locations: graph.locations ?? [],
      segments: graph.segments ?? [],
    },
    issues,
  };
}

/** Comparison claims must refer to observations in the forecast's own candidate history. */
export function validateInvestigationComparisons(
  records: Required<InvestigationRecords>,
  predictions: readonly InvestigationPrediction[],
  deviations: readonly InvestigationDeviation[],
  assessments: readonly InvestigationAssessment[] = [],
): InvestigationModelIssue[] {
  const issues: InvestigationModelIssue[] = [];
  const predictionIds = new Set<string>();
  const deviationIds = new Set<string>();
  const eventById = new Map(records.events.map((event) => [event.id, event]));
  for (const prediction of predictions) {
    if (predictionIds.has(prediction.id) || !prediction.id.trim())
      issues.push({
        code: "duplicate-id",
        message: `Repeated or empty forecast ID: ${prediction.id}.`,
      });
    predictionIds.add(prediction.id);
    if (
      !records.paths.some((path) => path.id === prediction.pathId) ||
      !prediction.source.trim() ||
      !prediction.asOf.trim()
    )
      issues.push({
        code: "invalid-prediction",
        message: `Forecast ${prediction.id} needs an existing history, source, and issuance time.`,
      });
    if (
      prediction.dash &&
      (!prediction.dash.length ||
        prediction.dash.some((n) => !Number.isFinite(n) || n <= 0))
    )
      issues.push({
        code: "invalid-prediction",
        message: `Forecast ${prediction.id} has an invalid line pattern.`,
      });
    if (
      !prediction.lines.length ||
      prediction.lines.some(
        (line) =>
          line.length < 2 ||
          line.some(
            ([lon, lat]) =>
              !Number.isFinite(lon) ||
              !Number.isFinite(lat) ||
              Math.abs(lon) > 180 ||
              Math.abs(lat) > 90,
          ),
      )
    )
      issues.push({
        code: "invalid-geometry",
        message: `Forecast ${prediction.id} has invalid geographic coordinates.`,
      });
  }
  for (const deviation of deviations) {
    if (deviationIds.has(deviation.id) || !deviation.id.trim())
      issues.push({
        code: "duplicate-id",
        message: `Repeated or empty deviation ID: ${deviation.id}.`,
      });
    deviationIds.add(deviation.id);
    const prediction = predictions.find(
      (item) => item.id === deviation.predictionId,
    );
    const ids = [
      deviation.eventId,
      ...(deviation.firstDivergenceEventId
        ? [deviation.firstDivergenceEventId]
        : []),
    ];
    if (
      !prediction ||
      ids.some(
        (id) => !eventById.get(id)?.pathIds?.includes(prediction.pathId),
      ) ||
      !deviation.source.trim() ||
      !deviation.asOf.trim()
    )
      issues.push({
        code: "invalid-deviation",
        message: `Deviation ${deviation.id} needs provenance and observations belonging to its forecast's history.`,
      });
  }
  const assessmentIds = new Set<string>();
  for (const assessment of assessments) {
    if (!assessment.id.trim() || assessmentIds.has(assessment.id))
      issues.push({
        code: "duplicate-id",
        message: `Repeated or empty assessment ID: ${assessment.id}.`,
      });
    assessmentIds.add(assessment.id);
    const target = assessment.target;
    const exists =
      target.type === "event"
        ? eventById.has(target.eventId)
        : target.type === "connection"
          ? records.connections.some((item) => item.id === target.connectionId)
          : records.paths.some((item) => item.id === target.pathId);
    if (!exists || !assessment.source.trim() || !assessment.asOf.trim())
      issues.push({
        code: "invalid-assessment",
        message: `Assessment ${assessment.id} needs an existing target, source, and assessment time.`,
      });
  }
  return issues;
}
