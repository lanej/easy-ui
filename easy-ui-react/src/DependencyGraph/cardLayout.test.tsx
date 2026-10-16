import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DependencyGraph } from "./DependencyGraph";
import { normalizeCardLayout, positionDependencyCards } from "./cardLayout";
import { buildDependencyGraph, createDependencyGraphOrder } from "./model";
import { dependencyGraphClusters, dependencyGroupHierarchy } from "./groups";
import { routeDependencyConnections } from "./routing";

const nodes = [
  { id: "one", label: "One", groupId: "inner" },
  { id: "two", label: "Two" },
];
const edges = [{ id: "link", source: "one", target: "two" }];
const groups = [
  { id: "outer", label: "Outer" },
  { id: "inner", label: "Inner", parentId: "outer" },
];

it("normalizes supplied dimensions without mutating caller geometry", () => {
  const value = { width: -1, height: 0, x: NaN, y: Infinity };
  expect(normalizeCardLayout(value)).toEqual({ width: 192, height: 96 });
  expect(value).toEqual({ width: -1, height: 0, x: NaN, y: Infinity });
  expect(normalizeCardLayout({ width: 512.7, x: -30, y: 12.2 })).toEqual({
    width: 513,
    x: 0,
    y: 12,
  });
});
it("routes from moved bounds and retains nested group containment", () => {
  const order = createDependencyGraphOrder(nodes, edges, groups);
  const graph = buildDependencyGraph(
    nodes,
    edges,
    groups,
    [],
    new Map(),
    256,
    1,
    order,
  );
  const hierarchy = dependencyGroupHierarchy(nodes, groups);
  const items = positionDependencyCards(
    graph.items,
    { one: { x: 950, y: 700 } },
    hierarchy,
    1,
  );
  const moved = items.find((item) => item.node?.id === "one")!;
  const clusters = dependencyGraphClusters(items, hierarchy, new Set());
  expect(moved.x).toBe(950);
  expect(moved.y).toBe(700);
  expect(graph.items.find((item) => item.node?.id === "one")!.x).not.toBe(950);
  for (const cluster of clusters) {
    expect(cluster.x).toBeLessThan(moved.x);
    expect(cluster.y).toBeLessThan(moved.y);
    expect(cluster.x + cluster.width).toBeGreaterThan(moved.x + moved.width);
    expect(cluster.y + cluster.height).toBeGreaterThan(moved.y + moved.height);
  }
  const routed = routeDependencyConnections(
    items,
    graph.connections,
    new Map(),
  );
  expect(routed[0].points[0].x).toBe(moved.x + moved.width);
  expect(routed[0].points[0].y).toBeGreaterThan(moved.y);
  const boundary = positionDependencyCards(
    graph.items,
    { one: { x: 0, y: 0 } },
    hierarchy,
    0.4,
  );
  for (const cluster of dependencyGraphClusters(
    boundary,
    hierarchy,
    new Set(),
    0.4,
  )) {
    expect(cluster.x).toBeGreaterThanOrEqual(0);
    expect(cluster.y).toBeGreaterThanOrEqual(0);
  }
});
it("retains relationships and exact attribute ports in tight manual gaps", () => {
  const graph = buildDependencyGraph(nodes, edges, [], []);
  const items = graph.items.map((item, index) => ({
    ...item,
    x: index ? 370 : 100,
    y: 100,
    width: 256,
    height: 100,
  }));
  const routed = routeDependencyConnections(
    items,
    graph.connections,
    new Map(),
    [],
    1,
    true,
  );
  expect(routed[0].points).toEqual([
    { x: 356, y: 126 },
    { x: 370, y: 126 },
  ]);
  expect(routed[0].compactRoute).toBe(true);
  const exact = routeDependencyConnections(
    items,
    [
      {
        ...graph.connections[0],
        edges: [
          {
            ...edges[0],
            sourceAttributePath: "source",
            targetAttributePath: "target",
          },
        ],
      },
    ],
    new Map([
      [JSON.stringify(["one", "source"]), 60],
      [JSON.stringify(["two", "target"]), 80],
    ]),
    [],
    1,
    true,
  );
  expect(exact[0].points[0]).toEqual({ x: 356, y: 160 });
  expect(exact[0].points[exact[0].points.length - 1]).toEqual({
    x: 370,
    y: 180,
  });
  expect(exact[0].sourceAttribute).toBe("source");
  expect(exact[0].targetAttribute).toBe("target");
});
it("applies saved geometry with editing disabled and keeps group proxies automatic", () => {
  const { container, rerender } = render(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      groups={groups}
      allowLayoutEditing={false}
      cardLayouts={{ one: { width: 600, height: 200, x: 900, y: 500 } }}
    />,
  );
  const card = container.querySelector<HTMLElement>(
    '[data-graph-resource-card="one"]',
  )!;
  expect(card.style.width).toBe("37.5rem");
  expect(card.style.height).toBe("12.5rem");
  expect(card.style.left).toBe("56.25rem");
  expect(screen.queryByRole("button", { name: "Edit layout" })).toBeNull();
  rerender(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      groups={groups}
      collapsedGroupIds={["outer"]}
      cardLayouts={{ one: { width: 600 } }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit layout" }));
  expect(screen.queryByRole("button", { name: "Move One" })).toBeNull();
  expect(
    container.querySelector<HTMLElement>(
      '[data-graph-collapsed-group="outer"]',
    )!.style.width,
  ).toBe("16rem");
});
it("reports controlled keyboard edits without overriding owner state, then accepts it", () => {
  const change = vi.fn();
  const props = {
    nodes,
    edges,
    showDetails: false,
    defaultSelection: { type: "node" as const, id: "one" },
    onCardLayoutsChange: change,
  };
  const { container, rerender } = render(
    <DependencyGraph
      {...props}
      cardLayouts={{ one: { x: 100, y: 100, width: 400, height: 200 } }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit layout" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Move One" }), {
    key: "ArrowRight",
    shiftKey: true,
  });
  expect(change).toHaveBeenLastCalledWith({
    one: { x: 150, y: 100, width: 400, height: 200 },
  });
  expect(
    container.querySelector<HTMLElement>('[data-graph-resource-card="one"]')!
      .style.left,
  ).toBe("6.25rem");
  rerender(
    <DependencyGraph {...props} cardLayouts={change.mock.lastCall![0]} />,
  );
  expect(
    container.querySelector<HTMLElement>('[data-graph-resource-card="one"]')!
      .style.left,
  ).toBe("9.375rem");
  fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));
  expect(change).toHaveBeenLastCalledWith({});
});
it("edits local sizes, rejects invalid text, and resets to content-driven dimensions", () => {
  const { container } = render(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      showDetails={false}
      defaultSelection={{ type: "node", id: "one" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit layout" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Card width" }), {
    target: { value: "invalid" },
  });
  expect(screen.getByRole("button", { name: "Apply size" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Card width" }), {
    target: { value: "480" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Card height" }), {
    target: { value: "240" },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Size One" }));
  const card = container.querySelector<HTMLElement>(
    '[data-graph-resource-card="one"]',
  )!;
  expect(card.style.width).toBe("30rem");
  expect(card.style.height).toBe("15rem");
  fireEvent.click(screen.getByRole("button", { name: "Reset card" }));
  expect(card.style.height).toBe("");
  expect(card.hasAttribute("data-graph-fixed-height")).toBe(false);
});
