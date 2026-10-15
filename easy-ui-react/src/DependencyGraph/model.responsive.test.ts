import {
  buildDependencyGraph,
  createDependencyGraphOrder,
  dependencyGraphExpandedWidth,
} from "./model";
import {
  wideDependencyNodes as nodes,
  wideDependencyEdges as edges,
  deepDependencyEdges,
} from "./DependencyGraph.responsive.fixtures";

describe("DependencyGraph viewport width allocation", () => {
  it("uses spare width for shallow graph cards without stretching edge gaps", () => {
    const order = createDependencyGraphOrder(nodes, edges, []);
    const width = dependencyGraphExpandedWidth(order, nodes, 2048);
    expect(width).toBeGreaterThan(800);
    const graph = buildDependencyGraph(
      nodes,
      edges,
      [],
      [],
      new Map(),
      width,
      1,
      order,
    );
    expect(graph.width).toBeLessThanOrEqual(2048);
    expect(graph.width).toBeGreaterThan(2000);
    const root = graph.items.find((item) => item.node?.id === "network")!;
    const child = graph.items.find((item) => item.node?.id === "service-1")!;
    expect(child.x - root.x - root.width).toBe(88);
    expect(new Set(graph.items.slice(1).map((item) => item.x)).size).toBe(1);
  });

  it("keeps deep chains readable instead of squeezing them into the viewport", () => {
    const order = createDependencyGraphOrder(nodes, deepDependencyEdges, []);
    expect(dependencyGraphExpandedWidth(order, nodes, 2048)).toBe(352);
  });

  it("budgets operation-only disclosures alongside supplied attribute differences", () => {
    const mixed = [
      nodes[0],
      { id: "service", label: "New service", change: "create" as const },
    ];
    const links = [
      { id: "network-service", source: "network", target: "service" },
    ];
    const order = createDependencyGraphOrder(mixed, links, []);
    const width = dependencyGraphExpandedWidth(order, mixed, 1440);
    const expanded = buildDependencyGraph(
      mixed,
      links,
      [],
      [],
      new Map(),
      width,
      1,
      order,
    );
    expect(width).toBeGreaterThan(352);
    expect(expanded.width).toBeLessThanOrEqual(1440);
  });

  it("responds to viewport width deterministically and bounds single-card reading width", () => {
    const order = createDependencyGraphOrder(nodes, edges, []);
    const widths = [320, 390, 1024, 1440, 2048].map((width) =>
      dependencyGraphExpandedWidth(order, nodes, width),
    );
    expect(widths[0]).toBe(272);
    expect(widths[1]).toBe(342);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(
      dependencyGraphExpandedWidth(order, [...nodes].reverse(), 2048),
    ).toBe(widths[4]);
    expect(dependencyGraphExpandedWidth(order, nodes, 10000)).toBe(960);
    expect(dependencyGraphExpandedWidth(order, nodes, 0)).toBe(240);
    expect(dependencyGraphExpandedWidth(order, nodes, NaN)).toBe(352);
  });

  it("accounts for nested group boundaries without changing membership", () => {
    const groups = [
      { id: "root", label: "Root" },
      { id: "module", label: "Module", parentId: "root" },
    ];
    const grouped = nodes.map((node) => ({ ...node, groupId: "module" }));
    const order = createDependencyGraphOrder(grouped, edges, groups);
    const width = dependencyGraphExpandedWidth(order, grouped, 2048);
    const graph = buildDependencyGraph(
      grouped,
      edges,
      groups,
      [],
      new Map(),
      width,
      1,
      order,
    );
    expect(width).toBeGreaterThan(352);
    expect(graph.width).toBeLessThanOrEqual(2048);
    expect(graph.clusters.map((group) => group.group.id)).toEqual([
      "root",
      "module",
    ]);
    const folded = buildDependencyGraph(
      grouped,
      edges,
      groups,
      ["root"],
      new Map(),
      width,
      1,
      order,
    );
    expect(folded.items[0].members).toHaveLength(nodes.length);
  });
});
