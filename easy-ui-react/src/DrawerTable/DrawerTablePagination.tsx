import React from "react";
import { Pagination, PaginationPageControlsProps } from "../Pagination";

export type DrawerTablePaginationProps = PaginationPageControlsProps;

export function DrawerTablePagination(props: DrawerTablePaginationProps) {
  return <Pagination.PageControls size="sm" wrap {...props} />;
}
