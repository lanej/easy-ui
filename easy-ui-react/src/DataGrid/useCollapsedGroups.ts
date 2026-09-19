import { Key } from "@react-types/shared";
import { useCallback, useMemo, useState } from "react";
import { Column, DataGridGrouping, Row } from "./types";
import { GroupedRow } from "./useGroupedRows";

export function useCollapsedGroups<C extends Column, R extends Row>(
  items: GroupedRow<R>[],
  grouping?: DataGridGrouping<C, R>,
) {
  const [uncontrolledKeys, setUncontrolledKeys] = useState(
    () => new Set(grouping?.defaultCollapsedKeys),
  );
  const controlledKeys = grouping?.collapsedKeys;
  const collapsedKeys = useMemo(
    () =>
      controlledKeys === undefined ? uncontrolledKeys : new Set(controlledKeys),
    [controlledKeys, uncontrolledKeys],
  );
  const toggleGroup = useCallback(
    (key: Key) => {
      const nextKeys = new Set(collapsedKeys);
      if (nextKeys.has(key)) nextKeys.delete(key);
      else nextKeys.add(key);
      if (controlledKeys === undefined) setUncontrolledKeys(nextKeys);
      grouping?.onCollapsedChange?.(nextKeys);
    },
    [collapsedKeys, controlledKeys, grouping],
  );

  const isCollapsible = Boolean(grouping?.isCollapsible);
  return useMemo(() => {
    const collapsedRowKeys = new Map<Key, Key>();
    const allItems = items.map((item) => {
      if (item.type === "data") return item;
      const isCollapsed = isCollapsible && collapsedKeys.has(item.group.key);
      if (isCollapsed) {
        for (const row of item.group.rows)
          collapsedRowKeys.set(row.key, item.key);
      }
      // New subtotal items invalidate React Stately's rendered-cell cache when
      // the disclosure state changes, without recomputing aggregate values.
      return { ...item, isCollapsed };
    });
    return { allItems, collapsedRowKeys, toggleGroup };
  }, [items, isCollapsible, collapsedKeys, toggleGroup]);
}
