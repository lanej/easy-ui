import { useState } from "react";
import type { MapSurfaceMetric } from "./types";

/**
 * Selects exactly one delivery-surface metric to render at a time. Mirrors
 * `useLayerVisibility`'s controlled/uncontrolled toggle pattern, but for a single choice from a
 * list rather than a boolean: an explicit selection wins once made; otherwise the first supplied
 * metric is the default. Returns `undefined` when no metrics are supplied, so callers can fall
 * back to the legacy single-layer paint.
 */
export function useSurfaceMetric(
  metrics: readonly MapSurfaceMetric[] | undefined,
) {
  const [key, setKey] = useState<string | undefined>(undefined);
  const activeMetric =
    metrics?.find((metric) => metric.key === key) ?? metrics?.[0];
  const setActiveMetric = (nextKey: string) => setKey(nextKey);
  return { activeMetric, setActiveMetric };
}
