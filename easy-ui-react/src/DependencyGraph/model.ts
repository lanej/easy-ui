import { graphlib, layout } from "@dagrejs/dagre";
import type {
  DependencyGraphEdge,
  DependencyGraphGroup,
  DependencyGraphNode,
  DependencyGraphView,
} from "./types";

export const NODE_WIDTH = 256;
export const NODE_HEIGHT = 88;
const GROUP_HEIGHT = 112;
export const hasDependencyGraphChanges = (node: DependencyGraphNode) =>
  !!node.changes?.length ||
  (!!node.change && node.change !== "unchanged" && node.change !== "unknown");
const compare = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export type GraphItem = {
  key: string;
  node?: DependencyGraphNode;
  group?: DependencyGraphGroup;
  members: readonly DependencyGraphNode[];
  x: number;
  y: number;
  width: number;
  height: number;
};
export type GraphConnection = {
  key: string;
  source: string;
  target: string;
  edges: DependencyGraphEdge[];
  points: { x: number; y: number }[];
};

/** Sort stable IDs before layout so caller reordering cannot move the graph. */
export function buildDependencyGraph(
  nodes: readonly DependencyGraphNode[],
  edges: readonly DependencyGraphEdge[],
  groups: readonly DependencyGraphGroup[],
  collapsedGroupIds: readonly string[],
  nodeHeights: ReadonlyMap<string, number> = new Map(),
  nodeWidth: number | ReadonlyMap<string, number> = NODE_WIDTH,
  zoom = 1,
) {
  const records = new Map(nodes.map((node) => [node.id, node]));
  const groupRecords = new Map(groups.map((group) => [group.id, group]));
  const collapsed = new Set(collapsedGroupIds);
  const branchSources = new Set(
    edges
      .filter((edge) => edge.source !== edge.target && records.has(edge.target))
      .map((edge) => edge.source),
  );
  const nodeKey = (node: DependencyGraphNode) =>
    node.groupId &&
    collapsed.has(node.groupId) &&
    groupRecords.has(node.groupId)
      ? `group:${node.groupId}`
      : `node:${node.id}`;
  const items = new Map<string, GraphItem>();
  const memberships = new Map<string, DependencyGraphNode[]>();
  for (const node of [...records.values()].sort(compare)) {
    if (node.groupId && groupRecords.has(node.groupId)) {
      const members = memberships.get(node.groupId) ?? [];
      members.push(node);
      memberships.set(node.groupId, members);
    }
    const key = nodeKey(node);
    const previous = items.get(key);
    if (previous) (previous.members as DependencyGraphNode[]).push(node);
    else
      items.set(key, {
        key,
        node: key.startsWith("node:") ? node : undefined,
        group: key.startsWith("group:")
          ? groupRecords.get(node.groupId!)
          : undefined,
        members: [node],
        x: 0,
        y: 0,
        width: key.startsWith("node:")
          ? typeof nodeWidth === "number"
            ? nodeWidth
            : (nodeWidth.get(node.id) ?? NODE_WIDTH)
          : NODE_WIDTH,
        height: key.startsWith("node:")
          ? (nodeHeights.get(node.id) ??
            NODE_HEIGHT +
              (hasDependencyGraphChanges(node) || branchSources.has(node.id)
                ? 42
                : 2))
          : GROUP_HEIGHT,
      });
  }
  const connections = new Map<string, GraphConnection>();
  const unavailable: DependencyGraphEdge[] = [];
  for (const edge of [...edges].sort(compare)) {
    const sourceNode = records.get(edge.source);
    const targetNode = records.get(edge.target);
    if (!sourceNode || !targetNode) {
      unavailable.push(edge);
      continue;
    }
    const source = nodeKey(sourceNode);
    const target = nodeKey(targetNode);
    // Connections within a collapsed group remain in its selection details.
    if (source === target && source.startsWith("group:")) continue;
    const key = JSON.stringify([
      source,
      target,
      edge.change ?? "unknown",
      source.startsWith("node:") ? (edge.sourceAttributePath ?? null) : null,
      target.startsWith("node:") ? (edge.targetAttributePath ?? null) : null,
    ]);
    const previous = connections.get(key);
    if (previous) previous.edges.push(edge);
    else
      connections.set(key, { key, source, target, edges: [edge], points: [] });
  }
  const graph = new graphlib.Graph({ compound: true, multigraph: true });
  graph.setGraph({
    rankdir: "LR",
    ranksep: 88,
    nodesep: Math.max(32, 25 / zoom + 8),
    edgesep: 16,
    marginx: 28,
    marginy: Math.max(48, 25 / zoom + 12),
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const group of [...groupRecords.values()].sort(compare)) {
    if (!collapsed.has(group.id) && memberships.has(group.id))
      graph.setNode(`cluster:${group.id}`, { label: group.label });
  }
  for (const item of items.values()) {
    graph.setNode(item.key, { width: item.width, height: item.height });
    if (item.node?.groupId && graph.hasNode(`cluster:${item.node.groupId}`))
      graph.setParent(item.key, `cluster:${item.node.groupId}`);
  }
  for (const connection of connections.values())
    graph.setEdge(connection.source, connection.target, {}, connection.key);
  if (items.size) layout(graph);
  for (const item of items.values()) {
    const point = graph.node(item.key);
    item.x = point.x - item.width / 2;
    item.y = point.y - item.height / 2;
  }
  for (const connection of connections.values())
    connection.points = graph.edge({
      v: connection.source,
      w: connection.target,
      name: connection.key,
    }).points;
  const clusters = [...groupRecords.values()]
    .sort(compare)
    .filter((group) => graph.hasNode(`cluster:${group.id}`))
    .map((group) => {
      const box = graph.node(`cluster:${group.id}`);
      return {
        group,
        members: memberships.get(group.id)!,
        x: box.x - box.width / 2,
        y: box.y - box.height / 2,
        width: box.width,
        height: box.height,
      };
    });
  return {
    items: [...items.values()],
    connections: [...connections.values()],
    clusters,
    unavailable,
    width: graph.graph().width ?? 0,
    height: graph.graph().height ?? 0,
  };
}

/** Fold outgoing branches, preserving resources reachable through other open paths. */
export function foldDependencyBranches(
  nodes: readonly DependencyGraphNode[],
  edges: readonly DependencyGraphEdge[],
  collapsedNodeIds: readonly string[],
  anchorId?: string,
) {
  const graph = new graphlib.Graph({ directed: true });
  for (const node of nodes) graph.setNode(node.id);
  for (const edge of edges)
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target))
      graph.setEdge(edge.source, edge.target);
  const collapsed = new Set(collapsedNodeIds);
  // Cyclic components need one deterministic entry; do not seed every cycle member.
  const components = graphlib.alg.tarjan(graph).map((ids) => ids.sort());
  const componentOf = new Map<string, number>();
  components.forEach((ids, index) =>
    ids.forEach((id) => componentOf.set(id, index)),
  );
  const incoming = new Set<number>();
  for (const edge of graph.edges())
    if (componentOf.get(edge.v) !== componentOf.get(edge.w))
      incoming.add(componentOf.get(edge.w)!);
  const seeds = components.flatMap((ids, index) =>
    incoming.has(index)
      ? []
      : [
          (anchorId && ids.includes(anchorId) && anchorId) ||
            ids.find((id) => collapsed.has(id)) ||
            ids[0],
        ],
  );
  if (anchorId && graph.hasNode(anchorId)) seeds.push(anchorId);
  const reach = (stops: ReadonlySet<string>) => {
    const visible = new Set<string>();
    const queue = [...seeds];
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      if (visible.has(id)) continue;
      visible.add(id);
      if (!stops.has(id)) queue.push(...(graph.successors(id) ?? []));
    }
    return visible;
  };
  const visible = reach(collapsed);
  const hiddenCounts = new Map<string, number>();
  for (const id of collapsed) {
    const open = new Set(collapsed);
    open.delete(id);
    hiddenCounts.set(
      id,
      [...reach(open)].filter((id) => !visible.has(id)).length,
    );
  }
  const dependentCounts = new Map(
    nodes.map((node) => [
      node.id,
      (graph.successors(node.id) ?? []).filter((id) => id !== node.id).length,
    ]),
  );
  return { visible, hiddenCounts, dependentCounts };
}

/** Traverse only supplied directed edges. This computes visibility, never risk. */
export function visibleDependencyNodes(
  nodes: readonly DependencyGraphNode[],
  edges: readonly DependencyGraphEdge[],
  view: DependencyGraphView,
) {
  const records = new Set(nodes.map((node) => node.id));
  if (view.scope === "all") return records;
  const seeds =
    view.scope === "changes"
      ? nodes
          .filter(
            (node) =>
              node.change &&
              node.change !== "unchanged" &&
              node.change !== "unknown",
          )
          .map((node) => node.id)
          .concat(
            edges
              .filter(
                (edge) => edge.change === "add" || edge.change === "remove",
              )
              .flatMap((edge) => [edge.source, edge.target])
              .filter((id) => records.has(id)),
          )
      : records.has(view.nodeId)
        ? [view.nodeId]
        : [];
  const visible = new Set(seeds);
  const adjacency = new Map<string, string[]>();
  const add = (from: string, to: string) => {
    const neighbors = adjacency.get(from) ?? [];
    neighbors.push(to);
    adjacency.set(from, neighbors);
  };
  for (const edge of edges) {
    if (!records.has(edge.source) || !records.has(edge.target)) continue;
    if (view.scope !== "dependencies") add(edge.source, edge.target);
    if (view.scope !== "dependents") add(edge.target, edge.source);
  }
  const depth = Number.isFinite(view.depth)
    ? Math.max(0, Math.floor(view.depth!))
    : 1;
  let frontier = seeds;
  for (
    let hop = 0;
    hop < Math.min(depth, nodes.length) && frontier.length;
    hop++
  ) {
    const next: string[] = [];
    for (const id of frontier)
      for (const neighbor of adjacency.get(id) ?? [])
        if (!visible.has(neighbor)) {
          visible.add(neighbor);
          next.push(neighbor);
        }
    frontier = next;
  }
  return visible;
}

export const dependencyChangeLabels = {
  create: "Create",
  update: "Update",
  replace: "Replace",
  delete: "Delete",
  unchanged: "Unchanged",
  unknown: "Change unknown",
} as const;
