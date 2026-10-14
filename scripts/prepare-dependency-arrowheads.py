from pathlib import Path

root = Path('easy-ui-react/src/DependencyGraph')

def replace(path, old, new):
    text = path.read_text()
    assert text.count(old) == 1, f'{path}: expected one match for {old[:70]!r}'
    path.write_text(text.replace(old, new))

routing = root / 'routing.ts'
replace(routing, 'type Point = { x: number; y: number };', '''type Point = { x: number; y: number };

// SVG markers use graph units, not stroke-width units: interaction emphasis
// must not enlarge the head or consume the visible shaft.
export const dependencyArrowSize = 12;
export const dependencyArrowShaft = 16;
const bendRadius = 8;

/** Start of the final straight segment after rounded-corner trimming. */
export function dependencyConnectionArrival(points: Point[], radius = bendRadius) {
  const end = points[points.length - 1];
  const bend = points[points.length - 2];
  if (!end || !bend || bend.y !== end.y || bend.x >= end.x) return undefined;
  const before = points[points.length - 3];
  const trim = before
    ? Math.min(radius, distance(before, bend) / 2, distance(bend, end) / 2)
    : 0;
  return { x: bend.x + trim, y: end.y };
}''')
replace(routing, '''    const a = { x: start.x + clearance, y: start.y },
      b = { x: end.x - clearance, y: end.y };''', '''    // Slightly offset header rows should have one horizontal connection, not
    // a tiny jog underneath the arrowhead. Keep field ports and parallel
    // relationships exact and independently inspectable.
    if (
      source.node && target.node && start.x < end.x &&
      offset(connection, "source") === undefined &&
      offset(connection, "target") === undefined &&
      Math.abs(start.y - end.y) <= 8 &&
      end.y >= source.y + 8 && end.y <= source.y + source.height - 8 &&
      ordered.filter((other) =>
        other.source === connection.source && other.target === connection.target
      ).length === 1
    ) start.y = end.y;
    const approach = Math.min(
      Math.max(clearance, dependencyArrowSize + dependencyArrowShaft + bendRadius),
      Math.max(clearance, end.x - 8),
    );
    const a = { x: start.x + clearance, y: start.y },
      b = { x: end.x - approach, y: end.y };
    // Reserve the landing corridor as well as its endpoint. Otherwise the
    // shortest-path search can turn or double back inside the arrow's shaft.
    const routeBoxes = boxes.map((box, index) =>
      items[index]?.key === connection.target
        ? { ...box, x: box.x - (approach - clearance), width: box.width + approach - clearance }
        : box,
    );''')
replace(routing, '''      a,
      b,
      boxes,
      occupied''', '''      a,
      b,
      routeBoxes,
      occupied''')
replace(routing, '''      route.points.length > 1 && counts.get(destinationKey(route))! > 1''', '''      dependencyConnectionArrival(route.points) !== undefined &&
      counts.get(destinationKey(route))! > 1''')
replace(routing, 'export function roundedConnectionPath(points: Point[], radius = 8)', 'export function roundedConnectionPath(points: Point[], radius = bendRadius)')

component = root / 'DependencyGraph.tsx'
replace(component, '  attributePortKey,\n  routeDependencyConnections,', '  attributePortKey,\n  dependencyArrowSize,\n  routeDependencyConnections,')
replace(component, '''                            refX="9"
                            refY="5"
                            markerWidth="7"
                            markerHeight="7"''', '''                            refX="10"
                            refY="5"
                            markerUnits="userSpaceOnUse"
                            markerWidth={dependencyArrowSize}
                            markerHeight={dependencyArrowSize}''')

convergence = root / 'DependencyGraphConvergence.tsx'
replace(convergence, 'import type { routeDependencyConnections } from "./routing";', 'import { dependencyConnectionArrival } from "./routing";\nimport type { routeDependencyConnections } from "./routing";')
replace(convergence, '''        const end = points[points.length - 1];''', '''        const end = points[points.length - 1];
        // Paint the actual common straight approach, not a one-pixel carrier
        // for the marker. Start after every contributing rounded corner.
        const startX = Math.max(...members.map((member) =>
          dependencyConnectionArrival(member.points)!.x,
        ));
        const arrivalPath = `M ${startX} ${end.y} L ${end.x} ${end.y}`;''')
replace(convergence, '''            data-link-change={change}''', '''            data-link-change={change}
            data-dashed={edges.every((edge) => edge.variant === "dashed") || undefined}''')
replace(convergence, 'd={`M ${end.x - 16} ${end.y} L ${end.x} ${end.y}`}', 'd={arrivalPath}')
replace(convergence, 'd={`M ${end.x - 1} ${end.y} L ${end.x} ${end.y}`}', 'd={arrivalPath}')

(root / 'routing.arrowheads.test.tsx').write_text('''import React from "react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphConvergence } from "./DependencyGraphConvergence";
import { attributePortKey, dependencyArrowSize, dependencyArrowShaft, dependencyConnectionArrival, routeDependencyConnections } from "./routing";
import type { GraphItem, GraphConnection } from "./model";

const item = (id: string, x: number, y: number, height = 72): GraphItem => ({
  key: `node:${id}`, node: { id, label: id }, members: [{ id, label: id }],
  x, y, width: 240, height,
});
const edge = (id: string, source: string, target: string, paths = {}): GraphConnection => ({
  key: id, source: `node:${source}`, target: `node:${target}`,
  edges: [{ id, source, target, ...paths }], points: [],
});
const nodes = [item("db", 100, 128), item("user", 448, 120), item("module", 100, 300), item("api", 448, 300), item("image", 100, 580)];
const edges = [edge("db-user", "db", "user"), edge("db-api", "db", "api"), edge("module-api", "module", "api"), edge("image-api", "image", "api")];

describe("visible, aligned arrow approaches", () => {
  it.each([0.4, 0.91, 1, 2])("reserves a straight shaft beyond the head and rounded corner at zoom %s", (zoom) => {
    const before = JSON.stringify(nodes);
    const routes = routeDependencyConnections(nodes, edges, new Map(), [], zoom);
    for (const route of routes) {
      const arrival = dependencyConnectionArrival(route.points)!;
      const end = route.points.at(-1)!;
      expect(arrival).toBeDefined();
      expect(arrival.y).toBe(end.y);
      expect(end.x - arrival.x - dependencyArrowSize).toBeGreaterThanOrEqual(dependencyArrowShaft);
    }
    const nearLevel = routes.find((route) => route.key === "db-user")!;
    expect(nearLevel.points).toHaveLength(2);
    expect(nearLevel.points[0].y).toBe(nearLevel.points[1].y);
    expect(JSON.stringify(nodes)).toBe(before);
    expect(routeDependencyConnections([...nodes].reverse(), [...edges].reverse(), new Map(), [], zoom)).toEqual(routes);
  });
  it("does not snap explicit field rows or collapse parallel source ports", () => {
    const pair = [item("a", 100, 100, 200), item("b", 500, 100, 200)];
    const paths = { sourceAttributePath: "out", targetAttributePath: "in" };
    const ports = new Map([[attributePortKey("a", "out"), 100], [attributePortKey("b", "in"), 104]]);
    const route = routeDependencyConnections(pair, [edge("field", "a", "b", paths)], ports)[0];
    expect(route.points[0].y).toBe(200);
    expect(route.points.at(-1)!.y).toBe(204);
    const parallel = routeDependencyConnections(pair, [edge("old", "a", "b"), edge("new", "a", "b")]);
    expect(parallel[0].points[0].y).not.toBe(parallel[1].points[0].y);
  });
  it("draws the full shared shaft and keeps mixed statuses neutral", () => {
    const routes = routeDependencyConnections(nodes, edges.map((link, i) => ({ ...link, edges: link.edges.map((edge) => ({ ...edge, change: i % 2 ? "add" as const : "remove" as const })) })));
    const { container } = render(<svg><DependencyGraphConvergence connections={routes} instanceId="test" selection={null} highlighted={new Set()} onSelect={vi.fn()} /></svg>);
    const shared = container.querySelector("[data-graph-convergence]")!;
    expect(shared).toHaveAttribute("data-link-change", "unknown");
    const path = shared.querySelector("path[marker-end]")!;
    const values = path.getAttribute("d")!.match(/-?\\d+(?:\\.\\d+)?/g)!.map(Number);
    expect(values[1]).toBe(values[3]);
    expect(values[2] - values[0]).toBeGreaterThanOrEqual(dependencyArrowSize + dependencyArrowShaft);
    expect(shared.querySelector("path:first-of-type")).toHaveAttribute("d", path.getAttribute("d")!);
  });
  it("anchors marker tips exactly and does not size markers by stroke width", () => {
    const { container } = render(<DependencyGraph nodes={nodes.map((node) => node.node!)} edges={edges.flatMap((edge) => edge.edges)} />);
    for (const marker of container.querySelectorAll("marker")) {
      expect(marker).toHaveAttribute("refX", "10");
      expect(marker).toHaveAttribute("refY", "5");
      expect(marker).toHaveAttribute("markerUnits", "userSpaceOnUse");
      expect(marker).toHaveAttribute("markerWidth", String(dependencyArrowSize));
    }
  });
});
''')

with (root / 'DependencyGraph.mdx').open('a') as f:
    f.write('\n\n### Arrow approaches\n\nArrowheads meet their destination boundary at the tip and use graph-space dimensions,\nso hover and selection do not enlarge the head. Routing reserves a straight approach\nfor the head and visible shaft after the last rounded corner. Convergent arrivals\npaint that common shaft once; mixed relationship states remain neutral there.\nNear-level resource headers connect horizontally without a small terminal jog.\nVisible attribute ports and parallel relationship ports remain exact.\n')
with Path('.changeset/readable-source-dependency-graphs.md').open('a') as f:
    f.write('\nReserve visible arrow shafts, align near-level resource connections, and keep arrowhead size stable during interaction.\n')
ci = Path('.github/workflows/ci.yml')
replace(ci, '          node scripts/check-dependency-graph-heading-routing.mjs', '          node scripts/check-dependency-graph-heading-routing.mjs\n          node scripts/check-dependency-graph-arrowheads.mjs')
