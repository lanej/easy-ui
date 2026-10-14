import {
  buildDependencyGraph,
  createDependencyGraphOrder,
  dependencyGraphLayoutKey,
} from "./model";
import {
  dependencyGraphClusters,
  dependencyGroupHierarchy,
  dependencyGroupError,
} from "./groups";
import {
  subgraphNodes as nodes,
  subgraphEdges as edges,
  subgraphGroups as groups,
} from "./DependencyGraph.groups.fixtures";
import type { DependencyGraphGroup } from "./types";

const contains = (
  outer: { x: number; y: number; width: number; height: number },
  inner: typeof outer,
) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;
const disjoint = (
  a: { x: number; y: number; width: number; height: number },
  b: typeof a,
) =>
  a.x + a.width <= b.x ||
  b.x + b.width <= a.x ||
  a.y + a.height <= b.y ||
  b.y + b.height <= a.y;

describe("DependencyGraph explicit subgraphs", () => {
  it("retains parent groups with only descendant members and encloses child headers", () => {
    const graph = buildDependencyGraph(nodes, edges, groups, []);
    expect(graph.clusters.map(({ group }) => group.id)).toEqual([
      "production",
      "database",
      "runtime",
    ]);
    const outer = graph.clusters.find(
      ({ group }) => group.id === "production",
    )!;
    expect(outer.members.map(({ id }) => id)).toEqual([
      "api",
      "db",
      "module",
      "user",
    ]);
    for (const child of graph.clusters.filter(({ group }) => group.parentId)) {
      expect(contains(outer, child)).toBe(true);
      expect(child.y - outer.y).toBeGreaterThanOrEqual(44);
      for (const member of graph.items.filter(
        (item) => item.node?.groupId === child.group.id,
      ))
        expect(contains(child, member)).toBe(true);
    }
    const children = graph.clusters.filter(({ group }) => group.parentId);
    expect(disjoint(children[0], children[1])).toBe(true);
    expect(graph.items.some((item) => item.node?.id === "audit")).toBe(true);
    expect(
      graph.connections
        .flatMap((connection) => connection.edges.map(({ id }) => id))
        .sort(),
    ).toEqual(edges.map(({ id }) => id).sort());
  });
  it("collapses an entire hierarchy once and preserves crossing edge evidence", () => {
    const graph = buildDependencyGraph(nodes, edges, groups, [
      "production",
      "runtime",
    ]);
    expect(graph.clusters).toEqual([]);
    expect(
      graph.items
        .find((item) => item.group?.id === "production")!
        .members.map(({ id }) => id),
    ).toEqual(["api", "db", "module", "user"]);
    expect(graph.items.filter((item) => item.group)).toHaveLength(1);
    expect(
      graph.connections
        .flatMap((connection) => connection.edges.map(({ id }) => id))
        .sort(),
    ).toEqual(["api-output", "image-api"]);
    const reopened = buildDependencyGraph(nodes, edges, groups, ["runtime"]);
    expect(reopened.clusters.map(({ group }) => group.id)).toEqual([
      "production",
      "database",
    ]);
    const proxy = reopened.items.find((item) => item.group?.id === "runtime")!;
    expect(contains(reopened.clusters[0], proxy)).toBe(true);
    expect(
      reopened.connections.find(
        (connection) =>
          connection.source === "node:db" &&
          connection.target === "group:runtime",
      )!.edges[0].id,
    ).toBe("db-api");
  });
  it("keeps mixed relationship states distinct at collapsed boundaries", () => {
    const links = [
      { id: "old", source: "image", target: "api", change: "remove" as const },
      { id: "new", source: "image", target: "module", change: "add" as const },
    ];
    const graph = buildDependencyGraph(nodes, links, groups, ["production"]);
    expect(graph.connections).toHaveLength(2);
    expect(
      graph.connections
        .flatMap((connection) => connection.edges)
        .map(({ id }) => id)
        .sort(),
    ).toEqual(["new", "old"]);
  });
  it("keeps disconnected members together without inventing dependencies", () => {
    const graph = buildDependencyGraph(nodes, [], groups, []);
    expect(graph.connections).toEqual([]);
    expect(graph.clusters).toHaveLength(3);
    expect(graph.clusters[0].members).toHaveLength(4);
  });
  it("omits empty groups and supports independent roots and ungrouped resources", () => {
    const flat = groups
      .filter(({ id }) => id !== "production")
      .map(({ id, label }) => ({ id, label }));
    const graph = buildDependencyGraph(
      nodes,
      edges,
      [...flat, { id: "empty", label: "Empty" }],
      [],
    );
    expect(graph.clusters.map(({ group }) => group.id)).toEqual([
      "database",
      "runtime",
    ]);
    expect(buildDependencyGraph(nodes, edges, [], []).clusters).toEqual([]);
    expect(
      dependencyGroupHierarchy(
        [{ id: "n", label: "N" }],
        [{ id: "", label: "Empty ID" }],
      ).members.size,
    ).toBe(0);
  });
  it("validates parent references and rejects cycles before layout", () => {
    expect(
      dependencyGroupError([{ id: "a", label: "A", parentId: "missing" }]),
    ).toBe("Unknown parent group ID: missing");
    expect(dependencyGroupError([{ id: "a", label: "A", parentId: "a" }])).toBe(
      "Cyclic group hierarchy: a",
    );
    expect(
      dependencyGroupError([
        { id: "a", label: "A", parentId: "b" },
        { id: "b", label: "B", parentId: "a" },
      ]),
    ).toContain("Cyclic group hierarchy");
    expect(dependencyGroupError(groups)).toBeUndefined();
  });
  it("supports deeper nesting and fits filtered child proxies bottom-up", () => {
    const deep: DependencyGraphGroup[] = [
      ...groups,
      { id: "users", label: "Users", parentId: "database" },
    ];
    const records = nodes.map((node) =>
      node.id === "user" ? { ...node, groupId: "users" } : node,
    );
    const hierarchy = dependencyGroupHierarchy(records, deep);
    expect(hierarchy.paths.get("users")).toEqual([
      "production",
      "database",
      "users",
    ]);
    const graph = buildDependencyGraph(records, edges, deep, ["users"]);
    const user = graph.items.find((item) => item.group?.id === "users")!;
    const clusters = dependencyGraphClusters(
      [user],
      hierarchy,
      new Set(["users"]),
    );
    expect(clusters.map(({ group }) => group.id)).toEqual([
      "production",
      "database",
    ]);
    expect(contains(clusters[0], clusters[1])).toBe(true);
    expect(contains(clusters[1], user)).toBe(true);
  });
  it("establishes deterministic order and invalidates it when parent membership changes", () => {
    const first = buildDependencyGraph(nodes, edges, groups, []);
    expect(
      buildDependencyGraph(
        [...nodes].reverse(),
        [...edges].reverse(),
        [...groups].reverse(),
        [],
      ),
    ).toEqual(first);
    expect(dependencyGraphLayoutKey(nodes, groups)).toBe(
      dependencyGraphLayoutKey([...nodes].reverse(), [...groups].reverse()),
    );
    expect(
      dependencyGraphLayoutKey(
        nodes,
        groups.map((group) => ({ ...group, parentId: undefined })),
      ),
    ).not.toBe(dependencyGraphLayoutKey(nodes, groups));
  });
  it("preserves axis order, containment, and non-overlap as cards expand and edges hide", () => {
    const order = createDependencyGraphOrder(nodes, edges, groups);
    const compact = buildDependencyGraph(
      nodes,
      edges,
      groups,
      [],
      new Map(),
      256,
      1,
      order,
    );
    const heights = new Map([
      ["api", 800],
      ["db", 400],
    ]);
    const expanded = buildDependencyGraph(
      nodes,
      edges,
      groups,
      [],
      heights,
      352,
      1,
      order,
    );
    const hidden = buildDependencyGraph(
      nodes,
      [],
      groups,
      [],
      heights,
      352,
      1,
      order,
    );
    expect(hidden.items).toEqual(expanded.items);
    expect(hidden.clusters).toEqual(expanded.clusters);
    for (const a of expanded.items)
      for (const b of expanded.items) {
        if (a.key === b.key) continue;
        const oldA = compact.items.find((item) => item.key === a.key)!;
        const oldB = compact.items.find((item) => item.key === b.key)!;
        expect(Math.sign(a.x - b.x)).toBe(Math.sign(oldA.x - oldB.x));
        expect(Math.sign(a.y - b.y)).toBe(Math.sign(oldA.y - oldB.y));
        expect(disjoint(a, b)).toBe(true);
      }
    const outer = expanded.clusters.find(
      ({ group }) => group.id === "production",
    )!;
    for (const child of expanded.clusters.filter(({ group }) => group.parentId))
      expect(contains(outer, child)).toBe(true);
    const children = expanded.clusters.filter(({ group }) => group.parentId);
    expect(disjoint(children[0], children[1])).toBe(true);
    for (const node of expanded.items.filter((item) => !item.node?.groupId))
      expect(disjoint(outer, node)).toBe(true);
    const folded = buildDependencyGraph(
      nodes,
      edges,
      groups,
      ["runtime"],
      new Map(),
      256,
      1,
      order,
    );
    expect(
      folded.items.every(
        (item) => Number.isFinite(item.x) && Number.isFinite(item.y),
      ),
    ).toBe(true);
    expect(
      buildDependencyGraph(nodes, edges, groups, [], new Map(), 256, 1, order),
    ).toEqual(compact);
  });
});
