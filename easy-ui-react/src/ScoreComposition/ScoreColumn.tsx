import React, { type ReactNode } from "react";
import { Disclosure } from "../Disclosure";
import { ScoreDisclosureTitle } from "./ScoreDisclosureTitle";
import type { ScoreCompositionColumn, ScoreCompositionLabels } from "./types";
import styles from "./ScoreComposition.module.scss";

/** Preserve nested disclosure and application state while a column is hidden. */
export function ScoreColumn({
  column,
  labelId,
  label,
  count,
  isCollapsed,
  onExpandedChange,
  labels,
  children,
}: {
  column: ScoreCompositionColumn;
  labelId: string;
  label: string;
  count: number;
  isCollapsed: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
  labels: Required<ScoreCompositionLabels>;
  children: ReactNode;
}) {
  return (
    <div
      className={styles.column}
      data-score-column={column}
      data-collapsed={isCollapsed}
    >
      {count > 0 ? (
        <Disclosure
          isExpanded={!isCollapsed}
          onExpandedChange={onExpandedChange}
          mountPolicy="preserve"
        >
          <ScoreDisclosureTitle
            className={styles.columnHeader}
            accessibleLabel={`${isCollapsed ? labels.expand : labels.collapse}: ${label} (${count})`}
          >
            <span className={styles.columnName} id={labelId}>
              {label}
            </span>
            {isCollapsed && (
              <span className={styles.columnCount} aria-hidden="true">
                {count}
              </span>
            )}
          </ScoreDisclosureTitle>
          <Disclosure.Content className={styles.columnContent}>
            {children}
          </Disclosure.Content>
        </Disclosure>
      ) : (
        <>
          <div className={styles.columnLabel} id={labelId}>
            {label}
          </div>
          {children}
        </>
      )}
    </div>
  );
}
