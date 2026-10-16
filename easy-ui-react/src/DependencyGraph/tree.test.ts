import {
  buildDependencyTree,
  dependencyTreeAncestors,
  dependencyTreeVisibleNodes,
} from "./tree";
import type { DependencyGraphNode, DependencyGraphEdge } from "./types";

const nodes: DependencyGraphNode[] = [
  { id: "a", label: "Network" },
  { id: "b", label: "Database", change: "update" },
  { id: "c", label: "Identity", change: "unknown" },
  {
    id: "d",
    label: "API",
    changes: [{ path: "image", type: "add", after: "v2" }],
  },
  { id: "e", label: "Disconnected" },
];
const edges: DependencyGraphEdge[] = [
  { id: "ab", source: "a", target: "b" },
  { id: "ac", source: "a", target: "c" },
  { id: "bd", source: "b", target: "d" },
  { id: "cd", source: "c", target: "d" },
  { id: "cd2", source: "c", target: "d", change: "remove" },
  { id: "db", source: "d", target: "b" },
  { id: "missing", source: "e", target: "missing" },
];

it("represents shared paths and cycles as references without duplicating subtrees", () => {
  const tree = buildDependencyTree(nodes, edges, [], "dependencies");
  const entries = [...tree.entries.values()];
  expect(
    entries
      .filter((entry) => !entry.reference)
      .map((entry) => entry.node!.id)
      .sort(),
  ).toEqual(nodes.map((node) => node.id));
  expect(
    entries
      .filter((entry) => entry.reference)
      .map((entry) => [entry.node!.id, entry.reference]),
  ).toEqual([
    ["b", "cycle"],
    ["d", "shared"],
  ]);
  expect(tree.entries.get("node:a")).toMatchObject({
    resourceCount: 4,
    changedCount: 2,
  });
  expect(tree.roots.map((entry) => entry.node!.id)).toEqual(["a", "e"]);
  expect(
    dependencyTreeAncestors(tree, "node:d").map((entry) => entry.node!.id),
  ).toEqual(["b", "a"]);
  expect(
    buildDependencyTree(
      [...nodes].reverse(),
      [...edges].reverse(),
      [],
      "dependencies",
    ).roots,
  ).toEqual(tree.roots);
});

it("folds only the primary subtree and retains other references", () => {
  const tree = buildDependencyTree(nodes, edges, [], "dependencies");
  expect([...dependencyTreeVisibleNodes(tree, [], ["b"])].sort()).toEqual([
    "a",
    "b",
    "c",
    "e",
  ]);
  expect(tree.entries.get('reference:["c","d"]')?.node?.id).toBe("d");
});

it("handles a rootless cycle, a self-loop, and a long chain without dropping resources", () => {
  const cyclic = buildDependencyTree(
    nodes.slice(0, 2),
    [
      { id: "ab", source: "a", target: "b" },
      { id: "ba", source: "b", target: "a" },
      { id: "aa", source: "a", target: "a" },
    ],
    [],
    "dependencies",
  );
  expect(cyclic.roots).toHaveLength(1);
  expect(cyclic.roots[0].resourceCount).toBe(2);
  expect(
    [...cyclic.entries.values()].filter((entry) => entry.reference === "cycle"),
  ).toHaveLength(2);
  const chain = Array.from({ length: 3000 }, (_, i) => ({
    id: String(i).padStart(4, "0"),
    label: String(i),
  }));
  const tree = buildDependencyTree(
    chain,
    chain.slice(1).map((node, i) => ({
      id: node.id,
      source: chain[i].id,
      target: node.id,
    })),
    [],
    "dependencies",
  );
  expect(tree.roots[0].resourceCount).toBe(3000);
});

it("uses explicit nested groups and keeps ungrouped resources at the root", () => {
  const tree = buildDependencyTree(
    nodes.map((node) => ({
      ...node,
      groupId: node.id === "e" ? "missing" : "child",
    })),
    edges,
    [
      { id: "root", label: "Root" },
      { id: "child", label: "Child", parentId: "root" },
      { id: "empty", label: "Empty" },
    ],
    "groups",
  );
  expect(tree.roots.map((entry) => entry.key)).toEqual([
    "group:root",
    "node:e",
  ]);
  expect(tree.entries.get("group:root")).toMatchObject({
    resourceCount: 4,
    changedCount: 2,
  });
  expect([...dependencyTreeVisibleNodes(tree, ["root"], [])]).toEqual(["e"]);
  expect(
    dependencyTreeAncestors(tree, "node:d").map((entry) => entry.key),
  ).toEqual(["group:child", "group:root"]);
});
