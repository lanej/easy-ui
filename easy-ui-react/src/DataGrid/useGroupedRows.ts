import { Key } from "@react-types/shared";
import { useMemo } from "react";
import { Column, DataGridGroup, DataGridProps, Row } from "./types";

type DataRow<R extends Row> = {
  key: Key;
  renderKey: string;
  type: "data";
  row: R;
};
type SubtotalRow<R extends Row> = {
  key: Key;
  renderKey: string;
  type: "subtotal";
  group: DataGridGroup<R>;
  label: string;
  values: Map<Key, unknown>;
  isCollapsed?: boolean;
};
export type GroupedRow<R extends Row> = DataRow<R> | SubtotalRow<R>;

// React identity is independent of collision-safe collection keys. Consumers
// may add a data row whose key is currently allocated to a subtotal.
function renderKey(kind: "data" | "subtotal", key: Key) {
  return JSON.stringify([kind, typeof key, String(key)]);
}

/** Build collection items without exposing synthetic rows to consumer callbacks. */
export function useGroupedRows<C extends Column, R extends Row>({
  rows,
  columns,
  grouping,
}: Pick<DataGridProps<C, R>, "rows" | "columns" | "grouping">) {
  return useMemo(() => {
    const items: GroupedRow<R>[] = [];
    const subtotalKeys = new Set<Key>();
    if (!grouping) {
      return {
        items: rows.map((row): DataRow<R> => ({
          key: row.key,
          renderKey: renderKey("data", row.key),
          type: "data",
          row,
        })),
        subtotalKeys,
      };
    }

    const groups = new Map<Key, R[]>();
    for (const row of rows) {
      const key = grouping.getGroupKey(row);
      const groupRows = groups.get(key);
      if (groupRows) {
        groupRows.push(row);
      } else {
        groups.set(key, [row]);
      }
    }

    // Preserve consumer keys, including strings resembling our internal keys.
    // Type-prefix group keys so numeric 1 and string "1" remain distinct.
    const usedKeys = new Set(rows.map((row) => String(row.key)));
    for (const [groupKey, groupRows] of groups) {
      for (const row of groupRows) {
        items.push({
          key: row.key,
          renderKey: renderKey("data", row.key),
          type: "data",
          row,
        });
      }
      // Delimit string keys so collision suffixes cannot match another
      // group key. Encoding also preserves distinct accessible labels when
      // React Aria removes whitespace from the keys used in cell IDs.
      const encodedGroupKey =
        typeof groupKey === "string"
          ? encodeURIComponent(JSON.stringify(groupKey))
          : groupKey;
      let key = `__ezui_subtotal_${typeof groupKey}:${encodedGroupKey}`;
      while (usedKeys.has(key)) {
        key += "_";
      }
      usedKeys.add(key);
      subtotalKeys.add(key);

      const group = { key: groupKey, rows: groupRows };
      const label = grouping.getGroupLabel?.(group) ?? String(groupKey);
      const values = new Map<Key, unknown>();
      for (const column of columns) {
        const aggregate = Object.prototype.hasOwnProperty.call(
          grouping.aggregators,
          column.key,
        )
          ? grouping.aggregators[column.key as C["key"]]
          : undefined;
        values.set(
          column.key,
          aggregate
            ? aggregate(groupRows)
            : column === columns[0]
              ? `${label} subtotal`
              : undefined,
        );
      }
      items.push({
        key,
        renderKey: renderKey("subtotal", groupKey),
        type: "subtotal",
        group,
        label,
        values,
      });
    }
    return { items, subtotalKeys };
  }, [rows, columns, grouping]);
}
