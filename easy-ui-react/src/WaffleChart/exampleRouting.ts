/** Caller-owned routing for the synthetic connection-layer example, not chart semantics. */
export type ExampleConnectionBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type ExampleConnectionPoint = { x: number; y: number };

export function routeExampleConnection({
  source,
  destination,
  pool,
  frame,
  lane,
  sourcePort,
  sourcePortCount,
  targetPort,
  targetPortCount,
}: {
  source: ExampleConnectionBounds;
  destination: ExampleConnectionBounds;
  pool: ExampleConnectionBounds;
  frame: ExampleConnectionBounds;
  lane: number;
  sourcePort: number;
  sourcePortCount: number;
  targetPort: number;
  targetPortCount: number;
}) {
  const stacked = destination.left < pool.right;
  const sourceY =
    source.top +
    source.height / 2 +
    (sourcePort - (sourcePortCount - 1) / 2) * 10;
  const targetY =
    destination.top +
    destination.height / 2 +
    (targetPort - (targetPortCount - 1) / 2) * 10;
  const laneX = pool.right + 8 + lane * 8;
  const points: readonly ExampleConnectionPoint[] = [
    { x: source.right - frame.left, y: sourceY - frame.top },
    { x: laneX - frame.left, y: sourceY - frame.top },
    { x: laneX - frame.left, y: targetY - frame.top },
    {
      x: (stacked ? destination.right : destination.left) - frame.left,
      y: targetY - frame.top,
    },
  ];
  return {
    points,
    path: points
      .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
      .join(" "),
  };
}
