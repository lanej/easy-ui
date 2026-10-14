import React from "react";
import { fireEvent } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphConvergence } from "./DependencyGraphConvergence";
import { attributePortKey, routeDependencyConnections } from "./routing";
import type { GraphItem, GraphConnection } from "./model";

const item = (id: string, x: number, y: number): GraphItem => ({
  key: `node:${id}`,
  node: { id, label: id },
  members: [{ id, label: id }],
  x,
  y,
  width: 240,
  height: 160,
});
const nodes = [
  item("upper", 28, 20),
  item("lower", 28, 440),
  item("target", 600, 230),
];
const edge = (
  id: string,
  source: string,
  targetAttributePath?: string,
): GraphConnection => ({
  key: id,
  source: `node:${source}`,
  target: "node:target",
  edges: [{ id, source, target: "target", targetAttributePath }],
  points: [],
});
const links = [edge("upper-target", "upper"), edge("lower-target", "lower")];
const end = (points: { x: number; y: number }[]) => points[points.length - 1];

describe("convergent dependency paths", () => {
  it("stacks arrivals on the same trunk instead of allocating adjacent lanes", () => {
    // Both branches approach from the same side vertically, so they have an
    // overlapping vertical segment as well as a common horizontal arrival.
    const stacked = nodes.map((node) =>
      node.key === "node:target" ? { ...node, y: 680 } : node,
    );
    const before = JSON.stringify(stacked);
    const routes = routeDependencyConnections(stacked, links);
    expect(routes[0].convergenceKey).toBeDefined();
    expect(routes[1].convergenceKey).toBe(routes[0].convergenceKey);
    expect(end(routes[0].points)).toEqual(end(routes[1].points));
    const vertical = routes.map((route) =>
      route.points.slice(1).flatMap((point, i) =>
        point.x === route.points[i].x && point.y !== route.points[i].y
          ? [
              {
                x: point.x,
                min: Math.min(point.y, route.points[i].y),
                max: Math.max(point.y, route.points[i].y),
              },
            ]
          : [],
      ),
    );
    expect(
      vertical[0].some((a) =>
        vertical[1].some(
          (b) => a.x === b.x && Math.min(a.max, b.max) > Math.max(a.min, b.min),
        ),
      ),
    ).toBe(true);
    expect(JSON.stringify(stacked)).toBe(before);
    expect(
      routeDependencyConnections([...stacked].reverse(), [...links].reverse()),
    ).toEqual(routes);
  });
  it("keeps expanded attribute destinations distinct, and bundles the same visible field", () => {
    const fields = [edge("one", "upper", "one"), edge("two", "lower", "two")];
    const ports = new Map([
      [attributePortKey("target", "one"), 80],
      [attributePortKey("target", "two"), 120],
    ]);
    const distinct = routeDependencyConnections(nodes, fields, ports);
    expect(distinct.every((route) => route.convergenceKey === undefined)).toBe(
      true,
    );
    expect(end(distinct[0].points).y).not.toBe(end(distinct[1].points).y);
    const same = routeDependencyConnections(
      nodes,
      [fields[0], edge("two", "lower", "one")],
      ports,
    );
    expect(same[0].convergenceKey).toBe(same[1].convergenceKey);
    expect(end(same[0].points).y).toBe(310);
    const collapsed = routeDependencyConnections(nodes, fields);
    expect(collapsed[0].convergenceKey).toBeDefined();
    expect(collapsed[0].convergenceKey).toBe(collapsed[1].convergenceKey);
    expect(
      routeDependencyConnections(nodes, [fields[0]])[0].convergenceKey,
    ).toBeUndefined();
  });
  it("renders one shared arrow and preserves individual and aggregate selection", () => {
    const onSelectionChange = vi.fn();
    const props = {
      nodes: nodes.map((node) => node.node!),
      edges: links.flatMap((link) => link.edges),
      onSelectionChange,
    };
    const { container, rerender } = render(<DependencyGraph {...props} />);
    expect(container.querySelectorAll("path[marker-end]")).toHaveLength(1);
    const shared = container.querySelector("[data-graph-convergence]")!;
    fireEvent.click(shared);
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      type: "edges",
      ids: ["lower-target", "upper-target"],
    });
    fireEvent.click(
      container.querySelector("[data-graph-edge-ids*=upper-target]")!,
    );
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      type: "edge",
      id: "upper-target",
    });
    const positions = () =>
      [
        ...container.querySelectorAll<HTMLElement>(
          "[data-graph-resource-card]",
        ),
      ].map((node) => [
        node.dataset.graphResourceCard,
        node.style.left,
        node.style.top,
      ]);
    const initial = positions();
    rerender(<DependencyGraph {...props} hiddenEdgeIds={["lower-target"]} />);
    expect(container.querySelectorAll("[data-graph-convergence]")).toHaveLength(
      0,
    );
    expect(container.querySelectorAll("path[marker-end]")).toHaveLength(1);
    expect(positions()).toEqual(initial);
    rerender(<DependencyGraph {...props} />);
    expect(container.querySelectorAll("path[marker-end]")).toHaveLength(1);
    expect(positions()).toEqual(initial);
  });
  it("keeps a mixed-status shared arrow neutral and highlights any contributing selection", () => {
    const routes = routeDependencyConnections(
      nodes,
      links.map((link, i) => ({
        ...link,
        edges: link.edges.map((edge) => ({
          ...edge,
          change: i ? ("add" as const) : ("remove" as const),
        })),
      })),
    );
    const { container } = render(
      <svg>
        <DependencyGraphConvergence
          connections={routes}
          instanceId="graph"
          selection={{ type: "edge", id: "upper-target" }}
          highlighted={new Set(["lower-target"])}
          onSelect={vi.fn()}
        />
      </svg>,
    );
    const shared = container.querySelector("[data-graph-convergence]")!;
    expect(shared).toHaveAttribute("data-link-change", "unknown");
    expect(shared).toHaveAttribute("data-selected", "true");
    expect(shared).toHaveAttribute("data-highlighted", "true");
    expect(shared.querySelector("path[marker-end]")).toHaveAttribute(
      "marker-end",
      "url(#graph-arrow-unknown)",
    );
  });
});
