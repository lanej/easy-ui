import {
  buildDependencyGraph,
  visibleDependencyNodes,
  foldDependencyBranches,
} from "./model";
import type { DependencyGraphNode, DependencyGraphEdge } from "./types";

const nodes: DependencyGraphNode[] = [
  { id: "network", label: "Network", groupId: "net" },
  { id: "subnet", label: "Subnet", groupId: "net", change: "replace" },
  { id: "api", label: "API", groupId: "app" },
  { id: "worker", label: "Worker", groupId: "app" },
  { id: "alert", label: "Alert" },
];
const edges: DependencyGraphEdge[] = [
  { id: "network-subnet", source: "network", target: "subnet" },
  { id: "subnet-api", source: "subnet", target: "api" },
  { id: "subnet-worker", source: "subnet", target: "worker" },
  { id: "api-alert", source: "api", target: "alert" },
];
const groups = [
  { id: "net", label: "Network" },
  { id: "app", label: "Application" },
];

describe("DependencyGraph directed exploration", () => {
  it("distinguishes prerequisites from dependents and grows from the same anchor", () => {
    expect([
      ...visibleDependencyNodes(nodes, edges, {
        scope: "dependencies",
        nodeId: "subnet",
      }),
    ]).toEqual(["subnet", "network"]);
    expect([
      ...visibleDependencyNodes(nodes, edges, {
        scope: "dependents",
        nodeId: "subnet",
      }),
    ]).toEqual(["subnet", "api", "worker"]);
    expect(
      visibleDependencyNodes(nodes, edges, {
        scope: "dependents",
        nodeId: "subnet",
        depth: 2,
      }).has("alert"),
    ).toBe(true);
  });
  it("honors a zero-depth changed-only view and never invents unavailable resources", () => {
    expect([
      ...visibleDependencyNodes(nodes, edges, { scope: "changes", depth: 0 }),
    ]).toEqual(["subnet"]);
    expect(
      visibleDependencyNodes(
        nodes,
        [...edges, { id: "missing", source: "subnet", target: "unknown" }],
        { scope: "neighbors", nodeId: "subnet", depth: 100 },
      ).has("unknown"),
    ).toBe(false);
    expect(
      visibleDependencyNodes(nodes, edges, {
        scope: "neighbors",
        nodeId: "unknown",
      }).size,
    ).toBe(0);
  });
  it("terminates through cycles without dropping relationships or reversing input", () => {
    const cyclic = [
      ...edges,
      { id: "cycle", source: "alert", target: "subnet" },
      { id: "self", source: "api", target: "api" },
    ];
    expect(
      visibleDependencyNodes(nodes, cyclic, {
        scope: "neighbors",
        nodeId: "subnet",
        depth: 100,
      }).size,
    ).toBe(5);
    const graph = buildDependencyGraph(nodes, cyclic, [], []);
    expect(
      graph.connections
        .flatMap((item) => item.edges.map((edge) => edge.id))
        .sort(),
    ).toEqual(cyclic.map((edge) => edge.id).sort());
    expect(
      graph.connections.every((item) =>
        item.points.every(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
        ),
      ),
    ).toBe(true);
  });
});

describe("DependencyGraph grouping and layout", () => {
  it("routes around measured card heights without overlapping another resource", () => {
    const graph = buildDependencyGraph(
      nodes,
      edges,
      groups,
      [],
      new Map([
        ["subnet", 800],
        ["api", 300],
      ]),
    );
    expect(graph.items.find((item) => item.node?.id === "subnet")!.height).toBe(
      800,
    );
    for (const a of graph.items)
      for (const b of graph.items) {
        if (a.key === b.key) continue;
        expect(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        ).toBe(true);
      }
    expect(
      graph.connections.every((connection) =>
        connection.points.every(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
        ),
      ),
    ).toBe(true);
  });
  it("bundles cross-group relationships with exact original IDs and retains group members", () => {
    const graph = buildDependencyGraph(nodes, edges, groups, ["net", "app"]);
    expect(
      graph.items
        .find((item) => item.group?.id === "net")!
        .members.map((node) => node.id),
    ).toEqual(["network", "subnet"]);
    expect(
      graph.connections
        .find(
          (item) => item.source === "group:net" && item.target === "group:app",
        )!
        .edges.map((edge) => edge.id),
    ).toEqual(["subnet-api", "subnet-worker"]);
    expect(graph.items).toHaveLength(3);
  });
  it("produces identical coordinates when input records are reordered", () => {
    const first = buildDependencyGraph(nodes, edges, groups, []);
    const reordered = buildDependencyGraph(
      [...nodes].reverse(),
      [...edges].reverse(),
      [...groups].reverse(),
      [],
    );
    expect(reordered).toEqual(first);
    const boxes = first.items;
    for (const a of boxes)
      for (const b of boxes) {
        if (a.key === b.key) continue;
        expect(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        ).toBe(true);
      }
  });
  it("exposes unresolved edges without laying out synthetic endpoints", () => {
    const missing = { id: "missing", source: "subnet", target: "other-root" };
    const graph = buildDependencyGraph(nodes, [...edges, missing], groups, []);
    expect(graph.unavailable).toEqual([missing]);
    expect(graph.items.some((item) => item.node?.id === "other-root")).toBe(
      false,
    );
  });
});

describe("DependencyGraph branch folding", () => {
  it("folds a tree and reopens the same original resources", () => {
    const folded = foldDependencyBranches(nodes, edges, ["subnet"]);
    expect([...folded.visible].sort()).toEqual(["network", "subnet"]);
    expect(folded.hiddenCounts.get("subnet")).toBe(3);
    expect(foldDependencyBranches(nodes, edges, []).visible.size).toBe(
      nodes.length,
    );
  });
  it("retains a shared dependent through another open branch", () => {
    const diamond = [
      ...edges,
      { id: "worker-alert", source: "worker", target: "alert" },
    ];
    const folded = foldDependencyBranches(nodes, diamond, ["api"]);
    expect(folded.visible.has("alert")).toBe(true);
    expect(folded.hiddenCounts.get("api")).toBe(0);
  });
  it("handles disconnected cycles, self-links, and missing endpoints without inventing nodes", () => {
    const records = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ];
    const links = [
      { id: "a-b", source: "a", target: "b" },
      { id: "b-a", source: "b", target: "a" },
      { id: "self", source: "c", target: "c" },
      { id: "missing", source: "b", target: "unknown" },
    ];
    const folded = foldDependencyBranches(records, links, ["b"]);
    expect([...folded.visible].sort()).toEqual(["b", "c"]);
    expect(folded.hiddenCounts.get("b")).toBe(1);
    expect(foldDependencyBranches(records, links, []).visible.size).toBe(3);
  });
  it("keeps the neighborhood anchor reachable through nested folds", () => {
    const folded = foldDependencyBranches(
      nodes,
      edges,
      ["network", "api"],
      "subnet",
    );
    expect([...folded.visible].sort()).toEqual([
      "api",
      "network",
      "subnet",
      "worker",
    ]);
    expect(folded.hiddenCounts.get("api")).toBe(1);
  });
});

it("preserves separate added and removed links when collapsing endpoints into groups", () => {
  const links: DependencyGraphEdge[] = [
    { id: "old", source: "subnet", target: "api", change: "remove" },
    { id: "new", source: "subnet", target: "api", change: "add" },
    { id: "other-add", source: "subnet", target: "worker", change: "add" },
  ];
  const graph = buildDependencyGraph(nodes, links, groups, ["net", "app"]);
  expect(graph.connections).toHaveLength(2);
  expect(
    graph.connections
      .map((connection) => connection.edges.map((edge) => edge.id).sort())
      .sort(),
  ).toEqual([["new", "other-add"], ["old"]]);
});
it.each(["add", "remove", "update"] as const)(
  "includes endpoints of %s links in changes scope with unchanged resources",
  (change) => {
    expect(
      [
        ...visibleDependencyNodes(
          [
            { id: "a", label: "A", change: "unchanged" },
            { id: "b", label: "B", change: "unchanged" },
          ],
          [{ id: "link", source: "a", target: "b", change }],
          { scope: "changes", depth: 0 },
        ),
      ].sort(),
    ).toEqual(["a", "b"]);
  },
);
