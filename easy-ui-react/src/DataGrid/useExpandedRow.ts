import { useResizeObserver } from "@react-aria/utils";
import {
  CSSProperties,
  MutableRefObject,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { TableState } from "react-stately";
import { getComponentToken } from "../utilities/css";
import { EXPAND_COLUMN_KEY } from "./constants";

type ExpandedRowRect = DOMRect & { bodyHeight: number };

/**
 * Retrieves the expanded row from Aria's table state and computes the position
 * and height of the expanded row box to manage its positioning in the grid.
 */
export function useExpandedRow({
  containerRef,
  state,
  isEnabled,
}: {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  state: TableState<unknown>;
  isEnabled: boolean;
}) {
  const [expandedRowRect, setExpandedRowRect] =
    useState<ExpandedRowRect | null>(null);

  // Loading replaces the data rows without changing their expansion state.
  const expandedRow = isEnabled
    ? [...state.collection.body.childNodes].find((r) => {
        return r.value
          ? r.value[EXPAND_COLUMN_KEY as keyof typeof r.value] === true
          : false;
      })
    : undefined;

  useLayoutEffect(() => {
    setExpandedRowRect(
      containerRef.current && expandedRow
        ? getExpandedRowContentRect(containerRef.current)
        : null,
    );
  }, [containerRef, expandedRow]);

  useResizeObserver({
    ref: containerRef,
    onResize() {
      const rect =
        containerRef.current && expandedRow
          ? getExpandedRowContentRect(containerRef.current)
          : null;
      if (
        rect?.height !== expandedRowRect?.height ||
        rect?.y !== expandedRowRect?.y ||
        rect?.bodyHeight !== expandedRowRect?.bodyHeight
      ) {
        setExpandedRowRect(rect);
      }
    },
  });

  const expandedRowStyle = useMemo(() => {
    return {
      ...(expandedRowRect?.bodyHeight
        ? getComponentToken(
            "data-grid",
            "expanded-row-body-height",
            `${expandedRowRect.bodyHeight}px`,
          )
        : {}),
      ...getComponentToken(
        "data-grid",
        "expanded-row-height",
        expandedRowRect?.height ? `${expandedRowRect.height}px` : "auto",
      ),
      ...getComponentToken(
        "data-grid",
        "expanded-row-position",
        expandedRowRect?.y ? `${expandedRowRect.y}px` : "0",
      ),
      ...getComponentToken(
        "data-grid",
        "expanded-row-opacity",
        expandedRowRect?.y ? "1.0" : "0.0",
      ),
    } as CSSProperties;
  }, [expandedRowRect]);

  return {
    expandedRow,
    expandedRowStyle,
  };
}

/**
 * Calculates a DOMRect (bounding client rectangle) for the expanded row
 * content box. This is used to position the expanded row content absolutely
 * within the container.
 *
 * @param $container Container element
 * @returns a DOMRect, or null when the elements to measure are absent
 */
function getExpandedRowContentRect(
  $container: HTMLElement,
): ExpandedRowRect | null {
  const $rows = getDataGridRowEls($container);
  const $firstColumnHeader = getFirstColumnHeaderEl($container);
  const $expandedRowContent = getExpandedRowContentEl($container);
  const $expandedRow = getExpandedRowEl($container);
  if (!$firstColumnHeader || !$expandedRowContent || !$expandedRow) {
    return null;
  }
  const expandedIndex = $rows.findIndex((r) => r === $expandedRow);
  const $expandedRowCells = [...$expandedRow.children] as HTMLElement[];
  if ($expandedRowCells.length === 0) return null;
  const heightOfPreviousRows = $rows
    .slice(0, expandedIndex)
    .reduce(
      (acc, row) =>
        acc +
        ((row.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0),
      0,
    );
  const y = heightOfPreviousRows + $firstColumnHeader.offsetHeight;
  const width =
    $expandedRowCells.reduce((acc, c) => acc + c.offsetWidth, 0) - 1;
  const height = $expandedRowContent.offsetHeight;
  // An expanded <tr> includes its detail area, so measure the actual cell
  // contents to keep details below wrapped/rich values and enlarged text.
  const bodyHeight = Math.max(
    ...$expandedRowCells.map(
      (cell) =>
        ((cell.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0) +
        (parseFloat(getComputedStyle(cell).borderBottomWidth) || 0),
    ),
  );
  return Object.assign(new DOMRect(0, y, width, height), { bodyHeight });
}

function getFirstColumnHeaderEl($container: HTMLElement) {
  return $container.querySelector<HTMLElement>(
    `[data-ezui-data-grid-column-header="true"]`,
  );
}

function getDataGridRowEls($container: HTMLElement) {
  return [
    ...$container.querySelectorAll<HTMLElement>(
      `[data-ezui-data-grid-row="true"]`,
    ),
  ];
}

function getExpandedRowContentEl($container: HTMLElement) {
  return $container.querySelector<HTMLElement>(
    `[data-ezui-data-grid-expanded-row-content="active"]`,
  );
}

function getExpandedRowEl($container: HTMLElement) {
  return $container.querySelector<HTMLElement>(
    `[data-ezui-data-grid-expanded-row='true']`,
  );
}
