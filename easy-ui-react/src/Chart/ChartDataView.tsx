import React, { AriaAttributes, CSSProperties, useState } from "react";
import {
  VisualizationTypography,
  visualizationTypographyStyle,
} from "../visualization/typography";
import type { ChartDataTable } from "./types";
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
    };
  };
  const content = (
    <div
      id={id}
      className={styles.tableScroll}
      style={{
        ...visualizationTypographyStyle(typography),
        maxHeight: dataTable.maxHeight,
      }}
      tabIndex={0}
      role="region"
      {...aria}
      aria-label={
        aria["aria-labelledby"]
          ? undefined
          : (aria["aria-label"] ??
            `${title}${disclosureLabel ? ` — ${disclosureLabel}` : ""}`)
      }
    >
      <table className={styles.table}>
        <caption>{title}</caption>
        <thead>
          <tr>
            {dataTable.columns.map((label, index) => (
              <th key={index} scope="col" style={columnStyle(index)}>
                {label}
              </th>
            ))}
            {onRowSelect && <th scope="col">{selectRowLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {dataTable.rows.map((row) => (
            <tr key={row.id}>
              {row.values.map((value, index) => (
                <td key={index} style={columnStyle(index, true)}>
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
