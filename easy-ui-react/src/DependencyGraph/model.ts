import { graphlib, layout } from "@dagrejs/dagre";
import {
  collapsedDependencyGroup,
  dependencyGraphClusters,
  dependencyGroupHierarchy,
} from "./groups";
import type {
  DependencyGraphEdge,
  DependencyGraphGroup,
  DependencyGraphNode,
  DependencyGraphView,
} from "./types";

export const NODE_WIDTH = 256;
export const NODE_HEIGHT = 52;
const GROUP_HEIGHT = 96;
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

type LayoutBox = Pick<GraphItem, "x" | "y" | "width" | "height">;

export type GraphLayoutOrder = {
  boxes: ReadonlyMap<string, LayoutBox>;
  groupBounds: ReadonlyMap<string, LayoutBox>;
  width: number;
  height: number;
};

/** Presentation changes keep this identity; a new resource set can get a new layout. */
export function dependencyGraphLayoutKey(
  nodes: readonly DependencyGraphNode[],
  groups: readonly DependencyGraphGroup[],
  revision?: string | number,
) {
  return JSON.stringify([
    revision ?? null,
    [...nodes].sort(compare).map((node) => [node.id, node.groupId ?? null]),
    [...groups]
      .sort(compare)
      .map((group) => [group.id, group.parentId ?? null]),
  ]);
}

/** Establish ordering from the full topology, independently of card expansion. */
export function createDependencyGraphOrder(
  nodes: readonly DependencyGraphNode[],
  edges: readonly DependencyGraphEdge[],
  groups: readonly DependencyGraphGroup[],
): GraphLayoutOrder {
  const graph = buildDependencyGraph(
    nodes,
    edges,
    groups,
    [],
    new Map(nodes.map((node) => [node.id, NODE_HEIGHT])),
    NODE_WIDTH,
    // Only group headings need minimum-zoom clearance. Ungrouped source graphs
    // start at detail density; preserving order must not preserve overview gaps.
    groups.some((group) => nodes.some((node) => node.groupId === group.id))
      ? 0.4
      : 1,
  );
  const boxes = new Map(graph.items.map((item) => [item.key, item]));
  for (const cluster of graph.clusters) {
    const memberIds = new Set(cluster.members.map((node) => node.id));
    const members = graph.items.filter((item) => memberIds.has(item.node!.id));
    const x = Math.min(...members.map((item) => item.x));
    const y = Math.min(...members.map((item) => item.y));
    boxes.set(`group:${cluster.group.id}`, {
      key: `group:${cluster.group.id}`,
      members: cluster.members,
      x,
      y,
      width: Math.max(...members.map((item) => item.x + item.width)) - x,
      height: Math.max(...members.map((item) => item.y + item.height)) - y,
    });
  }
  return {
    boxes,
    groupBounds: new Map(
      graph.clusters.map((cluster) => [cluster.group.id, cluster]),
    ),
    width: graph.width + 64,
    height: graph.height + 64,
  };
}

type LayoutSpacing = { start: number; end: number; span: number };

/** A monotone coordinate map preserves ordering while making room for content. */
function spaceLayoutAxis(coordinates: number[], constraints: LayoutSpacing[]) {
  const sorted = [...new Set(coordinates)].sort((a, b) => a - b);
  const ending = new Map<number, LayoutSpacing[]>();
  for (const constraint of constraints) {
    const list = ending.get(constraint.end) ?? [];
    list.push(constraint);
    ending.set(constraint.end, list);
  }
  const positions = new Map<number, number>();
  let previous = 0;
  let position = 0;
  for (const coordinate of sorted) {
    position += coordinate - previous;
    for (const constraint of ending.get(coordinate) ?? [])
      position = Math.max(
        position,
        positions.get(constraint.start)! + constraint.span,
      );
    positions.set(coordinate, position);
    previous = coordinate;
  }
  return positions;
}

/** Sort stable IDs before layout so caller reordering cannot move the graph. */
export function buildDependencyGraph(
  nodes: readonly DependencyGraphNode[],
  edges: readonly DependencyGraphEdge[],
  groups: readonly DependencyGraphGroup[],
  collapsedGroupIds: readonly string[],
  nodeHeights: ReadonlyMap<string, number> = new Map(),
  nodeWidth: number | ReadonlyMap<string, number> = NODE_WIDTH,
  zoom = 1,
  order?: GraphLayoutOrder,
) {
  const records = new Map(nodes.map((node) => [node.id, node]));
  const hierarchy = dependencyGroupHierarchy(nodes, groups);
  const groupRecords = hierarchy.records;
  const collapsed = new Set(collapsedGroupIds);
  const nodeKey = (node: DependencyGraphNode) => {
    const groupId = collapsedDependencyGroup(node, hierarchy, collapsed);
    return groupId === undefined ? `node:${node.id}` : `group:${groupId}`;
  };
  const items = new Map<string, GraphItem>();
  for (const node of [...records.values()].sort(compare)) {
    const key = nodeKey(node);
    const previous = items.get(key);
    if (previous) (previous.members as DependencyGraphNode[]).push(node);
    else
      items.set(key, {
        key,
        node: key.startsWith("node:") ? node : undefined,
        group: key.startsWith("group:")
          ? groupRecords.get(
              collapsedDependencyGroup(node, hierarchy, collapsed)!,
            )
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
            NODE_HEIGHT + (hasDependencyGraphChanges(node) ? 31 : 2))
          : Math.max(GROUP_HEIGHT, 64 + 25 / zoom),
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
  if (order) {
    const current = [...items.values()];
    // Expand spacing along the original axes without rerunning Dagre's ordering.
    // Horizontal interval constraints keep wider cards in their original columns.
    const x = spaceLayoutAxis(
      [...order.boxes.values()].flatMap((box) => [box.x, box.x + box.width]),
      current.map((item) => {
        const box = order.boxes.get(item.key)!;
        return { start: box.x, end: box.x + box.width, span: item.width };
      }),
    );
    const constraints: LayoutSpacing[] = [];
    for (const upper of current) {
      const a = order.boxes.get(upper.key)!;
      for (const lower of current) {
        const b = order.boxes.get(lower.key)!;
        if (a.y + a.height > b.y) continue;
        const upperPath =
          hierarchy.paths.get(
            (upper.node ? upper.node.groupId : upper.group?.id)!,
          ) ?? [];
        const lowerPath =
          hierarchy.paths.get(
            (lower.node ? lower.node.groupId : lower.group?.id)!,
          ) ?? [];
        // Separate the outermost non-shared containers, not only immediate groups.
        const upperGroup = upperPath.find((id) => !lowerPath.includes(id));
        const lowerGroup = lowerPath.find((id) => !upperPath.includes(id));
        const left =
          upperGroup === undefined
            ? a
            : (order.groupBounds.get(upperGroup) ?? a);
        const right =
          lowerGroup === undefined
            ? b
            : (order.groupBounds.get(lowerGroup) ?? b);
        if (left.x < right.x + right.width && right.x < left.x + left.width)
          constraints.push({
            start: a.y,
            end: b.y,
            span: upper.height + b.y - a.y - a.height,
          });
      }
    }
    const y = spaceLayoutAxis(
      [...order.boxes.values()].map((box) => box.y),
      constraints,
    );
    for (const item of current) {
      const box = order.boxes.get(item.key)!;
      item.x = x.get(box.x)!;
      item.y = y.get(box.y)!;
    }
    const clusters = dependencyGraphClusters(
      current,
      hierarchy,
      collapsed,
      zoom,
    );
    return {
      items: [...items.values()],
      connections: [...connections.values()],
      clusters,
      unavailable,
      width: Math.max(
        order.width,
        ...[...current, ...clusters].map((item) => item.x + item.width + 64),
      ),
      height: Math.max(
        order.height,
        ...[...current, ...clusters].map((item) => item.y + item.height + 64),
      ),
    };
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
    if (
      !hierarchy.paths.get(group.id)!.some((id) => collapsed.has(id)) &&
      hierarchy.members.has(group.id)
    )
      graph.setNode(`cluster:${group.id}`, { label: group.label });
  }
  for (const group of [...groupRecords.values()].sort(compare)) {
    if (
      graph.hasNode(`cluster:${group.id}`) &&
      group.parentId !== undefined &&
      graph.hasNode(`cluster:${group.parentId}`)
    )
      graph.setParent(`cluster:${group.id}`, `cluster:${group.parentId}`);
  }
  for (const item of items.values()) {
    graph.setNode(item.key, { width: item.width, height: item.height });
    const parentId = item.node ? item.node.groupId : item.group?.parentId;
    if (parentId !== undefined && graph.hasNode(`cluster:${parentId}`))
      graph.setParent(item.key, `cluster:${parentId}`);
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
  const clusters = dependencyGraphClusters(
    [...items.values()],
    hierarchy,
    collapsed,
    zoom,
  );
  // Nested headings may extend above Dagre's leaf boxes. Reserve their full
  // bounds in the initial coordinate system, before that order is frozen.
  const dx = Math.max(0, 28 - Math.min(...clusters.map((box) => box.x)));
  const dy = Math.max(0, 28 - Math.min(...clusters.map((box) => box.y)));
  for (const box of [...items.values(), ...clusters]) {
    box.x += dx;
    box.y += dy;
  }
  for (const connection of connections.values())
    connection.points = connection.points.map((point) => ({
      x: point.x + dx,
      y: point.y + dy,
    }));

  return {
    items: [...items.values()],
    connections: [...connections.values()],
    clusters,
    unavailable,
    width: Math.max(
      graph.graph().width ?? 0,
      ...[...items.values(), ...clusters].map((box) => box.x + box.width + 28),
    ),
    height: Math.max(
      graph.graph().height ?? 0,
      ...[...items.values(), ...clusters].map((box) => box.y + box.height + 28),
    ),
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
                (edge) =>
                  edge.change === "add" ||
                  edge.change === "remove" ||
                  edge.change === "update",
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
