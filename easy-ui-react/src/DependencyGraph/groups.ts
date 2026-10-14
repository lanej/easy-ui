import type { GraphItem } from "./model";
import type { DependencyGraphGroup, DependencyGraphNode } from "./types";

const compare = (a: DependencyGraphGroup, b: DependencyGraphGroup) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Explicit containment only; membership never introduces dependency edges. */
export function dependencyGroupHierarchy(
  nodes: readonly DependencyGraphNode[],
  groups: readonly DependencyGraphGroup[],
) {
  const records = new Map<string, DependencyGraphGroup>();
  for (const group of groups) {
    if (records.has(group.id))
      throw new Error(`Duplicate group ID: ${group.id}`);
    records.set(group.id, group);
  }
  const paths = new Map<string, readonly string[]>();
  for (const group of [...groups].sort(compare)) {
    const pending: string[] = [];
    const visited = new Set<string>();
    let id: string | undefined = group.id;
    while (id !== undefined && !paths.has(id)) {
      if (visited.has(id)) throw new Error(`Cyclic group hierarchy: ${id}`);
      const record = records.get(id);
      if (!record) throw new Error(`Unknown parent group ID: ${id}`);
      visited.add(id);
      pending.push(id);
      id = record.parentId;
    }
    let path = id === undefined ? [] : paths.get(id)!;
    for (const child of pending.reverse()) {
      path = [...path, child];
      paths.set(child, path);
    }
  }
  const members = new Map<string, DependencyGraphNode[]>();
  for (const node of [...nodes].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    // Omitting a group's definition leaves its resources ungrouped. This also
    // permits applications to turn grouping off without rewriting every node.
    for (const id of paths.get(node.groupId!) ?? []) {
      const list = members.get(id) ?? [];
      list.push(node);
      members.set(id, list);
    }
  }
  return { records, paths, members };
}

export type DependencyGroupHierarchy = ReturnType<
  typeof dependencyGroupHierarchy
>;

export function dependencyGroupError(groups: readonly DependencyGraphGroup[]) {
  try {
    dependencyGroupHierarchy([], groups);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid group hierarchy";
  }
}

/** The outermost collapsed ancestor owns the visible proxy. */
export function collapsedDependencyGroup(
  node: DependencyGraphNode,
  hierarchy: DependencyGroupHierarchy,
  collapsed: ReadonlySet<string>,
) {
  return (hierarchy.paths.get(node.groupId!) ?? []).find((id) =>
    collapsed.has(id),
  );
}

type Box = Pick<GraphItem, "x" | "y" | "width" | "height">;
export type DependencyGraphCluster = Box & {
  group: DependencyGraphGroup;
  members: readonly DependencyGraphNode[];
};

/** Fit children bottom-up, including child headings and collapsed child cards. */
export function dependencyGraphClusters(
  items: readonly GraphItem[],
  hierarchy: DependencyGroupHierarchy,
  collapsed: ReadonlySet<string>,
  zoom = 1,
): DependencyGraphCluster[] {
  const children = new Map<string, Box[]>();
  const append = (id: string | undefined, box: Box) => {
    if (id === undefined || !hierarchy.records.has(id)) return;
    const list = children.get(id) ?? [];
    list.push(box);
    children.set(id, list);
  };
  const visible = new Set(
    items.flatMap((item) => item.members.map((node) => node.id)),
  );
  for (const item of items)
    append(item.node ? item.node.groupId : item.group?.parentId, item);
  const groups = [...hierarchy.records.values()].sort(
    (a, b) =>
      hierarchy.paths.get(b.id)!.length - hierarchy.paths.get(a.id)!.length ||
      compare(a, b),
  );
  const clusters: DependencyGraphCluster[] = [];
  for (const group of groups) {
    if (hierarchy.paths.get(group.id)!.some((id) => collapsed.has(id)))
      continue;
    const boxes = children.get(group.id);
    if (!boxes?.length) continue;
    const x = Math.min(...boxes.map((box) => box.x)) - 16;
    const y =
      Math.min(...boxes.map((box) => box.y)) - Math.max(44, 25 / zoom + 8);
    const cluster = {
      group,
      members: (hierarchy.members.get(group.id) ?? []).filter((node) =>
        visible.has(node.id),
      ),
      x,
      y,
      width: Math.max(...boxes.map((box) => box.x + box.width)) - x + 16,
      height: Math.max(...boxes.map((box) => box.y + box.height)) - y + 16,
    };
    clusters.push(cluster);
    append(group.parentId, cluster);
  }
  // Paint outer boundaries first so they cannot cover a child's controls.
  return clusters.sort(
    (a, b) =>
      hierarchy.paths.get(a.group.id)!.length -
        hierarchy.paths.get(b.group.id)!.length || compare(a.group, b.group),
  );
}
