import { useMemo, useState } from "react";
import { useCollator } from "react-aria";
import type { ChartDataSortDescriptor, ChartDataTable } from "./types";

/** Sort only the supplied table records; preserve original rows and plot order. */
export function useChartDataSort(dataTable: ChartDataTable) {
  const [localSort, setLocalSort] = useState<ChartDataSortDescriptor | null>(
    dataTable.defaultSortDescriptor ?? null,
  );
  const requested =
    dataTable.sortDescriptor === undefined
      ? localSort
      : dataTable.sortDescriptor;
  const descriptor =
    requested &&
    dataTable.columns[requested.column] !== undefined &&
    dataTable.columnOptions?.[requested.column]?.allowsSorting
      ? requested
      : null;
  const collator = useCollator({ numeric: true, sensitivity: "base" });
  const options = descriptor
    ? dataTable.columnOptions?.[descriptor.column]
    : undefined;
  const rows = useMemo(() => {
    if (!descriptor) return dataTable.rows;
    const { column, direction } = descriptor;
    const sign = direction === "ascending" ? 1 : -1;
    return dataTable.rows
      .map((row) => {
        const value = options?.getSortValue
          ? options.getSortValue(row.values[column], row)
          : row.values[column];
        return {
          row,
          value:
            value == null ||
            (typeof value === "number" && !Number.isFinite(value))
              ? null
              : value,
        };
      })
      .sort((a, b) => {
        if (a.value === null) return b.value === null ? 0 : 1;
        if (b.value === null) return -1;
        return (
          sign *
          (typeof a.value === "number" && typeof b.value === "number"
            ? a.value - b.value
            : collator.compare(String(a.value), String(b.value)))
        );
      })
      .map(({ row }) => row);
  }, [dataTable.rows, descriptor, options, collator]);

  function toggleSort(column: number) {
    const next: ChartDataSortDescriptor | null =
      descriptor?.column !== column
        ? { column, direction: "ascending" }
        : descriptor.direction === "ascending"
          ? { column, direction: "descending" }
          : null;
    if (dataTable.sortDescriptor === undefined) setLocalSort(next);
    dataTable.onSortChange?.(next);
  }

  return { rows, descriptor, toggleSort };
}
