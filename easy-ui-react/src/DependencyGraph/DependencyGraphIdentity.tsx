import React from "react";
import { Icon } from "../Icon";
import { dependencyChangeLabels } from "./model";
import type { DependencyGraphNode } from "./types";
import styles from "./DependencyGraph.module.scss";

const compactChanges = {
  create: "+",
  update: "~",
  replace: "↻",
  delete: "−",
  unchanged: "=",
  unknown: "?",
} as const;

/** Preserve the distinguishing suffix without interpreting the caller's identifier. */
function ResourceLabel({ label }: { label: string }) {
  const characters = Array.from(label);
  if (characters.length <= 32) return <>{label}</>;
  return (
    <span className={styles.middleLabel}>
      <span className={styles.labelPrefix}>
        {characters.slice(0, -18).join("")}
      </span>
      <span className={styles.labelSuffix}>
        <span>{characters.slice(-18).join("")}</span>
      </span>
    </span>
  );
}

/** Identity is caller-owned; source edits are never converted into plan actions. */
export function DependencyGraphIdentity({
  node,
  overview,
}: {
  node: DependencyGraphNode;
  overview: boolean;
}) {
  const summary = node.changeSummary ?? node.description;
  return (
    <>
      <span className={styles.nodeTop}>
        {node.icon && (
          <span className={styles.resourceIcon}>
            <Icon symbol={node.icon} size="sm" />
          </span>
        )}
        <strong
          className={styles.nodeLabel}
          title={node.address ?? node.label}
          data-graph-resource-label
        >
          <ResourceLabel label={node.label} />
        </strong>
      </span>
      {(node.typeLabel || node.kind === "unresolved" || node.change) && (
        <span className={styles.nodeMetadata}>
          {node.kind === "unresolved" && (
            <span className={styles.referenceLabel}>Unresolved</span>
          )}
          {node.typeLabel && (
            <span className={styles.nodeType} title={node.typeLabel}>
              {node.typeLabel}
            </span>
          )}
          {node.change && (
            <span
              className={styles.change}
              data-change={node.change}
              title={dependencyChangeLabels[node.change]}
              role="img"
              aria-label={dependencyChangeLabels[node.change]}
            >
              {overview ||
              node.change === "unknown" ||
              node.change === "unchanged"
                ? compactChanges[node.change]
                : dependencyChangeLabels[node.change]}
            </span>
          )}
        </span>
      )}
      {summary && node.kind !== "unresolved" && (
        <span className={styles.nodeDescription} title={summary}>
          {summary}
        </span>
      )}
    </>
  );
}
