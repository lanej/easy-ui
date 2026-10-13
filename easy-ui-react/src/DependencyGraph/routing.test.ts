import {
  attributePortKey,
  routeDependencyConnections,
  roundedConnectionPath,
} from "./routing";
import { buildDependencyGraph } from "./model";
import type { GraphItem, GraphConnection } from "./model";
const item = (
  id: string,
  x: number,
  y: number,
  width = 240,
  height = 160,
): GraphItem => ({
  key: `node:${id}`,
  node: { id, label: id },
  members: [{ id, label: id }],
  x,
  y,
  width,
  height,
});
const edge = (
  id: string,
  source: string,
  target: string,
  paths = {},
): GraphConnection => ({
  key: id,
  source: `node:${source}`,
  target: `node:${target}`,
  edges: [{ id, source, target, ...paths }],
  points: [],
});
function expectClear(points: { x: number; y: number }[], items: GraphItem[]) {
  expect(points.length).toBeGreaterThan(1);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    expect(a.x === b.x || a.y === b.y).toBe(true);
    for (const box of items) {
      const inside =
        a.x === b.x
          ? a.x > box.x &&
            a.x < box.x + box.width &&
            Math.max(a.y, b.y) > box.y &&
            Math.min(a.y, b.y) < box.y + box.height
          : a.y > box.y &&
            a.y < box.y + box.height &&
            Math.max(a.x, b.x) > box.x &&
            Math.min(a.x, b.x) < box.x + box.width;
      expect(inside).toBe(false);
    }
  }
}
it("keeps straight endpoints and avoids an intervening card with orthogonal lanes", () => {
  const nodes = [
    item("a", 28, 80),
    item("b", 700, 80),
    item("barrier", 350, 20, 240, 260),
  ];
  const route = routeDependencyConnections(nodes, [edge("a-b", "a", "b")])[0];
  expect(route.points[0]).toEqual({ x: 268, y: 106 });
  expect(route.points[route.points.length - 1]).toEqual({ x: 700, y: 106 });
  expectClear(route.points, nodes);
  expect(roundedConnectionPath(route.points)).toContain("Q");
});
it("anchors to supplied visible fields, then falls back to the card when fields disappear", () => {
  const nodes = [item("a", 28, 80, 240, 500), item("b", 600, 80, 352, 600)];
  const links = [
    edge("field", "a", "b", {
      sourceAttributePath: "output.id",
      targetAttributePath: "network_id",
    }),
  ];
  const ports = new Map([
    [attributePortKey("a", "output.id"), 180],
    [attributePortKey("b", "network_id"), 320],
  ]);
  const anchored = routeDependencyConnections(nodes, links, ports)[0];
  expect(anchored.points[0]).toEqual({ x: 268, y: 260 });
  expect(anchored.points[anchored.points.length - 1]).toEqual({
    x: 600,
    y: 400,
  });
  expect(anchored.targetAttribute).toBe("network_id");
  expectClear(anchored.points, nodes);
  const hidden = routeDependencyConnections(nodes, links)[0];
  expect(hidden.targetAttribute).toBeUndefined();
  expect(hidden.points[hidden.points.length - 1].y).toBe(106);
});
it("routes backward cycles and self-links around cards and group headings", () => {
  const nodes = [item("a", 28, 100), item("b", 400, 100), item("c", 780, 100)];
  const headings = [{ x: 12, y: 56, width: 1030, height: 32 }];
  const routes = routeDependencyConnections(
    nodes,
    [edge("back", "c", "a"), edge("self", "b", "b")],
    new Map(),
    headings,
  );
  for (const route of routes)
    expectClear(route.points, [
      ...nodes,
      ...headings.map((box, i) => ({ ...item(`heading-${i}`, 0, 0), ...box })),
    ]);
});
it("keeps parallel changes separate and routing deterministic under caller reordering", () => {
  const nodes = [item("a", 28, 80), item("b", 600, 80)];
  const links = [edge("old", "a", "b"), edge("new", "a", "b")];
  const routes = routeDependencyConnections(nodes, links);
  expect(routes[0].points).not.toEqual(routes[1].points);
  expect(
    routeDependencyConnections([...nodes].reverse(), [...links].reverse()),
  ).toEqual(routes);
  for (const route of routes) expectClear(route.points, nodes);
});
it("bundles only matching attribute endpoints and retains paths after group collapse", () => {
  const nodes = [
    { id: "a", label: "A", groupId: "source" },
    { id: "b", label: "B", groupId: "target" },
  ];
  const edges = [
    { id: "one", source: "a", target: "b", targetAttributePath: "one" },
    { id: "two", source: "a", target: "b", targetAttributePath: "two" },
  ];
  expect(buildDependencyGraph(nodes, edges, [], []).connections).toHaveLength(
    2,
  );
  const collapsed = buildDependencyGraph(
    nodes,
    edges,
    [
      { id: "source", label: "Source" },
      { id: "target", label: "Target" },
    ],
    ["source", "target"],
  );
  expect(collapsed.connections).toHaveLength(1);
  expect(
    collapsed.connections[0].edges.map((e) => e.targetAttributePath),
  ).toEqual(["one", "two"]);
});
