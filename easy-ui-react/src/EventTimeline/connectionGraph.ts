/**
 * A caller-supplied, directed relationship between observations. Membership in
 * the same candidate history does not create a relationship by itself.
 */
export type EventTimelineConnection = {
  id: string;
  fromEventId: string;
  toEventId: string;
  /** Explicit candidate memberships; optional pathColors key into these IDs. */
  pathIds?: readonly string[];
  /** Additional caller-owned context; endpoint identities remain available. */
  label?: string;
};

/** Resolve only supplied memberships; an unmapped shared membership stays present. */
export function resolveConnectionGraphMemberships(
  pathIds: readonly string[] | undefined,
  pathColors: Readonly<Record<string, string>> | undefined,
): { pathId: string; color?: string }[] {
  return Array.from(new Set(pathIds ?? []), (pathId) => {
    const supplied =
      pathColors && Object.prototype.hasOwnProperty.call(pathColors, pathId)
        ? pathColors[pathId]
        : undefined;
    return {
      pathId,
      color:
        typeof supplied === "string" ? supplied.trim() || undefined : undefined,
    };
  });
}

export type ConnectionGraphNode = {
  eventId: string;
  rowIndex: number;
  lane: number;
  incomingCount: number;
  outgoingCount: number;
};

export type ConnectionGraphEdge = {
  connection: EventTimelineConnection;
  fromIndex: number;
  toIndex: number;
  fromLane: number;
  toLane: number;
  lane: number;
};

export type ConnectionGraphOmission = {
  connection: EventTimelineConnection;
  reason: "missing-endpoint" | "backward" | "self" | "lane-limit";
};

export type ConnectionGraphLayout = {
  width: number;
  laneCount: number;
  nodes: readonly ConnectionGraphNode[];
  edges: readonly ConnectionGraphEdge[];
  omitted: readonly ConnectionGraphOmission[];
  /** The complete relationship list replaces a graph that would be too wide. */
  isFallback: boolean;
};

export const CONNECTION_GRAPH_MAX_LANES = 4;
export const CONNECTION_GRAPH_LANE_SPACING = 16;
export const CONNECTION_GRAPH_INSET = 12;

/** All geometry remains within a 72px gutter. */
export function connectionGraphLaneX(lane: number) {
  return CONNECTION_GRAPH_INSET + lane * CONNECTION_GRAPH_LANE_SPACING;
}

/**
 * Route only explicit forward connections in caller row order. A live rail
 * belongs to one edge until its destination. Unrelated event nodes must use a
 * free rail, so a passing relationship never appears to include that event.
 *
 * At a shared event, incoming edges meet at one node and outgoing edges may
 * reuse their released rails. Only supplied endpoints can create that join.
 * No timestamps, locations, path memberships, or missing rows are inferred.
 */
export function getConnectionGraphLayout(
  events: readonly { id: string }[],
  connections: readonly EventTimelineConnection[],
): ConnectionGraphLayout {
  const indexById = new Map(events.map((event, index) => [event.id, index]));
  const omissions = new Map<
    EventTimelineConnection,
    ConnectionGraphOmission["reason"]
  >();
  const forward: {
    connection: EventTimelineConnection;
    fromIndex: number;
    toIndex: number;
  }[] = [];

  for (const connection of connections) {
    const fromIndex = indexById.get(connection.fromEventId);
    const toIndex = indexById.get(connection.toEventId);
    if (fromIndex === undefined || toIndex === undefined) {
      omissions.set(connection, "missing-endpoint");
    } else if (fromIndex === toIndex) {
      omissions.set(connection, "self");
    } else if (fromIndex > toIndex) {
      omissions.set(connection, "backward");
    } else {
      forward.push({ connection, fromIndex, toIndex });
    }
  }

  // Connection input order never changes the drawing. Nearer destinations
  // continue the first rail; further branches get the next available rail.
  forward.sort(
    (a, b) =>
      a.fromIndex - b.fromIndex ||
      a.toIndex - b.toIndex ||
      (a.connection.id < b.connection.id
        ? -1
        : a.connection.id > b.connection.id
          ? 1
          : 0),
  );
  const outgoingByRow = new Map<number, typeof forward>();
  for (const edge of forward) {
    const outgoing = outgoingByRow.get(edge.fromIndex) ?? [];
    outgoing.push(edge);
    outgoingByRow.set(edge.fromIndex, outgoing);
  }

  const active: (ConnectionGraphEdge | undefined)[] = Array.from(
    { length: CONNECTION_GRAPH_MAX_LANES },
    () => undefined,
  );
  const nodes: ConnectionGraphNode[] = [];
  const edges: ConnectionGraphEdge[] = [];
  let laneCount = events.length ? 1 : 0;

  const fallback = (): ConnectionGraphLayout => ({
    width: 0,
    laneCount: 0,
    nodes: [],
    edges: [],
    omitted: connections.map((connection) => ({
      connection,
      reason: omissions.get(connection) ?? "lane-limit",
    })),
    isFallback: true,
  });

  for (const [rowIndex, event] of events.entries()) {
    const incoming = active.filter(
      (edge): edge is ConnectionGraphEdge => edge?.toIndex === rowIndex,
    );
    const lane = incoming.length
      ? Math.min(...incoming.map((edge) => edge.lane))
      : active.findIndex((edge) => edge === undefined);
    if (lane === -1) return fallback();

    for (const edge of incoming) {
      edge.toLane = lane;
      active[edge.lane] = undefined;
    }
    const outgoing = outgoingByRow.get(rowIndex) ?? [];
    nodes.push({
      eventId: event.id,
      rowIndex,
      lane,
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
    });
    laneCount = Math.max(laneCount, lane + 1);

    for (const [branchIndex, edge] of outgoing.entries()) {
      const edgeLane =
        branchIndex === 0
          ? lane
          : active.findIndex((candidate) => candidate === undefined);
      if (edgeLane === -1) return fallback();
      const routed: ConnectionGraphEdge = {
        ...edge,
        fromLane: lane,
        toLane: -1,
        lane: edgeLane,
      };
      active[edgeLane] = routed;
      edges.push(routed);
      laneCount = Math.max(laneCount, edgeLane + 1);
    }
  }

  return {
    width: laneCount
      ? CONNECTION_GRAPH_INSET * 2 +
        (laneCount - 1) * CONNECTION_GRAPH_LANE_SPACING
      : 0,
    laneCount,
    nodes,
    edges,
    omitted: connections.flatMap((connection) => {
      const reason = omissions.get(connection);
      return reason ? [{ connection, reason }] : [];
    }),
    isFallback: false,
  };
}

/**
 * Keep bends near their actual endpoint rows. Intermediate rows can have any
 * height, and a rail must remain vertical while passing an unrelated event.
 */
export function connectionGraphEdgePath(
  edge: ConnectionGraphEdge,
  rowCenters: ReadonlyMap<number, number>,
): string | null {
  const fromY = rowCenters.get(edge.fromIndex);
  const toY = rowCenters.get(edge.toIndex);
  if (
    fromY === undefined ||
    toY === undefined ||
    !Number.isFinite(fromY) ||
    !Number.isFinite(toY) ||
    toY <= fromY
  ) {
    return null;
  }
  const nextY = rowCenters.get(edge.fromIndex + 1) ?? toY;
  const previousY = rowCenters.get(edge.toIndex - 1) ?? fromY;
  const fromBend = Math.max(0, Math.min(14, (nextY - fromY) / 2));
  const toBend = Math.max(0, Math.min(14, (toY - previousY) / 2));
  const fromX = connectionGraphLaneX(edge.fromLane);
  const toX = connectionGraphLaneX(edge.toLane);
  const railX = connectionGraphLaneX(edge.lane);
  const start =
    fromX === railX
      ? `M ${fromX} ${fromY}`
      : `M ${fromX} ${fromY} C ${fromX} ${fromY + fromBend}, ${railX} ${fromY}, ${railX} ${fromY + fromBend}`;
  const end =
    toX === railX
      ? `L ${toX} ${toY}`
      : `L ${railX} ${toY - toBend} C ${railX} ${toY}, ${toX} ${toY - toBend}, ${toX} ${toY}`;
  return `${start} ${end}`;
}
