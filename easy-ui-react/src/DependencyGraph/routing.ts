import type { GraphConnection, GraphItem } from "./model";

type Point = { x: number; y: number };

// SVG markers use graph units, not stroke-width units: interaction emphasis
// must not enlarge the head or consume the visible shaft.
export const dependencyArrowSize = 12;
export const dependencyArrowShaft = 16;
const bendRadius = 8;

/** Start of the final straight segment after rounded-corner trimming. */
export function dependencyConnectionArrival(
  points: Point[],
  radius = bendRadius,
) {
  const end = points[points.length - 1];
  const bend = points[points.length - 2];
  if (!end || !bend || bend.y !== end.y || bend.x >= end.x) return undefined;
  const before = points[points.length - 3];
  const trim = before
    ? Math.min(radius, distance(before, bend) / 2, distance(bend, end) / 2)
    : 0;
  return { x: bend.x + trim, y: end.y };
}
export type RoutingObstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export const attributePortKey = (nodeId: string, path: string) =>
  JSON.stringify([nodeId, path]);
const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const simplify = (points: Point[]) => {
  const result: Point[] = [];
  for (const point of points) {
    if (result.length && distance(point, result[result.length - 1]) < 0.01)
      continue;
    while (result.length > 1) {
      const a = result[result.length - 2],
        b = result[result.length - 1];
      if (!(
        (a.x === b.x && b.x === point.x) ||
        (a.y === b.y && b.y === point.y)
      ))
        break;
      result.pop();
    }
    result.push(point);
  }
  return result;
};
function blocked(a: Point, b: Point, boxes: RoutingObstacle[]) {
  return boxes.some((box) =>
    a.x === b.x
      ? a.x > box.x + 0.01 &&
        a.x < box.x + box.width - 0.01 &&
        Math.max(a.y, b.y) > box.y + 0.01 &&
        Math.min(a.y, b.y) < box.y + box.height - 0.01
      : a.y > box.y + 0.01 &&
        a.y < box.y + box.height - 0.01 &&
        Math.max(a.x, b.x) > box.x + 0.01 &&
        Math.min(a.x, b.x) < box.x + box.width - 0.01,
  );
}
function congestion(a: Point, b: Point, occupied: Point[][]) {
  let cost = 0;
  for (const route of occupied)
    for (let i = 1; i < route.length; i++) {
      const c = route[i - 1],
        d = route[i];
      if (a.x === b.x && c.x === d.x && a.x === c.x)
        cost +=
          3 *
          Math.max(
            0,
            Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
              Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)),
          );
      if (a.y === b.y && c.y === d.y && a.y === c.y)
        cost +=
          3 *
          Math.max(
            0,
            Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
              Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)),
          );
    }
  return cost;
}
function routeBetween(
  start: Point,
  end: Point,
  boxes: RoutingObstacle[],
  occupied: Point[][],
) {
  const lanes = [(start.x + end.x) / 2, start.x + 16, end.x - 16];
  const candidates = [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
    ...lanes.flatMap((x) =>
      [-8, 0, 8].map((offset) => [
        start,
        { x: x + offset, y: start.y },
        { x: x + offset, y: end.y },
        end,
      ]),
    ),
  ]
    .map(simplify)
    .filter((route) =>
      route.slice(1).every((point, i) => !blocked(route[i], point, boxes)),
    );
  const score = (route: Point[]) =>
    route
      .slice(1)
      .reduce(
        (cost, point, i) =>
          cost +
          distance(route[i], point) +
          congestion(route[i], point, occupied),
        24 * Math.max(0, route.length - 2),
      );
  candidates.sort((a, b) => score(a) - score(b));
  if (candidates.length) return candidates[0];
  // Lazy orthogonal visibility grid. Obstacles supply clearance lanes; ports supply rows.
  const xs = [
    ...new Set([
      start.x,
      end.x,
      Math.max(8, Math.min(...boxes.map((b) => b.x)) - 16),
      Math.max(...boxes.map((b) => b.x + b.width)) + 16,
      ...boxes.flatMap((b) => [b.x, b.x + b.width]),
    ]),
  ]
    .filter((value) => value >= 0)
    .sort((a, b) => a - b);
  const ys = [
    ...new Set([
      start.y,
      end.y,
      Math.max(8, Math.min(...boxes.map((b) => b.y)) - 16),
      Math.max(...boxes.map((b) => b.y + b.height)) + 16,
      ...boxes.flatMap((b) => [b.y, b.y + b.height]),
    ]),
  ]
    .filter((value) => value >= 0)
    .sort((a, b) => a - b);
  const startX = xs.indexOf(start.x),
    startY = ys.indexOf(start.y),
    endX = xs.indexOf(end.x),
    endY = ys.indexOf(end.y);
  const key = (x: number, y: number, axis: number) => `${x}:${y}:${axis}`;
  const initial = key(startX, startY, 0);
  const open = new Map([[initial, { x: startX, y: startY, axis: 0, cost: 0 }]]);
  const costs = new Map([[initial, 0]]),
    previous = new Map<string, string>();
  while (open.size) {
    let currentKey = initial,
      current = open.values().next().value!,
      best = Infinity;
    for (const [id, state] of open) {
      const estimate =
        state.cost + distance({ x: xs[state.x], y: ys[state.y] }, end);
      if (estimate < best) {
        best = estimate;
        current = state;
        currentKey = id;
      }
    }
    open.delete(currentKey);
    if (current.x === endX && current.y === endY) {
      const path: Point[] = [];
      let id: string | undefined = currentKey;
      while (id) {
        const [x, y] = id.split(":").map(Number);
        path.unshift({ x: xs[x], y: ys[y] });
        id = previous.get(id);
      }
      return simplify(path);
    }
    for (const [dx, dy, axis] of [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 2],
      [0, -1, 2],
    ]) {
      const x = current.x + dx,
        y = current.y + dy;
      if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue;
      const a = { x: xs[current.x], y: ys[current.y] },
        b = { x: xs[x], y: ys[y] };
      if (blocked(a, b, boxes)) continue;
      const cost =
        current.cost +
        distance(a, b) +
        congestion(a, b, occupied) +
        (current.axis && current.axis !== axis ? 24 : 0);
      const id = key(x, y, axis);
      if (cost >= (costs.get(id) ?? Infinity)) continue;
      costs.set(id, cost);
      previous.set(id, currentKey);
      open.set(id, { x, y, axis, cost });
    }
  }
  // A valid non-overlapping layout always has a perimeter corridor.
  return [];
}

/** Route through clear lanes rather than through resource cards or group headings. */
export function routeDependencyConnections(
  items: GraphItem[],
  connections: GraphConnection[],
  ports: ReadonlyMap<string, number> = new Map(),
  headings: RoutingObstacle[] = [],
  zoom = 1,
) {
  const records = new Map(items.map((item) => [item.key, item]));
  const clearance = Math.max(12, 10 / zoom);
  const boxes = [...items, ...headings].map((box) => ({
    x: box.x - clearance,
    y: box.y - clearance,
    width: box.width + 2 * clearance,
    height: box.height + 2 * clearance,
  }));
  const ordered = [...connections].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );
  const offset = (connection: GraphConnection, side: "source" | "target") => {
    const item = records.get(connection[side])!;
    const path =
      side === "source"
        ? connection.edges[0].sourceAttributePath
        : connection.edges[0].targetAttributePath;
    return item.node && path !== undefined
      ? ports.get(attributePortKey(item.node.id, path))
      : undefined;
  };
  const port = (connection: GraphConnection, side: "source" | "target") => {
    const item = records.get(connection[side])!;
    const field = offset(connection, side);
    // Converging relationships share the actual destination port. Only outgoing
    // branches fan out; visible attribute rows still have distinct destinations.
    if (side === "target")
      return (
        item.y +
        (field ?? (item.node ? Math.min(26, item.height / 2) : item.height / 2))
      );
    if (field !== undefined) {
      const matching = ordered.filter(
        (other) =>
          other[side] === connection[side] && offset(other, side) === field,
      );
      return (
        item.y +
        field +
        (matching.indexOf(connection) - (matching.length - 1) / 2) *
          Math.min(4, 12 / Math.max(1, matching.length - 1))
      );
    }
    const peers = ordered
      .filter((other) => other[side] === connection[side])
      .sort((a, b) => {
        const opposite = side === "source" ? "target" : "source";
        const aItem = records.get(a[opposite])!,
          bItem = records.get(b[opposite])!;
        return (
          aItem.y +
            (offset(a, opposite) ?? 26) -
            (bItem.y + (offset(b, opposite) ?? 26)) ||
          (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
        );
      });
    const center = item.node ? Math.min(26, item.height / 2) : item.height / 2;
    return (
      item.y +
      center +
      (peers.indexOf(connection) - (peers.length - 1) / 2) *
        Math.min(8, 48 / Math.max(1, peers.length - 1))
    );
  };
  const occupied: { destination: string; points: Point[] }[] = [];
  const routed = ordered.map((connection) => {
    const source = records.get(connection.source)!,
      target = records.get(connection.target)!;
    const start = { x: source.x + source.width, y: port(connection, "source") },
      end = { x: target.x, y: port(connection, "target") };
    // Slightly offset header rows should have one horizontal connection, not
    // a tiny jog underneath the arrowhead. Keep field ports and parallel
    // relationships exact and independently inspectable.
    if (
      source.node &&
      target.node &&
      start.x < end.x &&
      offset(connection, "source") === undefined &&
      offset(connection, "target") === undefined &&
      Math.abs(start.y - end.y) <= 8 &&
      end.y >= source.y + 8 &&
      end.y <= source.y + source.height - 8 &&
      ordered.filter(
        (other) =>
          other.source === connection.source &&
          other.target === connection.target,
      ).length === 1
    )
      start.y = end.y;
    const approach = Math.min(
      Math.max(
        clearance,
        dependencyArrowSize + dependencyArrowShaft + bendRadius,
      ),
      Math.max(clearance, end.x - 8),
    );
    const a = { x: start.x + clearance, y: start.y },
      b = { x: end.x - approach, y: end.y };
    // Reserve the landing corridor as well as its endpoint. Otherwise the
    // shortest-path search can turn or double back inside the arrow's shaft.
    const routeBoxes = boxes.map((box, index) =>
      items[index]?.key === connection.target
        ? {
            ...box,
            x: box.x - (approach - clearance),
            width: box.width + approach - clearance,
          }
        : box,
    );
    const destination = JSON.stringify([connection.target, end.y]);
    // Sharing a destination is intentional bundling, not lane congestion. Do not
    // push these paths into parallel lanes merely to avoid their shared trunk.
    const middle = routeBetween(
      a,
      b,
      routeBoxes,
      occupied
        .filter((route) => route.destination !== destination)
        .map((route) => route.points),
    );
    const points = middle.length
      ? simplify([start, ...middle, end])
      : connection.points;
    occupied.push({ destination, points });
    return {
      ...connection,
      points,
      sourceAttribute:
        offset(connection, "source") !== undefined
          ? connection.edges[0].sourceAttributePath
          : undefined,
      targetAttribute:
        offset(connection, "target") !== undefined
          ? connection.edges[0].targetAttributePath
          : undefined,
    };
  });
  // Key the rendered arrival, rather than just the resource: expanded attributes
  // must never acquire a shared arrow at the wrong field. A failed route also
  // cannot masquerade as a successful convergence at its requested port.
  const destinationKey = (route: (typeof routed)[number]) =>
    JSON.stringify([
      route.target,
      route.targetAttribute ?? null,
      route.points[route.points.length - 1] ?? null,
    ]);
  const counts = new Map<string, number>();
  for (const route of routed) {
    const key = destinationKey(route);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return routed.map((route) => ({
    ...route,
    convergenceKey:
      dependencyConnectionArrival(route.points) !== undefined &&
      counts.get(destinationKey(route))! > 1
        ? destinationKey(route)
        : undefined,
  }));
}

/** Round orthogonal bends without moving endpoints or diagonally cutting across cards. */
export function roundedConnectionPath(points: Point[], radius = bendRadius) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    const amount = Math.min(radius, distance(a, b) / 2, distance(b, c) / 2);
    const entry = {
      x: b.x + Math.sign(a.x - b.x) * amount,
      y: b.y + Math.sign(a.y - b.y) * amount,
    };
    const exit = {
      x: b.x + Math.sign(c.x - b.x) * amount,
      y: b.y + Math.sign(c.y - b.y) * amount,
    };
    path += ` L ${entry.x} ${entry.y} Q ${b.x} ${b.y} ${exit.x} ${exit.y}`;
  }
  const end = points[points.length - 1];
  return `${path} L ${end.x} ${end.y}`;
}
