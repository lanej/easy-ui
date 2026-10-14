import React from "react";
import type { DependencyGraphNode } from "./types";
import styles from "./DependencyGraph.module.scss";
/** Caller-owned labels; their text carries no inferred change or risk semantics. */
export function DependencyGraphCategories({
  categories,
}: Pick<DependencyGraphNode, "categories">) {
  return (
    <>
      {categories
        ?.filter((label) => label.trim())
        .map((label, index) => (
          <span
            key={`${index}:${label}`}
            className={styles.category}
            data-graph-category
            title={label}
          >
            {label}
          </span>
        ))}
    </>
  );
}
