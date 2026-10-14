import React from "react";
import type { DependencyGraphNode } from "./types";
import styles from "./DependencyGraph.module.scss";
import categoryStyles from "./DependencyGraphCategories.module.scss";

/** Only labels participate in search and accessible names, never presentation. */
export function dependencyGraphCategoryLabels(
  categories: DependencyGraphNode["categories"],
): string[] {
  return (categories ?? [])
    .map((category) =>
      typeof category === "string" ? category : category.label,
    )
    .filter((label) => label.trim().length > 0);
}

/** Caller-owned labels and colors; neither implies a plan action or risk. */
export function DependencyGraphCategories({
  categories,
}: Pick<DependencyGraphNode, "categories">) {
  return (
    <>
      {categories?.map((category, index) => {
        const label = typeof category === "string" ? category : category.label;
        if (!label.trim()) return null;
        const variant =
          typeof category === "string"
            ? "neutral"
            : (category.variant ?? "neutral");
        return (
          <span
            key={`${index}:${label}`}
            className={`${styles.category} ${categoryStyles.root}`}
            data-graph-category
            data-category-variant={variant}
            title={label}
          >
            {label}
          </span>
        );
      })}
    </>
  );
}
