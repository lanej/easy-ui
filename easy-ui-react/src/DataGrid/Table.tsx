import { Key } from "@react-types/shared";
import React, { CSSProperties, ReactElement, useMemo, useRef } from "react";
import { useTable } from "react-aria";
import { useTableState } from "react-stately";
import { classNames, getComponentToken, variationName } from "../utilities/css";
import { Cell, StaticCell } from "./Cell";
import { ColumnHeader } from "./ColumnHeader";
import { ExpandedRowContent } from "./ExpandedRowContent";
import { HeaderRow } from "./HeaderRow";
import { Row, StaticRow } from "./Row";
import { RowGroup } from "./RowGroup";
import {
  ACTIONS_COLUMN_KEY,
  DEFAULT_MAX_ROWS,
  DEFAULT_SIZE,
  EXPAND_COLUMN_KEY,
} from "./constants";
import { DataGridTableContext } from "./context";
import { FooterShell } from "./Footer";
import { Column, DataGridProps, Row as RowType } from "./types";
import { useEdgeInterceptors } from "./useEdgeInterceptors";
import { useExpandedRow } from "./useExpandedRow";
import { useFooterWidth } from "./useFooterWidth";
import { Spinner } from "../Spinner";

import styles from "./DataGrid.module.scss";

type TableProps<C extends Column, R extends RowType> = Omit<
  DataGridProps<C, R>,
  "children"
> & {
  children?: [ReactElement, ReactElement];
  subtotalKeys: ReadonlySet<Key>;
};

export function Table<C extends Column, R extends RowType>(
  props: TableProps<C, R>,
) {
  const {
    headerVariant,
    columnOptions,
    maxHeight,
    maxRows = DEFAULT_MAX_ROWS,
    renderExpandedRow = (r) => r,
    selectionMode,
    size = DEFAULT_SIZE,
    renderEmptyState = () => "No Data",
    renderFooter,
    isLoading = false,
    subtotalKeys,
  } = props;

  const hasFooter = Boolean(renderFooter);

  const outerContainerRef = useRef<HTMLDivElement | null>(null);
  const innerContainerRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const disabledKeys = useMemo(
    () => new Set([...(props.disabledKeys ?? []), ...subtotalKeys]),
    [props.disabledKeys, subtotalKeys],
  );
  const state = useTableState({
    ...(props as Parameters<typeof useTableState>[0]),
    disabledKeys,
    selectionMode,
    selectionBehavior: "toggle",
    showSelectionCheckboxes: selectionMode !== "none",
  });
  const { gridProps } = useTable(
    {
      ...props,
      // disabledKeys only prevents selection. Keep subtotals keyboard-readable
      // while preventing their synthetic keys from reaching action callbacks.
      onRowAction:
        subtotalKeys.size > 0 && props.onRowAction
          ? (key) => {
              if (!subtotalKeys.has(key)) {
                props.onRowAction?.(key);
              }
            }
          : props.onRowAction,
      onCellAction:
        subtotalKeys.size > 0 && props.onCellAction
          ? (key) => {
              const parentKey = state.collection.getItem(key)?.parentKey;
              if (parentKey == null || !subtotalKeys.has(parentKey)) {
                props.onCellAction?.(key);
              }
            }
          : props.onCellAction,
    },
    state,
    tableRef,
  );

  const { expandedRow, expandedRowStyle } = useExpandedRow({
    containerRef: innerContainerRef,
    state,
  });
  const [
    renderInterceptors,
    {
      isTopEdgeUnderScroll,
      isBottomEdgeUnderScroll,
      isLeftEdgeUnderScroll,
      isRightEdgeUnderScroll,
    },
  ] = useEdgeInterceptors(outerContainerRef);
  const { footerStyle } = useFooterWidth({
    containerRef: outerContainerRef,
    isEnabled: hasFooter,
  });

  const { collection } = state;
  const { columns } = collection;

  const hasSelection = columns.some((c) => c.props.isSelectionCell);
  const hasExpansion = columns.some((c) => c.key === EXPAND_COLUMN_KEY);
  const hasRowActions = columns.some((c) => c.key === ACTIONS_COLUMN_KEY);
  const hasOnRowAction = !!props.onRowAction;

  const dataGridClassName = classNames(
    styles.DataGrid,
    styles[variationName("size", size)],
    hasFooter && styles.hasFooter,
  );

  const tableClassName = classNames(
    styles.table,
    headerVariant && styles[variationName("header", headerVariant)],
    hasSelection && styles.hasSelection,
    hasExpansion && styles.hasExpansion,
    hasRowActions && styles.hasRowActions,
    isTopEdgeUnderScroll && styles.topEdgeUnderScroll,
    isLeftEdgeUnderScroll && styles.leftEdgeUnderScroll,
    isRightEdgeUnderScroll && styles.rightEdgeUnderScroll,
  );

  const style = {
    ...getComponentToken(
      "data-grid",
      "max-rows",
      typeof maxRows === "number" ? String(maxRows) : undefined,
    ),
    maxHeight: maxHeight ?? (maxRows === "all" ? "none" : undefined),
    ...expandedRowStyle,
    ...footerStyle,
  } as CSSProperties;

  const context = useMemo(() => {
    return {
      headerVariant,
      columnOptions,
      hasSelection,
      hasExpansion,
      hasRowActions,
      hasOnRowAction,
      isTopEdgeUnderScroll,
      isBottomEdgeUnderScroll,
      isLeftEdgeUnderScroll,
      isRightEdgeUnderScroll,
    };
  }, [
    headerVariant,
    columnOptions,
    hasSelection,
    hasExpansion,
    hasRowActions,
    hasOnRowAction,
    isTopEdgeUnderScroll,
    isBottomEdgeUnderScroll,
    isLeftEdgeUnderScroll,
    isRightEdgeUnderScroll,
  ]);

  return (
    <DataGridTableContext.Provider value={context}>
      <div ref={outerContainerRef} className={dataGridClassName} style={style}>
        <div ref={innerContainerRef} className={styles.innerContainer}>
          <table {...gridProps} ref={tableRef} className={tableClassName}>
            <RowGroup as="thead">
              {collection.headerRows.map((headerRow) => (
                <HeaderRow key={headerRow.key} item={headerRow} state={state}>
                  {[...headerRow.childNodes].map((column) => (
                    <ColumnHeader
                      key={column.key}
                      column={column}
                      state={state}
                    />
                  ))}
                </HeaderRow>
              ))}
            </RowGroup>
            <RowGroup as="tbody">
              {collection.size === 0 || isLoading ? (
                <StaticRow>
                  <StaticCell colSpan={collection.columnCount}>
                    {isLoading ? (
                      <Spinner isIndeterminate size="sm">
                        Loading..
                      </Spinner>
                    ) : (
                      renderEmptyState()
                    )}
                  </StaticCell>
                </StaticRow>
              ) : (
                [...collection.body.childNodes].map((row) => (
                  <Row
                    key={row.key}
                    item={row}
                    isSubtotal={subtotalKeys.has(row.key)}
                    state={state}
                    isExpanded={
                      expandedRow ? expandedRow.key === row.key : false
                    }
                  >
                    {[...row.childNodes].map((cell) => (
                      <Cell key={cell.key} cell={cell} state={state} />
                    ))}
                  </Row>
                ))
              )}
            </RowGroup>
          </table>
          {expandedRow && (
            <ExpandedRowContent>
              {renderExpandedRow(expandedRow.key)}
            </ExpandedRowContent>
          )}
          {renderInterceptors()}
          {renderFooter && <FooterShell>{renderFooter()}</FooterShell>}
        </div>
      </div>
    </DataGridTableContext.Provider>
  );
}
