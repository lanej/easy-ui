import React, { ReactNode, useState } from "react";
import { AriaLabelingProps, Key } from "@react-types/shared";
import { Pagination } from "../Pagination";
import { DrawerRow, DrawerRowProps } from "./DrawerRow";
import { DrawerTablePagination } from "./DrawerTablePagination";
import styles from "./DrawerTable.module.scss";

export type DrawerTableProps<R extends { readonly key: Key }> =
  AriaLabelingProps & {
    /** Application-ordered rows with unique, stable keys. */
    rows: readonly R[];
    /** Visible summary content. Use phrasing content without controls. */
    renderRow: (row: R) => ReactNode;
    /** Inline detail content, mounted only for the open row by default. */
    renderExpandedRow: (row: R) => ReactNode;
    /** Optional independent actions outside the disclosure trigger. */
    renderRowActions?: (row: R) => ReactNode;
    /** Optional concise accessible name for each summary button. */
    getRowLabel?: (row: R) => string;
    /** Optionally disable individual disclosure triggers. */
    isRowDisabled?: (row: R) => boolean;
    /** Controlled open row. null closes all rows. */
    expandedKey?: R["key"] | null;
    /** Initially open row when uncontrolled. */
    defaultExpandedKey?: R["key"];
    /** Requested next row key, or null on closing the current row. */
    onExpandedChange?: (key: R["key"] | null) => void;
    /** Content mounting behavior. Defaults to unmount. */
    mountPolicy?: DrawerRowProps["mountPolicy"];
    /** Optional application-owned empty content. */
    emptyContent?: ReactNode;
    /** Optional footer, outside the list, for pagination or other controls. */
    renderFooter?: () => ReactNode;
  };

export function DrawerTable<R extends { readonly key: Key }>({
  rows,
  renderRow,
  renderExpandedRow,
  renderRowActions,
  getRowLabel,
  isRowDisabled,
  expandedKey,
  defaultExpandedKey,
  onExpandedChange,
  mountPolicy,
  emptyContent,
  renderFooter,
  ...labeling
}: DrawerTableProps<R>) {
  const [localKey, setLocalKey] = useState<R["key"] | null>(
    defaultExpandedKey ?? null,
  );
  const controlled = expandedKey !== undefined;
  const openKey = controlled ? expandedKey : localKey;
  return (
    <div className={styles.root}>
      {rows.length ? (
        <ul {...labeling} role="list" className={styles.list}>
          {rows.map((row) => (
            <li key={`${typeof row.key}:${row.key}`}>
              <DrawerRow
                summary={renderRow(row)}
                aria-label={getRowLabel?.(row)}
                actions={renderRowActions?.(row)}
                isDisabled={isRowDisabled?.(row)}
                isExpanded={openKey === row.key}
                mountPolicy={mountPolicy}
                onExpandedChange={(isExpanded) => {
                  const next = isExpanded ? row.key : null;
                  if (!controlled) setLocalKey(next);
                  onExpandedChange?.(next);
                }}
              >
                {openKey === row.key || mountPolicy === "preserve"
                  ? renderExpandedRow(row)
                  : null}
              </DrawerRow>
            </li>
          ))}
        </ul>
      ) : (
        emptyContent
      )}
      {renderFooter && <div className={styles.footer}>{renderFooter()}</div>}
    </div>
  );
}

DrawerTable.Pagination = DrawerTablePagination;
DrawerTable.RowsPerPage = Pagination.RowsPerPage;
