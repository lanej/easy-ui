import React, { AriaAttributes, CSSProperties, useState } from "react";
import {
  VisualizationTypography,
  visualizationTypographyStyle,
} from "../visualization/typography";
import type { ChartDataTable } from "./types";
import { classNames } from "../utilities/css";
import { useChartDataLayout } from "./useChartDataLayout";
import { useChartDataSort } from "./useChartDataSort";
import styles from "./Chart.module.scss";

export type ChartDataViewProps = Pick<
  AriaAttributes,
  "aria-label" | "aria-labelledby" | "aria-describedby"
> & {
  id?: string;
  dataTable: ChartDataTable;
  title?: string;
  /** Omit to render the table directly; supply a label for a native disclosure. */
  disclosureLabel?: string;
  missingValueLabel?: string;
  selectRowLabel?: string;
  onRowSelect?: (id: string) => void;
  typography?: VisualizationTypography;
};

/** An exact, keyboard-accessible data companion with optional row drill-down. */
export function ChartDataView({
  id,
  dataTable,
  title = "Chart data",
  disclosureLabel,
  missingValueLabel = "Unavailable",
  selectRowLabel = "Select row",
  onRowSelect,
  typography,
  ...aria
}: ChartDataViewProps) {
  const [hasOpened, setHasOpened] = useState(false);
  const { rows, descriptor, toggleSort } = useChartDataSort(dataTable);
  const { scrollRef, headerRef, offsets, pinnedWidth, headerHeight } =
    useChartDataLayout(
      dataTable.columns.length,
      dataTable.pinnedColumnCount,
      dataTable.stickyHeader,
      Boolean(disclosureLabel),
    );
  const renderCell =
    !disclosureLabel || hasOpened ? dataTable.renderCell : undefined;
  const columnStyle = (index: number, isBodyCell = false): CSSProperties => {
    const options = dataTable.columnOptions?.[index];
    return {
      width: options?.width,
      minWidth: options?.minWidth,
      textAlign: options?.alignment ?? (options?.isNumeric ? "end" : undefined),
      whiteSpace:
        options?.whiteSpace ??
        (isBodyCell && dataTable.renderCell ? "normal" : undefined),
      insetInlineStart: offsets[index],
    };
  };
  const columnClass = (index: number) =>
    classNames(
      index < offsets.length && styles.pinnedColumn,
      index === offsets.length - 1 && styles.pinnedEdge,
    ) || undefined;
  const content = (
    <div
      id={id}
      ref={scrollRef}
      className={styles.tableScroll}
      style={{
        ...visualizationTypographyStyle(typography),
        maxHeight: dataTable.maxHeight,
        scrollPaddingBlockStart: headerHeight,
        scrollPaddingInlineStart: pinnedWidth,
      }}
      tabIndex={0}
      role="region"
      onFocusCapture={(event) => {
        const target = event.target;
        const scroll = event.currentTarget;
        if (
          target === scroll ||
          target.closest(`.${styles.tableScroll}`) !== scroll
        )
          return;
        // Native focus scrolling does not account for overlaid sticky cells.
        // Apply measured scroll padding after the browser's own focus movement.
        requestAnimationFrame(() => {
          if (!scroll.contains(target) || target !== document.activeElement)
            return;
          const { scrollLeft, scrollTop } = scroll;
          target.scrollIntoView?.({
            block: "nearest",
            inline: "nearest",
            behavior: "instant",
          });
          if (target.closest(`.${styles.pinnedColumn}`))
            scroll.scrollLeft = scrollLeft;
          if (
            dataTable.stickyHeader !== false &&
            headerRef.current?.contains(target)
          )
            scroll.scrollTop = scrollTop;
        });
      }}
      {...aria}
      aria-label={
        aria["aria-labelledby"]
          ? undefined
          : (aria["aria-label"] ??
            `${title}${disclosureLabel ? ` — ${disclosureLabel}` : ""}`)
      }
    >
      <table
        className={classNames(
          styles.table,
          dataTable.stickyHeader !== false && styles.stickyHeader,
        )}
      >
        <caption>{title}</caption>
        <thead>
          <tr ref={headerRef}>
            {dataTable.columns.map((label, index) => (
              <th
                key={index}
                scope="col"
                className={columnClass(index)}
                style={columnStyle(index)}
                aria-sort={
                  descriptor?.column === index
                    ? descriptor.direction
                    : undefined
                }
              >
                {dataTable.columnOptions?.[index]?.allowsSorting ? (
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => toggleSort(index)}
                  >
                    <span>{label}</span>
                    <span aria-hidden="true" className={styles.sortIndicator}>
                      {descriptor?.column === index
                        ? descriptor.direction === "ascending"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </button>
                ) : (
                  label
                )}
              </th>
            ))}
            {onRowSelect && <th scope="col">{selectRowLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.values.map((value, index) => (
                <td
                  key={index}
                  className={columnClass(index)}
                  style={columnStyle(index, true)}
                >
                  {renderCell?.(value, index, row) ??
                    (value === null ? missingValueLabel : value)}
                </td>
              ))}
              {onRowSelect && (
                <td>
                  <button
                    type="button"
                    className={styles.control}
                    onClick={() => onRowSelect(row.id)}
                    aria-label={`${selectRowLabel}: ${row.values[0] ?? row.id}`}
                  >
                    {selectRowLabel}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return disclosureLabel ? (
    <details
      style={visualizationTypographyStyle(typography)}
      onToggle={(event) => {
        if (event.currentTarget.open) setHasOpened(true);
      }}
    >
      <summary className={styles.summary}>{disclosureLabel}</summary>
      {content}
    </details>
  ) : (
    content
  );
}
