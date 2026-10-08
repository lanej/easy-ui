import React from "react";
import { Pagination } from "../Pagination";
import type { PaginationPageControlsProps } from "../Pagination";

export type DataGridPaginationProps = Omit<
  PaginationPageControlsProps,
  "size" | "wrap"
>;

/**
 * A fully controlled pagination preset for use within a data grid footer.
 *
 * @remarks
 * This derives the first, previous, next, and last button states from `page`
 * and `count` so consumers only supply where they are and how to get
 * elsewhere. Reach for `<Pagination />` directly for anything this doesn't
 * cover; the data grid footer doesn't require this component.
 *
 * @example
 * ```tsx
 * <DataGrid.Pagination page={page} count={10} onChange={setPage} />
 * ```
 */
export function DataGridPagination(props: DataGridPaginationProps) {
  return <Pagination.PageControls {...props} size="sm" />;
}

DataGridPagination.displayName = "DataGrid.Pagination";
