import { Key } from "@react-types/shared";
import React, {
  CSSProperties,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
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
import { GroupedRow } from "./useGroupedRows";
import { Spinner } from "../Spinner";

import styles from "./DataGrid.module.scss";

type TableChildren = NonNullable<
  Parameters<typeof useTableState>[0]["children"]
>;

type TableProps<C extends Column, R extends RowType> = Omit<
  DataGridProps<C, R>,
  "children"
> & {
  children?: TableChildren;
  subtotalKeys: ReadonlySet<Key>;
  collapsedRowKeys: ReadonlyMap<Key, Key>;
  allRowsBody?: TableChildren[1];
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
    collapsedRowKeys,
    allRowsBody,
  } = props;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const innerContainerRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const disabledKeys = useMemo(
    () => new Set([...(props.disabledKeys ?? []), ...subtotalKeys]),
    [props.disabledKeys, subtotalKeys],
  );
  const fullChildren = useMemo<TableChildren | undefined>(
    () =>
      allRowsBody && props.children
        ? [props.children[0], allRowsBody]
        : props.children,
    [allRowsBody, props.children],
  );
  const stateProps = {
    ...(props as Parameters<typeof useTableState>[0]),
    disabledKeys,
    selectionMode,
    selectionBehavior: "toggle" as const,
    showSelectionCheckboxes: selectionMode !== "none",
  };
  const fullState = useTableState({ ...stateProps, children: fullChildren });
  const visibleState = useTableState({
    ...stateProps,
    // Reuse the collection when nothing is collapsed, avoiding duplicate work.
    collection: allRowsBody ? undefined : fullState.collection,
  });
  const state = {
    ...fullState,
    collection: visibleState.collection,
    // Stately keeps selection against the complete collection, while navigation
    // and rendering use only visible rows. Select-all therefore includes hidden
    // details, and collapsing does not silently discard a selection.
    selectionManager: fullState.selectionManager.withCollection(
      visibleState.collection,
    ),
  };
  const previousCollection = useRef(state.collection);
  const removedExpandedFocus = useRef<Key | null>(null);
  const onExpandedFocusedUnmount = useCallback((rowKey: Key) => {
    removedExpandedFocus.current = rowKey;
  }, []);
  useLayoutEffect(() => {
    const previous = previousCollection.current;
    previousCollection.current = state.collection;
    const removedRowKey = removedExpandedFocus.current;
    removedExpandedFocus.current = null;
    if (removedRowKey !== null && !isLoading) {
      const subtotalKey = collapsedRowKeys.get(removedRowKey);
      const document = tableRef.current?.ownerDocument;
      const activeElement = document?.activeElement;
      if (
        subtotalKey !== undefined &&
        document &&
        (!activeElement || activeElement === document.body)
      ) {
        const row = Array.from(tableRef.current?.rows ?? []).find(
          (element) => element.getAttribute("data-key") === String(subtotalKey),
        );
        row
          ?.querySelector<HTMLElement>("[data-ezui-data-grid-group-toggle]")
          ?.focus();
      }
    }
    const focusedKey = state.selectionManager.focusedKey;
    // A subtotal's collection key may change to avoid a new consumer row key.
    // Preserve keyboard position by group and column identity, even when the
    // old collection key now belongs to the newly inserted data row.
    const previousNode =
      focusedKey == null ? undefined : previous.getItem(focusedKey);
    const previousRow =
      previousNode?.parentKey == null
        ? previousNode
        : previous.getItem(previousNode.parentKey);
    const previousItem = previousRow?.value as GroupedRow<R> | undefined;
    if (previousItem?.type === "subtotal" && previous !== state.collection) {
      const nextRow = [...state.collection.body.childNodes].find(
        (node) =>
          (node.value as GroupedRow<R>).renderKey === previousItem.renderKey,
      );
      if (nextRow && nextRow.key !== previousRow?.key) {
        const nextCell =
          previousNode?.type === "cell"
            ? [...nextRow.childNodes].find(
                (node) =>
                  state.collection.columns[node.index]?.key ===
                  previous.columns[previousNode.index]?.key,
              )
            : undefined;
        state.selectionManager.setFocusedKey(nextCell?.key ?? nextRow.key);
        return;
      }
    }
    if (focusedKey == null || state.collection.getItem(focusedKey)) return;
    const focusedNode = fullState.collection.getItem(focusedKey);
    const rowKey = focusedNode?.parentKey ?? focusedKey;
    const subtotalKey = collapsedRowKeys.get(rowKey);
    if (subtotalKey === undefined) return;
    const subtotal = state.collection.getItem(subtotalKey);
    const cell =
      subtotal &&
      [...subtotal.childNodes].find(
        (node) => node.index === focusedNode?.index,
      );
    state.selectionManager.setFocusedKey(cell?.key ?? subtotalKey);
  }, [
    state.collection,
    state.selectionManager,
    fullState.collection,
    collapsedRowKeys,
    isLoading,
  ]);
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
    isEnabled: !isLoading,
  });
  const [
    renderInterceptors,
    {
      isTopEdgeUnderScroll,
      isBottomEdgeUnderScroll,
      isLeftEdgeUnderScroll,
      isRightEdgeUnderScroll,
    },
  ] = useEdgeInterceptors(scrollContainerRef);

  const { collection } = state;
  const { columns } = collection;

  const isAutoHeight = maxRows === "auto";

  const hasSelection = columns.some((c) => c.props.isSelectionCell);
  const hasExpansion = columns.some((c) => c.key === EXPAND_COLUMN_KEY);
  const hasRowActions = columns.some((c) => c.key === ACTIONS_COLUMN_KEY);
  const hasOnRowAction = !!props.onRowAction;

  const dataGridClassName = classNames(
    styles.DataGrid,
    styles[variationName("size", size)],
    isAutoHeight && styles.maxRowsAuto,
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
    // Auto and unlimited layouts do not set a row-count bound.
    ...getComponentToken(
      "data-grid",
      "max-rows",
      typeof maxRows === "number" ? String(maxRows) : undefined,
    ),
    maxHeight: maxHeight ?? (maxRows === "all" ? "none" : undefined),
    ...expandedRowStyle,
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
      <div className={dataGridClassName} style={style}>
        <div ref={scrollContainerRef} className={styles.scrollContainer}>
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
                      key={(row.value as GroupedRow<R>).renderKey}
                      item={row}
                      isSubtotal={subtotalKeys.has(row.key)}
                      state={state}
                      isExpanded={
                        expandedRow ? expandedRow.key === row.key : false
                      }
                    >
                      {[...row.childNodes].map((cell) => (
                        <Cell
                          key={JSON.stringify([
                            typeof columns[cell.index]?.key,
                            String(columns[cell.index]?.key),
                          ])}
                          cell={cell}
                          state={state}
                        />
                      ))}
                    </Row>
                  ))
                )}
              </RowGroup>
            </table>
            {expandedRow && (
              <ExpandedRowContent
                rowKey={expandedRow.key}
                onFocusedUnmount={onExpandedFocusedUnmount}
              >
                {renderExpandedRow(expandedRow.key)}
              </ExpandedRowContent>
            )}
            {renderInterceptors()}
          </div>
        </div>
        {renderFooter && <FooterShell>{renderFooter()}</FooterShell>}
      </div>
    </DataGridTableContext.Provider>
  );
}
