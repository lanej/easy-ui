import React from "react";
import { dependencyConnectionArrival } from "./routing";
import type { routeDependencyConnections } from "./routing";
import type { DependencyGraphSelection } from "./types";
import styles from "./DependencyGraph.module.scss";

type Connections = ReturnType<typeof routeDependencyConnections>;

/** One visible arrow per arrival, without discarding the contributing edges. */
export function DependencyGraphConvergence({
  connections,
  instanceId,
  selection,
  highlighted,
  onSelect,
}: {
  connections: Connections;
  instanceId: string;
  selection: DependencyGraphSelection;
  highlighted: ReadonlySet<string>;
  onSelect: (selection: DependencyGraphSelection) => void;
}) {
  const arrivals = new Map<string, Connections>();
  for (const connection of connections) {
    if (connection.convergenceKey === undefined) continue;
    const members = arrivals.get(connection.convergenceKey) ?? [];
    members.push(connection);
    arrivals.set(connection.convergenceKey, members);
  }
  return (
    <>
      {[...arrivals].map(([key, members]) => {
        const edges = members.flatMap((member) => member.edges);
        const ids = edges.map((edge) => edge.id);
        const changes = new Set(edges.map((edge) => edge.change ?? "unknown"));
        // A shared arrow is not evidence that differently changed edges all
        // acquired whichever status happened to be painted last.
        const change =
          changes.size === 1 ? (edges[0].change ?? "unknown") : "unknown";
        const points = members[0].points;
        const end = points[points.length - 1];
        // Paint the actual common straight approach, not a one-pixel carrier
        // for the marker. Start after every contributing rounded corner.
        const startX = Math.max(
          ...members.map(
            (member) => dependencyConnectionArrival(member.points)!.x,
          ),
        );
        const arrivalPath = `M ${startX} ${end.y} L ${end.x} ${end.y}`;
        const selected =
          selection?.type === "edge"
            ? ids.includes(selection.id)
            : selection?.type === "edges"
              ? selection.ids.some((id) => ids.includes(id))
              : false;
        return (
          <g
            key={key}
            className={styles.connection}
            data-graph-convergence={key}
            data-graph-convergence-edge-ids={JSON.stringify(ids)}
            data-link-change={change}
            data-dashed={
              edges.every((edge) => edge.variant === "dashed") || undefined
            }
            data-selected={selected || undefined}
            data-highlighted={
              ids.some((id) => highlighted.has(id)) || undefined
            }
            onClick={() => onSelect({ type: "edges", ids })}
          >
            <path className={styles.edgeHitArea} d={arrivalPath} />
            <path
              className={styles.edgeLine}
              d={arrivalPath}
              markerEnd={`url(#${instanceId}-arrow-${change})`}
            />
            <title>
              {edges.map((edge) => edge.label ?? edge.id).join("; ")}
            </title>
          </g>
        );
      })}
    </>
  );
}
