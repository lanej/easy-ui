import React from "react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphConvergence } from "./DependencyGraphConvergence";
import {
  attributePortKey,
  dependencyArrowSize,
  dependencyArrowShaft,
  dependencyConnectionArrival,
  routeDependencyConnections,
} from "./routing";
import type { GraphItem, GraphConnection } from "./model";

const item = (id: string, x: number, y: number, height = 72): GraphItem => ({
  key: `node:${id}`,
  node: { id, label: id },
  members: [{ id, label: id }],
  x,
  y,
  width: 240,
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
const nodes = [
  item("db", 100, 128),
  item("user", 448, 120),
  item("module", 100, 300),
  item("api", 448, 300),
  item("image", 100, 580),
];
const edges = [
  edge("db-user", "db", "user"),
  edge("db-api", "db", "api"),
  edge("module-api", "module", "api"),
  edge("image-api", "image", "api"),
];

describe("visible, aligned arrow approaches", () => {
  it.each([0.4, 0.91, 1, 2])(
    "reserves a straight shaft beyond the head and rounded corner at zoom %s",
    (zoom) => {
      const before = JSON.stringify(nodes);
      const routes = routeDependencyConnections(
        nodes,
        edges,
        new Map(),
        [],
        zoom,
      );
      for (const route of routes) {
        const arrival = dependencyConnectionArrival(route.points)!;
        const end = route.points[route.points.length - 1]!;
        expect(arrival).toBeDefined();
        expect(arrival.y).toBe(end.y);
        expect(end.x - arrival.x - dependencyArrowSize).toBeGreaterThanOrEqual(
          dependencyArrowShaft,
        );
      }
      const nearLevel = routes.find((route) => route.key === "db-user")!;
      expect(nearLevel.points).toHaveLength(2);
      expect(nearLevel.points[0].y).toBe(nearLevel.points[1].y);
      expect(JSON.stringify(nodes)).toBe(before);
      expect(
        routeDependencyConnections(
          [...nodes].reverse(),
          [...edges].reverse(),
          new Map(),
          [],
          zoom,
        ),
      ).toEqual(routes);
    },
  );
  it("does not snap explicit field rows or collapse parallel source ports", () => {
    const pair = [item("a", 100, 100, 200), item("b", 500, 100, 200)];
    const paths = { sourceAttributePath: "out", targetAttributePath: "in" };
    const ports = new Map([
      [attributePortKey("a", "out"), 100],
      [attributePortKey("b", "in"), 104],
    ]);
    const route = routeDependencyConnections(
      pair,
      [edge("field", "a", "b", paths)],
      ports,
    )[0];
    expect(route.points[0].y).toBe(200);
    expect(route.points[route.points.length - 1]!.y).toBe(204);
    const parallel = routeDependencyConnections(pair, [
      edge("old", "a", "b"),
      edge("new", "a", "b"),
    ]);
    expect(parallel[0].points[0].y).not.toBe(parallel[1].points[0].y);
  });
  it("draws the full shared shaft and keeps mixed statuses neutral", () => {
    const routes = routeDependencyConnections(
      nodes,
      edges.map((link, i) => ({
        ...link,
        edges: link.edges.map((edge) => ({
          ...edge,
          change: i % 2 ? ("add" as const) : ("remove" as const),
        })),
      })),
    );
    const { container } = render(
      <svg>
        <DependencyGraphConvergence
          connections={routes}
          instanceId="test"
          selection={null}
          highlighted={new Set()}
          onSelect={vi.fn()}
        />
      </svg>,
    );
    const shared = container.querySelector("[data-graph-convergence]")!;
    expect(shared).toHaveAttribute("data-link-change", "unknown");
    const path = shared.querySelector("path[marker-end]")!;
    const values = path
      .getAttribute("d")!
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    expect(values[1]).toBe(values[3]);
    expect(values[2] - values[0]).toBeGreaterThanOrEqual(
      dependencyArrowSize + dependencyArrowShaft,
    );
    expect(shared.querySelector("path:first-of-type")).toHaveAttribute(
      "d",
      path.getAttribute("d")!,
    );
  });
  it("anchors marker tips exactly and does not size markers by stroke width", () => {
    const { container } = render(
      <DependencyGraph
        nodes={nodes.map((node) => node.node!)}
        edges={edges.flatMap((edge) => edge.edges)}
      />,
    );
    for (const marker of container.querySelectorAll("marker")) {
      expect(marker).toHaveAttribute("refX", "10");
      expect(marker).toHaveAttribute("refY", "5");
      expect(marker).toHaveAttribute("markerUnits", "userSpaceOnUse");
      expect(marker).toHaveAttribute(
        "markerWidth",
        String(dependencyArrowSize),
      );
    }
  });
});
