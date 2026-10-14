from pathlib import Path

root = Path('.')
component = root / 'easy-ui-react/src/DependencyGraph'

def replace(path, old, new):
    text = path.read_text()
    assert text.count(old) == 1, f'Expected one patch anchor in {path}: {old[:100]!r}'
    path.write_text(text.replace(old, new))

replace(component/'routing.ts', '''    const field = offset(connection, side);
    if (field !== undefined) {''', '''    const field = offset(connection, side);
    // Converging relationships share the actual destination port. Only outgoing
    // branches fan out; visible attribute rows still have distinct destinations.
    if (side === "target")
      return item.y + (field ?? (item.node ? Math.min(26, item.height / 2) : item.height / 2));
    if (field !== undefined) {''')
replace(component/'routing.ts', '''  const occupied: Point[][] = [];
  return ordered.map((connection) => {''', '''  const occupied: { destination: string; points: Point[] }[] = [];
  const routed = ordered.map((connection) => {''')
replace(component/'routing.ts', '''    const middle = routeBetween(a, b, boxes, occupied);''', '''    const destination = JSON.stringify([connection.target, end.y]);
    // Sharing a destination is intentional bundling, not lane congestion. Do not
    // push these paths into parallel lanes merely to avoid their shared trunk.
    const middle = routeBetween(a, b, boxes, occupied
      .filter((route) => route.destination !== destination)
      .map((route) => route.points));''')
replace(component/'routing.ts', '''    occupied.push(points);''', '''    occupied.push({ destination, points });''')
replace(component/'routing.ts', '''  });
}

/** Round orthogonal bends''', '''  });
  // Key the rendered arrival, rather than just the resource: expanded attributes
  // must never acquire a shared arrow at the wrong field. A failed route also
  // cannot masquerade as a successful convergence at its requested port.
  const destinationKey = (route: typeof routed[number]) => JSON.stringify([
    route.target, route.targetAttribute ?? null,
    route.points[route.points.length - 1] ?? null,
  ]);
  const counts = new Map<string, number>();
  for (const route of routed) {
    const key = destinationKey(route);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return routed.map((route) => ({
    ...route,
    convergenceKey: route.points.length > 1 && counts.get(destinationKey(route))! > 1
      ? destinationKey(route) : undefined,
  }));
}

/** Round orthogonal bends''')
replace(component/'DependencyGraph.tsx', '''import { DependencyGraphIdentity } from "./DependencyGraphIdentity";''', '''import { DependencyGraphIdentity } from "./DependencyGraphIdentity";
import { DependencyGraphConvergence } from "./DependencyGraphConvergence";''')
replace(component/'DependencyGraph.tsx', '''markerEnd={`url(#${instanceId}-arrow-${change})`}''', '''markerEnd={connection.convergenceKey === undefined
                                ? `url(#${instanceId}-arrow-${change})`
                                : undefined}''')
replace(component/'DependencyGraph.tsx', '''                      })}
                    </svg>''', '''                      })}
                      <DependencyGraphConvergence
                        connections={connections}
                        instanceId={instanceId}
                        selection={selection}
                        highlighted={highlighted}
                        onSelect={select}
                      />
                    </svg>''')

(component/'DependencyGraphConvergence.tsx').write_text('''import React from "react";
import type { routeDependencyConnections } from "./routing";
import type { DependencyGraphSelection } from "./types";
import styles from "./DependencyGraph.module.scss";

type Connections = ReturnType<typeof routeDependencyConnections>;

/** One visible arrow per arrival, without discarding the contributing edges. */
export function DependencyGraphConvergence({
  connections,
  instanceId,
  selection,
  highlighted,
  onSelect,
}: {
  connections: Connections;
  instanceId: string;
  selection: DependencyGraphSelection;
  highlighted: ReadonlySet<string>;
  onSelect: (selection: DependencyGraphSelection) => void;
}) {
  const arrivals = new Map<string, Connections>();
  for (const connection of connections) {
    if (connection.convergenceKey === undefined) continue;
    const members = arrivals.get(connection.convergenceKey) ?? [];
    members.push(connection);
    arrivals.set(connection.convergenceKey, members);
  }
  return (
    <>
      {[...arrivals].map(([key, members]) => {
        const edges = members.flatMap((member) => member.edges);
        const ids = edges.map((edge) => edge.id);
        const changes = new Set(edges.map((edge) => edge.change ?? "unknown"));
        // A shared arrow is not evidence that differently changed edges all
        // acquired whichever status happened to be painted last.
        const change = changes.size === 1 ? edges[0].change ?? "unknown" : "unknown";
        const points = members[0].points;
        const end = points[points.length - 1];
        const selected = selection?.type === "edge"
          ? ids.includes(selection.id)
          : selection?.type === "edges"
            ? selection.ids.some((id) => ids.includes(id))
            : false;
        return (
          <g
            key={key}
            className={styles.connection}
            data-graph-convergence={key}
            data-graph-convergence-edge-ids={JSON.stringify(ids)}
            data-link-change={change}
            data-selected={selected || undefined}
            data-highlighted={ids.some((id) => highlighted.has(id)) || undefined}
            onClick={() => onSelect({ type: "edges", ids })}
          >
            <path
              className={styles.edgeHitArea}
              d={`M ${end.x - 16} ${end.y} L ${end.x} ${end.y}`}
            />
            <path
              className={styles.edgeLine}
              d={`M ${end.x - 1} ${end.y} L ${end.x} ${end.y}`}
              markerEnd={`url(#${instanceId}-arrow-${change})`}
            />
            <title>{edges.map((edge) => edge.label ?? edge.id).join("; ")}</title>
          </g>
        );
      })}
    </>
  );
}
''')

(component/'DependencyGraph.convergence.test.tsx').write_text('''import React from "react";
import { fireEvent } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphConvergence } from "./DependencyGraphConvergence";
import { attributePortKey, routeDependencyConnections } from "./routing";
import type { GraphItem, GraphConnection } from "./model";

const item = (id: string, x: number, y: number): GraphItem => ({
  key: `node:${id}`, node: { id, label: id }, members: [{ id, label: id }],
  x, y, width: 240, height: 160,
});
const nodes = [item("upper", 28, 20), item("lower", 28, 440), item("target", 600, 230)];
const edge = (id: string, source: string, targetAttributePath?: string): GraphConnection => ({
  key: id, source: `node:${source}`, target: "node:target",
  edges: [{ id, source, target: "target", targetAttributePath }], points: [],
});
const links = [edge("upper-target", "upper"), edge("lower-target", "lower")];
const end = (points: {x: number; y: number}[]) => points[points.length - 1];

describe("convergent dependency paths", () => {
  it("stacks arrivals on the same trunk instead of allocating adjacent lanes", () => {
    // Both branches approach from the same side vertically, so they have an
    // overlapping vertical segment as well as a common horizontal arrival.
    const stacked = nodes.map((node) => node.key === "node:target" ? {...node, y: 680} : node);
    const before = JSON.stringify(stacked);
    const routes = routeDependencyConnections(stacked, links);
    expect(routes[0].convergenceKey).toBeDefined();
    expect(routes[1].convergenceKey).toBe(routes[0].convergenceKey);
    expect(end(routes[0].points)).toEqual(end(routes[1].points));
    const vertical = routes.map((route) => route.points.slice(1).flatMap((point, i) =>
      point.x === route.points[i].x && point.y !== route.points[i].y ? [{
        x: point.x, min: Math.min(point.y, route.points[i].y), max: Math.max(point.y, route.points[i].y),
      }] : []));
    expect(vertical[0].some((a) => vertical[1].some((b) =>
      a.x === b.x && Math.min(a.max, b.max) > Math.max(a.min, b.min)))).toBe(true);
    expect(JSON.stringify(stacked)).toBe(before);
    expect(routeDependencyConnections([...stacked].reverse(), [...links].reverse())).toEqual(routes);
  });
  it("keeps expanded attribute destinations distinct, and bundles the same visible field", () => {
    const fields = [edge("one", "upper", "one"), edge("two", "lower", "two")];
    const ports = new Map([[attributePortKey("target", "one"), 80], [attributePortKey("target", "two"), 120]]);
    const distinct = routeDependencyConnections(nodes, fields, ports);
    expect(distinct.every((route) => route.convergenceKey === undefined)).toBe(true);
    expect(end(distinct[0].points).y).not.toBe(end(distinct[1].points).y);
    const same = routeDependencyConnections(nodes, [fields[0], edge("two", "lower", "one")], ports);
    expect(same[0].convergenceKey).toBe(same[1].convergenceKey);
    expect(end(same[0].points).y).toBe(310);
    const collapsed = routeDependencyConnections(nodes, fields);
    expect(collapsed[0].convergenceKey).toBeDefined();
    expect(collapsed[0].convergenceKey).toBe(collapsed[1].convergenceKey);
    expect(routeDependencyConnections(nodes, [fields[0]])[0].convergenceKey).toBeUndefined();
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
    expect(onSelectionChange).toHaveBeenLastCalledWith({type: "edges", ids: ["lower-target", "upper-target"]});
    fireEvent.click(container.querySelector('[data-graph-edge-ids*=upper-target]')!);
    expect(onSelectionChange).toHaveBeenLastCalledWith({type: "edge", id: "upper-target"});
    const positions = () => [...container.querySelectorAll<HTMLElement>("[data-graph-resource-card]")].map((node) => [node.dataset.graphResourceCard, node.style.left, node.style.top]);
    const initial = positions();
    rerender(<DependencyGraph {...props} hiddenEdgeIds={["lower-target"]} />);
    expect(container.querySelectorAll("[data-graph-convergence]")).toHaveLength(0);
    expect(container.querySelectorAll("path[marker-end]")).toHaveLength(1);
    expect(positions()).toEqual(initial);
    rerender(<DependencyGraph {...props} />);
    expect(container.querySelectorAll("path[marker-end]")).toHaveLength(1);
    expect(positions()).toEqual(initial);
  });
  it("keeps a mixed-status shared arrow neutral and highlights any contributing selection", () => {
    const routes = routeDependencyConnections(nodes, links.map((link, i) => ({
      ...link, edges: link.edges.map((edge) => ({...edge, change: i ? "add" as const : "remove" as const})),
    })));
    const {container} = render(<svg><DependencyGraphConvergence
      connections={routes} instanceId="graph" selection={{type: "edge", id: "upper-target"}}
      highlighted={new Set(["lower-target"])} onSelect={vi.fn()}
    /></svg>);
    const shared = container.querySelector("[data-graph-convergence]")!;
    expect(shared).toHaveAttribute("data-link-change", "unknown");
    expect(shared).toHaveAttribute("data-selected", "true");
    expect(shared).toHaveAttribute("data-highlighted", "true");
    expect(shared.querySelector("path[marker-end]")).toHaveAttribute("marker-end", "url(#graph-arrow-unknown)");
  });
});
''')
with (component/'DependencyGraph.mdx').open('a') as f:
    f.write('''\n\n### Converging relationships\n\nPaths reaching the same visible destination share their approach and one arrowhead,\nrather than occupying adjacent arrival lanes. Click a distinct branch to inspect\nthat relationship; click the shared arrow to inspect all contributing relationships.\nDifferent visible attribute rows retain separate arrivals. Collapsing attributes\ncan combine their arrivals at the resource header without changing resource order.\nBranch colors and dashed styles remain independent; a mixed-change shared arrow\nis neutral rather than inheriting the last-painted relationship's status.\n''')
replace(root/'scripts/check-dependency-graph.mjs', '''      await modified
        .locator("path[marker-end]")''', '''      await modified
        .locator("path:last-of-type")''')
replace(root/'scripts/check-dependency-graph.mjs', '''      await block
        .locator("path[marker-end]")''', '''      await block
        .locator("path:last-of-type")''')
replace(root/'scripts/check-dependency-graph-source.mjs', '''      const initial = await positions();''', '''      const arrivals = await page.locator("[data-graph-edge-ids]").evaluateAll((groups) =>
        groups.map((group) => ({ids: JSON.parse(group.dataset.graphEdgeIds), points: JSON.parse(group.dataset.graphRoutePoints)})));
      const runtime = arrivals.filter((route) => route.ids.some((id) => ["image-runtime", "module-runtime"].includes(id)));
      assert.equal(runtime.length, 2);
      assert.deepEqual(runtime[0].points.at(-1), runtime[1].points.at(-1), "Converging paths have one arrival");
      assert.equal(await page.locator("path[marker-end]").count(), 5, "Six relationships render five arrival arrows");
      const convergence = page.locator("[data-graph-convergence]");
      assert.equal(await convergence.count(), 1);
      assert.deepEqual(JSON.parse(await convergence.getAttribute("data-graph-convergence-edge-ids")).sort(), ["image-runtime", "module-runtime"]);
      const initial = await positions();''')
