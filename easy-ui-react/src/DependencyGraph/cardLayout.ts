import type { GraphItem } from "./model";
import type { DependencyGroupHierarchy } from "./groups";
import type {
  DependencyGraphCardLayout,
  DependencyGraphCardLayouts,
} from "./types";

export const minimumCardWidth = 192;
export const minimumCardHeight = 96;

/** Ignore non-finite values and clamp dimensions without mutating caller state. */
export function normalizeCardLayout(
  value: DependencyGraphCardLayout = {},
): DependencyGraphCardLayout {
  return Object.fromEntries(
    (["x", "y", "width", "height"] as const).flatMap((key) => {
      const number = value[key];
      const minimum =
        key === "width"
          ? minimumCardWidth
          : key === "height"
            ? minimumCardHeight
            : 0;
      return typeof number === "number" && Number.isFinite(number)
        ? [[key, Math.max(minimum, Math.round(number))]]
        : [];
    }),
  );
}

/** Apply manual placement before computing group bounds, routing and scene extents. */
export function positionDependencyCards(
  items: readonly GraphItem[],
  layouts: DependencyGraphCardLayouts,
  hierarchy: DependencyGroupHierarchy,
  zoom: number,
) {
  return items.map((item) => {
    if (!item.node) return item;
    const value = normalizeCardLayout(layouts[item.node.id]);
    const depth = hierarchy.paths.get(item.node.groupId!)?.length ?? 0;
    return {
      ...item,
      x: value.x === undefined ? item.x : Math.max(16 + depth * 16, value.x),
      y:
        value.y === undefined
          ? item.y
          : Math.max(16 + depth * Math.max(44, 25 / zoom + 8), value.y),
    };
  });
}
