import { useLayoutEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import type { RoutingObstacle } from "./routing";
import type { DependencyGraphProps } from "./types";

type Cluster = RoutingObstacle & { group: { id: string } };
type Measurement = {
  clusters: readonly Cluster[];
  zoom: number;
  boxes: RoutingObstacle[];
};
const sameBoxes = (a: RoutingObstacle[], b: RoutingObstacle[]) =>
  a.length === b.length &&
  a.every((box, index) =>
    (["x", "y", "width", "height"] as const).every(
      (key) => Math.abs(box[key] - b[index][key]) < 0.01,
    ),
  );

/** Protect actual labels and controls, not the empty space across a subgraph. */
export function useDependencyGraphHeadings(
  viewport: RefObject<HTMLDivElement | null>,
  clusters: readonly Cluster[],
  zoom: number,
  status: DependencyGraphProps["status"],
) {
  const [measurement, setMeasurement] = useState<Measurement>();
  useLayoutEffect(() => {
    const canvas = viewport.current?.querySelector<HTMLElement>(
      "[data-graph-scene]",
    );
    if (!canvas || !clusters.length) return;
    const headings = [
      ...canvas.querySelectorAll<HTMLElement>("[data-graph-group-heading]"),
    ];
    if (headings.length !== clusters.length) return;
    const controls = headings.flatMap((heading) => [
      ...heading.querySelectorAll<HTMLButtonElement>("button"),
    ]);
    let active = true;
    const measure = () => {
      if (!active) return;
      const origin = canvas.getBoundingClientRect();
      if (!origin.width) return;
      const unit =
        (parseFloat(getComputedStyle(document.documentElement).fontSize) ||
          16) / 16;
      const scale = zoom * unit;
      const rectangles = controls.map((control) =>
        control.getBoundingClientRect(),
      );
      if (!rectangles.length || rectangles.some((r) => !r.width || !r.height))
        return;
      const boxes = rectangles.map((rect) => ({
        x: (rect.left - origin.left) / scale,
        y: (rect.top - origin.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      }));
      setMeasurement((previous) =>
        previous?.clusters === clusters &&
        previous.zoom === zoom &&
        sameBoxes(previous.boxes, boxes)
          ? previous
          : { clusters, zoom, boxes },
      );
    };
    // Resolve the initial conservative obstacle before paint, including after
    // disclosure, label changes, zoom, or a loading-to-ready transition.
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    for (const element of [...headings, ...controls]) observer?.observe(element);
    // A font can change label geometry without changing any graph input.
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [viewport, clusters, zoom, status]);

  return useMemo(
    () =>
      measurement?.clusters === clusters && measurement.zoom === zoom
        ? measurement.boxes
        : clusters.map((cluster) => ({
            x: cluster.x,
            y: cluster.y,
            width: cluster.width,
            height: Math.max(36, 25 / zoom + 4),
          })),
    [measurement, clusters, zoom],
  );
}
