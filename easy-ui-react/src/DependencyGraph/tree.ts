import { dependencyGroupHierarchy } from "./groups";
import { hasDependencyGraphChanges } from "./model";
import type {
  DependencyGraphEdge,
  DependencyGraphGroup,
  DependencyGraphNode,
} from "./types";

export type DependencyTreeEntry = {
  key: string;
  node?: DependencyGraphNode;
  group?: DependencyGraphGroup;
  reference?: "shared" | "cycle";
  children: DependencyTreeEntry[];
  /** Unique resources owned by this subtree, excluding linked references. */
  resourceCount: number;
  changedCount: number;
};

const compare = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** A presentation forest, never a new source of dependency or ownership evidence. */
export function buildDependencyTree(
  nodes: readonly DependencyGraphNode[],
  edges: readonly DependencyGraphEdge[],
  groups: readonly DependencyGraphGroup[],
  hierarchy: "groups" | "dependencies",
) {
  const sorted = [...nodes].sort(compare);
  const roots: DependencyTreeEntry[] = [];
  const entries = new Map<string, DependencyTreeEntry>();
  const parents = new Map<string, string>();
  const nodeEntry = (node: DependencyGraphNode): DependencyTreeEntry => ({
    key: `node:${node.id}`,
    node,
    children: [],
    resourceCount: 1,
    changedCount: hasDependencyGraphChanges(node) ? 1 : 0,
  });
  const append = (entry: DependencyTreeEntry, parent?: DependencyTreeEntry) => {
    entries.set(entry.key, entry);
    (parent?.children ?? roots).push(entry);
    if (parent) parents.set(entry.key, parent.key);
  };

  if (hierarchy === "groups") {
    const containment = dependencyGroupHierarchy(nodes, groups);
    const orderedGroups = [...groups].sort(
      (a, b) =>
        containment.paths.get(a.id)!.length -
          containment.paths.get(b.id)!.length || compare(a, b),
    );
    for (const group of orderedGroups) {
      if (!containment.members.get(group.id)?.length) continue;
      append(
        {
          key: `group:${group.id}`,
          group,
          children: [],
          resourceCount: 0,
          changedCount: 0,
        },
        entries.get(`group:${group.parentId}`),
      );
    }
    for (const node of sorted)
      append(nodeEntry(node), entries.get(`group:${node.groupId}`));
  } else {
    const records = new Map(sorted.map((node) => [node.id, node]));
    const incoming = new Set<string>();
    const outgoing = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!records.has(edge.source) || !records.has(edge.target)) continue;
      incoming.add(edge.target);
      const targets = outgoing.get(edge.source) ?? new Set<string>();
      targets.add(edge.target);
      outgoing.set(edge.source, targets);
    }
    const visited = new Set<string>();
    const active = new Set<string>();
    // An iterative DFS keeps long chains safe and gives every resource one
    // primary row. Additional paths and back edges become navigable leaves.
    for (const root of [
      ...sorted.filter((node) => !incoming.has(node.id)),
      ...sorted,
    ]) {
      if (visited.has(root.id)) continue;
      const pending: {
        node: DependencyGraphNode;
        parent?: DependencyTreeEntry;
        exit?: boolean;
      }[] = [{ node: root }];
      while (pending.length) {
        const { node, parent, exit } = pending.pop()!;
        if (exit) {
          active.delete(node.id);
          continue;
        }
        if (visited.has(node.id)) {
          append(
            {
              ...nodeEntry(node),
              key: `reference:${JSON.stringify([parent!.node!.id, node.id])}`,
              reference: active.has(node.id) ? "cycle" : "shared",
              resourceCount: 0,
              changedCount: 0,
            },
            parent,
          );
          continue;
        }
        visited.add(node.id);
        active.add(node.id);
        const entry = nodeEntry(node);
        append(entry, parent);
        pending.push({ node, exit: true });
        for (const target of [...(outgoing.get(node.id) ?? [])]
          .sort()
          .reverse())
          pending.push({ node: records.get(target)!, parent: entry });
      }
    }
  }

  // Children were inserted after parents, so reverse insertion order is postorder.
  for (const entry of [...entries.values()].reverse()) {
    const parent = entries.get(parents.get(entry.key)!);
    if (parent) {
      parent.resourceCount += entry.resourceCount;
      parent.changedCount += entry.changedCount;
    }
  }
  return { roots, entries, parents };
}

export type DependencyTreeModel = ReturnType<typeof buildDependencyTree>;

export function dependencyTreeAncestors(
  tree: DependencyTreeModel,
  key: string,
) {
  const ancestors: DependencyTreeEntry[] = [];
  let parent = tree.parents.get(key);
  while (parent !== undefined) {
    ancestors.push(tree.entries.get(parent)!);
    parent = tree.parents.get(parent);
  }
  return ancestors;
}

export function dependencyTreeVisibleNodes(
  tree: DependencyTreeModel,
  collapsedGroups: readonly string[],
  collapsedNodes: readonly string[],
) {
  const visible = new Set<string>();
  const pending = [...tree.roots];
  const groups = new Set(collapsedGroups);
  const nodes = new Set(collapsedNodes);
  while (pending.length) {
    const entry = pending.pop()!;
    if (entry.node && !entry.reference) visible.add(entry.node.id);
    const folded = entry.group
      ? groups.has(entry.group.id)
      : nodes.has(entry.node!.id);
    if (!folded) pending.push(...entry.children);
  }
  return visible;
}
