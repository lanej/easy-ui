import { buildDependencyGraph, visibleDependencyNodes } from "./model";
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
