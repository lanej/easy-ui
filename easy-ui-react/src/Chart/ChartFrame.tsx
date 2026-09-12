import React, { ReactNode } from "react";
import { Card } from "../Card";
import { Text } from "../Text";
import type { ChartDataTable } from "./types";
import styles from "./Chart.module.scss";

export type ChartFrameProps = {
  title: string;
  /** Visible description, including units, coverage, and the main finding. */
  description: string;
  /** Exact data equivalent for keyboard and assistive-technology access. */
  dataTable: ChartDataTable;
  /** Reserved plot height in CSS pixels. Width follows the containing layout. */
  height?: number;
  status?: "ready" | "loading" | "empty" | "error";
  /** Coverage or stale/partial-data explanation supplied by the application. */
  notice?: string;
  actions?: ReactNode;
  /** Equivalent keyboard-accessible drill-down using stable table row IDs. */
  onRowSelect?: (id: string) => void;
  onRetry?: () => void;
  loadingLabel?: string;
  emptyLabel?: string;
  errorLabel?: string;
  retryLabel?: string;
  dataTableLabel?: string;
  missingValueLabel?: string;
  selectRowLabel?: string;
  children: ReactNode;
};

/** Shared presentation for analytical renderers; no runtime chart dependency. */
export function ChartFrame({
  title,
  description,
  dataTable,
  height = 320,
  status = dataTable.rows.length ? "ready" : "empty",
  notice,
  actions,
  onRowSelect,
  onRetry,
  loadingLabel = "Loading chart…",
  emptyLabel = "No data for this selection",
  errorLabel = "Unable to display this chart",
  retryLabel = "Retry",
  dataTableLabel = "View data table",
  missingValueLabel = "Unavailable",
  selectRowLabel = "Select row",
  children,
}: ChartFrameProps) {
  const plotHeight = Math.max(160, height);
  return (
    <Card
      as="section"
      background="primary"
      aria-label={title}
      aria-busy={status === "loading"}
      padding="3"
    >
      <div className={styles.root}>
        <div className={styles.header}>
          <Text as="h2" variant="heading5">
            {title}
          </Text>
          {actions}
        </div>
        <div className={styles.description}>
          <Text color="neutral.600" variant="caption">
            {description}
          </Text>
        </div>
        {status === "ready" ? (
          children
        ) : (
          <div
            className={styles.status}
            style={{ minHeight: plotHeight }}
            role={status === "error" ? "alert" : "status"}
          >
            {status === "loading"
              ? loadingLabel
              : status === "empty"
                ? emptyLabel
                : errorLabel}
            {status === "error" && onRetry && (
              <button
                type="button"
                className={styles.control}
                onClick={onRetry}
              >
                {retryLabel}
              </button>
            )}
          </div>
        )}
        {notice && (
          <Text variant="caption" color="neutral.700">
            {notice}
          </Text>
        )}
        {status === "ready" && (
          <details>
            <summary className={styles.summary}>{dataTableLabel}</summary>
            <div
              className={styles.tableScroll}
              tabIndex={0}
              role="region"
              aria-label={`${title} — ${dataTableLabel}`}
            >
              <table className={styles.table}>
                <caption>{title}</caption>
                <thead>
                  <tr>
                    {dataTable.columns.map((label, index) => (
                      <th key={index} scope="col">
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
                        <td key={index}>
                          {value === null ? missingValueLabel : value}
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
          </details>
        )}
      </div>
    </Card>
  );
}
