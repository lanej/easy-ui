import React, { useEffect, useState, type RefObject } from "react";
import styles from "./ScoreComposition.module.scss";

/** An attachment point in the containing SVG's coordinate system. */
export type ScoreConnectorPoint = { x: number; y: number };
export type ScoreConnectorProps = {
  from: ScoreConnectorPoint;
  to: ScoreConnectorPoint;
  /** Subdued dashed relationship for an explicitly untriggered source. */
  isInactive?: boolean;
  /** Emphasize a relationship being inspected, without changing its meaning. */
  isHighlighted?: boolean;
};

/** Decorative Bézier path for an SVG layer. Exact relationships belong in the DOM. */
export function ScoreConnector({
  from,
  to,
  isInactive = false,
  isHighlighted = false,
}: ScoreConnectorProps) {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return null;
  const middle = (from.x + to.x) / 2;
  return (
    <path
      className={styles.connector}
      aria-hidden="true"
      data-inactive={isInactive}
      data-highlighted={isHighlighted}
      d={`M ${from.x} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export type ScoreConnection = {
  from: readonly ["signal" | "contribution", string];
  to: readonly ["contribution" | "result", string];
  contributionId: string;
  isInactive?: boolean;
};
type MeasuredConnection = ScoreConnectorProps & {
  key: string;
  contributionId: string;
};
type Geometry = { width: number; height: number; paths: MeasuredConnection[] };

/** Measure ordinary DOM nodes after mount; SSR and small containers need no diagram. */
export function ScoreConnectorLayer({
  layoutRef,
  connections,
  highlightedContribution,
}: {
  layoutRef: RefObject<HTMLDivElement | null>;
  connections: readonly ScoreConnection[];
  highlightedContribution: string | null;
}) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const nodes = [
      ...layout.querySelectorAll<HTMLElement>("[data-score-node]"),
    ].filter((node) => node.closest("[data-score-layout]") === layout);
    const byId = new Map(
      nodes.map((node) => [
        JSON.stringify([node.dataset.scoreNode, node.dataset.scoreId]),
        node,
      ]),
    );
    const measure = () => {
      const bounds = layout.getBoundingClientRect();
      const paths: MeasuredConnection[] = [];
      for (const connection of connections) {
        const from = byId
          .get(JSON.stringify(connection.from))
          ?.getBoundingClientRect();
        const to = byId
          .get(JSON.stringify(connection.to))
          ?.getBoundingClientRect();
        if (!from?.width || !to?.width) continue;
        const rightward = from.right <= to.left;
        const leftward = to.right <= from.left;
        // Stacked layouts have no connecting gutter. Keep all relationships in text.
        if (!rightward && !leftward) continue;
        paths.push({
          key: JSON.stringify([connection.from, connection.to]),
          contributionId: connection.contributionId,
          isInactive: connection.isInactive,
          from: {
            x: (rightward ? from.right : from.left) - bounds.left,
            y: from.top + from.height / 2 - bounds.top,
          },
          to: {
            x: (rightward ? to.left : to.right) - bounds.left,
            y: to.top + to.height / 2 - bounds.top,
          },
        });
      }
      setGeometry(
        bounds.width && bounds.height
          ? { width: bounds.width, height: bounds.height, paths }
          : null,
      );
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(layout);
    nodes.forEach((node) => observer?.observe(node));
    window.addEventListener("resize", measure);
    // Disclosure changes need fresh endpoints even in ResizeObserver-less environments.
    const mutations = new MutationObserver(measure);
    nodes.forEach((node) =>
      mutations.observe(node, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      }),
    );
    // Direction and inherited layout can change without resizing a node.
    // Watch only ancestor attributes, never the SVG updated by measurement.
    for (
      let ancestor: HTMLElement | null = layout;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      mutations.observe(ancestor, {
        attributes: true,
        attributeFilter: ["dir", "class", "style"],
      });
    }
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [layoutRef, connections]);
  if (!geometry?.paths.length) return null;
  return (
    <svg
      className={styles.connectors}
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    >
      {geometry.paths.map(({ key, contributionId, ...points }) => (
        <ScoreConnector
          key={key}
          {...points}
          isHighlighted={contributionId === highlightedContribution}
        />
      ))}
    </svg>
  );
}
