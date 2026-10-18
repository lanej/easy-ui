import { routeExampleConnection } from "./exampleRouting";
import type {
  ExampleConnectionBounds,
  ExampleConnectionPoint,
} from "./exampleRouting";

const bounds = (
  left: number,
  top: number,
  width: number,
  height: number,
): ExampleConnectionBounds => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});
const relationships = [
  { id: "shared-atlas", source: "shared", target: "atlas" },
  { id: "shared-beacon", source: "shared", target: "beacon" },
  { id: "specialist-beacon", source: "specialist", target: "beacon" },
];

function intersects(
  a: ExampleConnectionPoint,
  b: ExampleConnectionPoint,
  obstacle: ExampleConnectionBounds,
) {
  const left = obstacle.left + 1;
  const right = obstacle.right - 1;
  const top = obstacle.top + 1;
  const bottom = obstacle.bottom - 1;
  if (a.y === b.y)
    return (
      a.y > top &&
      a.y < bottom &&
      Math.max(Math.min(a.x, b.x), left) < Math.min(Math.max(a.x, b.x), right)
    );
  if (a.x === b.x)
    return (
      a.x > left &&
      a.x < right &&
      Math.max(Math.min(a.y, b.y), top) < Math.min(Math.max(a.y, b.y), bottom)
    );
  throw new Error("Example paths must stay orthogonal");
}

it.each(
  [280, 390, 1200].flatMap((width) =>
    [0, 160].map((detailsGrowth) => ({ width, detailsGrowth })),
  ),
)(
  "keeps every connection outside content at $width px with $detailsGrowth px of detail growth",
  ({ width, detailsGrowth }) => {
    const stacked = width < 614;
    const frameWidth = Math.min(width - 32, 820);
    const poolWidth = Math.min(280, frameWidth - (stacked ? 32 : 0));
    const pool = bounds(16, 140, poolWidth, 460 + detailsGrowth);
    const frame = bounds(
      16,
      140,
      frameWidth,
      stacked ? 740 + detailsGrowth : 460 + detailsGrowth,
    );
    const sourceWidth = Math.min(204, poolWidth - 26);
    const sources = {
      shared: bounds(29, 180, sourceWidth, 76),
      specialist: bounds(29, 276, Math.min(150, sourceWidth), 76),
      unlinked: bounds(29, 372, Math.min(150, sourceWidth), 76),
    };
    const destinations = {
      atlas: bounds(
        stacked ? pool.left : pool.right + 54,
        stacked ? pool.bottom + 24 : pool.top + 36,
        stacked ? poolWidth : frameWidth - poolWidth - 54,
        100,
      ),
      beacon: bounds(
        stacked ? pool.left : pool.right + 54,
        stacked ? pool.bottom + 148 : pool.top + 192,
        stacked ? poolWidth : frameWidth - poolWidth - 54,
        120,
      ),
    };
    const legend = bounds(29, 468, poolWidth - 26, 48);
    const details = bounds(29, 532, poolWidth - 26, 56 + detailsGrowth);
    const obstacles = [
      ...Object.values(sources),
      ...Object.values(destinations),
      legend,
      details,
    ].map((rect) =>
      bounds(
        rect.left - frame.left,
        rect.top - frame.top,
        rect.width,
        rect.height,
      ),
    );
    const paths = relationships.map((relationship, lane) => {
      const outgoing = relationships.filter(
        (edge) => edge.source === relationship.source,
      );
      const incoming = relationships.filter(
        (edge) => edge.target === relationship.target,
      );
      return routeExampleConnection({
        source: sources[relationship.source as "shared" | "specialist"],
        destination: destinations[relationship.target as "atlas" | "beacon"],
        pool,
        frame,
        lane,
        sourcePort: outgoing.findIndex((edge) => edge.id === relationship.id),
        sourcePortCount: outgoing.length,
        targetPort: incoming.findIndex((edge) => edge.id === relationship.id),
        targetPortCount: incoming.length,
      });
    });
    expect(paths).toHaveLength(3);
    expect(paths[0].points[0].y).not.toBe(paths[1].points[0].y);
    expect(paths[1].points[3].y).not.toBe(paths[2].points[3].y);
    for (const { points, path } of paths) {
      expect(path).toMatch(/^M .+ L .+ L .+ L /);
      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(frame.width);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(frame.height);
      }
      for (let index = 1; index < points.length; index++)
        expect(
          obstacles.some((obstacle) =>
            intersects(points[index - 1], points[index], obstacle),
          ),
        ).toBe(false);
    }
  },
);
