import type { GraphConnection, GraphItem } from "./model";
import { routeDependencyConnections } from "./routing";
import type { RoutingObstacle } from "./routing";
const item = (id: string, x: number, y: number): GraphItem => {
  const node = { id, label: id };
  return { key: id, node, members: [node], x, y, width: 256, height: 72 };
};
const items = [item("db", 100, 100), item("user", 440, 100), item("module", 100, 280), item("api", 440, 280)];
const connection = (source: string, target: string): GraphConnection => ({
  key: `${source}-${target}`, source, target,
  edges: [{ id: `${source}-${target}`, source, target }], points: [],
});
const connections = [connection("db", "api"), connection("db", "user"), connection("module", "api")];
const headings = [
  { x: 96, y: 244, width: 140, height: 28 },
  { x: 656, y: 244, width: 25, height: 25 },
];
const routeLength = (points: { x: number; y: number }[]) => points.slice(1).reduce((total, b, index) => total + Math.abs(b.x - points[index].x) + Math.abs(b.y - points[index].y), 0);
const intersects = (a: {x: number; y: number}, b: {x: number; y: number}, box: RoutingObstacle) =>
  a.x === b.x
    ? a.x > box.x && a.x < box.x + box.width && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.height
    : a.y > box.y && a.y < box.y + box.height && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.width;
it("takes the clear internal corridor rather than circling the runtime subgraph", () => {
  const original = structuredClone(items);
  const routes = routeDependencyConnections(items, connections, new Map(), headings);
  const { points } = routes.find((route) => route.key === "db-api")!;
  expect(points.length).toBeGreaterThan(1);
  expect(points.length).toBeLessThanOrEqual(4);
  expect(routeLength(points)).toBe(Math.abs(points.at(-1)!.x - points[0].x) + Math.abs(points.at(-1)!.y - points[0].y));
  expect(points.every((p) => p.x >= 356 && p.x <= 440)).toBe(true);
  expect(items).toEqual(original);
  expect(routes.find((route) => route.key === "db-api")!.convergenceKey).toBe(routes.find((route) => route.key === "module-api")!.convergenceKey);
  expect(routeDependencyConnections([...items].reverse(), [...connections].reverse(), new Map(), headings)).toEqual(routes);
});
it("still detours when a long heading genuinely blocks that corridor", () => {
  const blockedHeadings = [{ ...headings[0], width: 500 }, headings[1]];
  const { points } = routeDependencyConnections(items, connections, new Map(), blockedHeadings).find((route) => route.key === "db-api")!;
  expect(points.length).toBeGreaterThan(1);
  for (const [index, point] of points.slice(1).entries())
    for (const box of [...items, ...blockedHeadings])
      expect(intersects(points[index], point, box)).toBe(false);
});
