export type WindowRange = {
  mode: "percent" | "value";
  start: number;
  end: number;
};
export function visibleDomain(
  range: WindowRange,
  domain: [number, number],
): [number, number] {
  if (range.mode === "value") return [range.start, range.end];
  const span = domain[1] - domain[0];
  return [
    domain[0] + (span * range.start) / 100,
    domain[0] + (span * range.end) / 100,
  ];
}
export function zoomBy(
  range: WindowRange,
  domain: [number, number],
  factor: number,
): WindowRange {
  if (!factor) return { mode: "percent", start: 0, end: 100 };
  const span = domain[1] - domain[0];
  const [low, high] = visibleDomain(range, domain).map(
    (value) => ((value - domain[0]) / span) * 100,
  );
  const size = Math.min(100, Math.max(1, (high - low) * factor));
  const start = Math.max(0, Math.min(100 - size, (low + high - size) / 2));
  return { mode: "percent", start, end: start + size };
}
