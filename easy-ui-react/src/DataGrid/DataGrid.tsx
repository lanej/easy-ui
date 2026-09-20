import { Key } from "@react-types/shared";
import React, { useCallback, useMemo, useState } from "react";
import { Cell, Column, Row, TableBody, TableHeader } from "react-stately";
import { ActionsCellContent } from "./ActionsCellContent";
import { DataGridFooter } from "./Footer";
import { DataGridPagination } from "./DataGridPagination";
import { DataGridRowsPerPage } from "./DataGridRowsPerPage";
import { ExpandCellContent } from "./ExpandCellContent";
import { Table } from "./Table";
import { GroupToggleCellContent } from "./GroupToggleCellContent";
import { useCollapsedGroups } from "./useCollapsedGroups";
import { GroupedRow, useGroupedRows } from "./useGroupedRows";
import { VisuallyHiddenCellContent } from "./VisuallyHiddenCellContent";
import { ACTIONS_COLUMN_KEY, EXPAND_COLUMN_KEY } from "./constants";
import { DataGridContext } from "./context";
import { Column as ColumnType, Row as RowType, DataGridProps } from "./types";

/**
 * A `DataGrid` is an interactive table used for working with a large
 * collection of data in a scannable way.
 *
 * @remarks
 * Use a `<DataGrid />` for interactive, tabular data. Prefer simpler table
 * components for rendering static data.
 *
 * @example
 * <DataGrid
 *   aria-label="Basic data grid"
 *   columns={[
 *     { key: "name", name: "Name" },
 *     { key: "email", name: "Email" },
 *   ]}
 *   rows={[
 *     {
 *       key: 1,
 *       name: "Julie Smith",
 *       email: "julie.smith@example.com",
 *     },
 *     {
 *       key: 2,
 *       name: "Sam Frost",
 *       email: "sam.frost@example.com",
 *     },
 *   ]}
 *   renderColumnCell={(column) => (
 *     <span>{String(column.name)}</span>
 *   )}
 *   renderRowCell={(item) => (
 *     <span>{String(item)}</span>
 *   )}
 * />
 */
export function DataGrid<
  C extends ColumnType = ColumnType,
  R extends RowType = RowType,
>(props: DataGridProps<C, R>) {
  const {
    columns: unprocessedColumns,
    columnKeysAllowingSort = [],
    defaultExpandedKey,
    expandedKey: expandedKeyFromUser,
    grouping,
    onExpandedChange = () => {},
    renderColumnCell,
    renderExpandedRow,
    renderRowCell,
    rowActions,
    selectionMode,
  } = props;

  if (!Array.isArray(unprocessedColumns) || unprocessedColumns.length === 0) {
    throw new Error("DataGrid must contain a non-empty array of columns");
  }

  if (
    (selectionMode === "single" || selectionMode === "multiple") &&
    renderExpandedRow
  ) {
    throw new Error(
      "DataGrid does not support selection and row expansion at the same time",
    );
  }

  // For now, per design, the first column is always the row header. In the
  // future, this could be made dynamic
  const rowHeaderColumnKey = unprocessedColumns[0].key;

  const isRowExpansionControlled = expandedKeyFromUser !== undefined;
  const [uncontrolledExpandedKey, setExpandedKey] = useState<Key | null>(
    defaultExpandedKey ?? null,
  );
  const expandedKey = isRowExpansionControlled
    ? expandedKeyFromUser
    : uncontrolledExpandedKey;

  const toggleExpandedRow = useCallback(
    (rowKey: Key) => {
      const nextKey = expandedKey === rowKey ? null : rowKey;
      onExpandedChange(nextKey);
      if (!isRowExpansionControlled) {
        setExpandedKey(nextKey);
      }
    },
    [expandedKey, isRowExpansionControlled, onExpandedChange],
  );

  const columns = useProcessedColumns(props);
  const { items, subtotalKeys } = useGroupedRows(props);
  const { allItems, collapsedRowKeys, toggleGroup } = useCollapsedGroups(
    items,
    grouping,
  );
  const rows = useProcessedRows(props, allItems, expandedKey);
  const visibleRows = useMemo(
    () =>
      collapsedRowKeys.size
        ? rows.filter((row) => !collapsedRowKeys.has(row.key))
        : rows,
    [rows, collapsedRowKeys],
  );

  const context = useMemo(() => {
    return { expandedKey, setExpandedKey };
  }, [expandedKey]);

  const renderRow = (row: (typeof rows)[number]) => (
    <Row>
      {(columnKey) => {
        if (row.type === "subtotal") {
          const isActionColumn =
            columnKey === EXPAND_COLUMN_KEY || columnKey === ACTIONS_COLUMN_KEY;
          const value = row.values.get(columnKey);
          const content = isActionColumn
            ? null
            : grouping?.renderSubtotalCell
              ? grouping.renderSubtotalCell(value, columnKey, row.group)
              : String(value ?? "");
          return (
            <Cell>
              {grouping?.isCollapsible && columnKey === rowHeaderColumnKey ? (
                <GroupToggleCellContent
                  groupLabel={row.label}
                  isCollapsed={Boolean(row.isCollapsed)}
                  onToggle={() => toggleGroup(row.group.key)}
                >
                  {content}
                </GroupToggleCellContent>
              ) : (
                content
              )}
            </Cell>
          );
        }
        return (
          <Cell>
            {columnKey === EXPAND_COLUMN_KEY ? (
              <ExpandCellContent
                isExpanded={row.key === expandedKey}
                toggleExpanded={() => toggleExpandedRow(row.key)}
              />
            ) : columnKey === ACTIONS_COLUMN_KEY && rowActions ? (
              <ActionsCellContent rowActions={rowActions(row.key)} />
            ) : (
              renderRowCell(row.row[columnKey as keyof R], columnKey, row.row)
            )}
          </Cell>
        );
      }}
    </Row>
  );

  return (
    <DataGridContext.Provider value={context}>
      <Table
        {...props}
        subtotalKeys={subtotalKeys}
        collapsedRowKeys={collapsedRowKeys}
        allRowsBody={
          // Selection needs every row key and column, but only visible rows
          // need consumer-rendered contents or row action configuration.
          collapsedRowKeys.size ? (
            <TableBody items={rows}>
              {() => <Row>{() => <Cell>{null}</Cell>}</Row>}
            </TableBody>
          ) : undefined
        }
      >
        <TableHeader columns={columns}>
          {(column) => (
            <Column
              isRowHeader={column.key === rowHeaderColumnKey}
              allowsSorting={
                column.key === EXPAND_COLUMN_KEY ||
                column.key === ACTIONS_COLUMN_KEY
                  ? false
                  : columnKeysAllowingSort.includes(column.key)
              }
            >
              {column.key === EXPAND_COLUMN_KEY ? (
                <VisuallyHiddenCellContent>
                  Expand row
                </VisuallyHiddenCellContent>
              ) : column.key === ACTIONS_COLUMN_KEY ? (
                <VisuallyHiddenCellContent>
                  Row actions
                </VisuallyHiddenCellContent>
              ) : (
                renderColumnCell(column)
              )}
            </Column>
          )}
        </TableHeader>
        <TableBody items={visibleRows}>{renderRow}</TableBody>
      </Table>
    </DataGridContext.Provider>
  );
}

/**
 * Lays footer content out into start, center, and end regions.
 *
 * @remarks
 * Pass to a `<DataGrid />` through `renderFooter`. The regions are positional
 * rather than named after what they hold, so the footer isn't tied to any one
 * scheme for paging through the grid.
 */
DataGrid.Footer = DataGridFooter;

/**
 * A pagination preset for use within a `<DataGrid.Footer />`.
 *
 * @remarks
 * Derives its button states from the current page and page count.
 */
DataGrid.Pagination = DataGridPagination;

/**
 * A menu for choosing how many rows a `<DataGrid />` page shows.
 *
 * @remarks
 * Typically placed in the end region of a `<DataGrid.Footer />`.
 */
DataGrid.RowsPerPage = DataGridRowsPerPage;

/**
 * Modifies the passed in columns to include support for Easy UI requirements.
 * This is done before being passed into React Stately's Column interface.
 *
 * @param props data grid props
 * @returns processed columns
 */
function useProcessedColumns<C extends ColumnType>(
  props: Pick<DataGridProps<C>, "renderExpandedRow" | "columns" | "rowActions">,
) {
  const { renderExpandedRow, columns, rowActions } = props;
  const hasExpandableRows = Boolean(renderExpandedRow);
  const hasRowActions = Boolean(rowActions);
  return useMemo(() => {
    let c = columns;
    if (hasExpandableRows) {
      c = [{ key: EXPAND_COLUMN_KEY } as C, ...c];
    }
    if (hasRowActions) {
      c = [...c, { key: ACTIONS_COLUMN_KEY } as C];
    }
    return c;
  }, [columns, hasExpandableRows, hasRowActions]);
}

/**
 * Modifies the passed in rows to include support for Easy UI requirements.
 * This is done before being passed into React Stately's Row interface.
 *
 * @param props data grid props
 * @param items the grouped collection items
 * @param expandedKey the currently expanded row key
 * @returns processed rows
 */
function useProcessedRows<C extends ColumnType, R extends RowType>(
  props: Pick<DataGridProps<C, R>, "renderExpandedRow" | "rowActions">,
  items: GroupedRow<R>[],
  expandedKey: Key | null,
) {
  const { renderExpandedRow, rowActions } = props;

  const hasExpandableRows = Boolean(renderExpandedRow);
  const hasRowActions = Boolean(rowActions);

  return useMemo(() => {
    const mappedRows = items.map((item) => {
      if (item.type === "subtotal") {
        return item;
      }
      const { row } = item;
      let r = row;
      if (hasExpandableRows) {
        r = { [EXPAND_COLUMN_KEY]: expandedKey === row.key, ...r };
      }
      if (hasRowActions) {
        r = { ...r, [ACTIONS_COLUMN_KEY]: true };
      }
      return {
        ...item,
        row: r,
        [EXPAND_COLUMN_KEY]: hasExpandableRows && expandedKey === row.key,
      };
    });
    return mappedRows;
  }, [items, hasExpandableRows, hasRowActions, expandedKey]);
}
