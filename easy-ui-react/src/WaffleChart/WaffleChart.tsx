import React, { useEffect, useMemo, useRef, useState } from "react";
import { useId } from "react-aria";
import { getComponentThemeToken } from "../utilities/css";
import { useGroupAnchors } from "./useGroupAnchors";
import type {
  WaffleChartCategory,
  WaffleChartGroup,
  WaffleChartInspection,
  WaffleChartItem,
  WaffleChartProps,
  WaffleChartSelection,
} from "./types";
import styles from "./WaffleChart.module.scss";

const EMPTY_GROUPS: readonly WaffleChartGroup[] = [];
const countItems = (count: number) =>
  `${count} ${count === 1 ? "item" : "items"}`;
const sameTarget = (a: WaffleChartSelection, b: WaffleChartSelection) =>
  !!a && !!b && a.type === b.type && a.id === b.id;
const safeNumber = (
  value: number,
  fallback: number,
  min: number,
  max: number,
) => (Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback);

/** Discrete supplied resources. Applications own grouping and relationship meaning. */
export function WaffleChart<Metadata = unknown>({
  accessibilityLabel,
  items,
  categories,
  groups = EMPTY_GROUPS,
  variant = "default",
  interaction = "inspect",
  maxColumns = 12,
  cellSize,
  gap,
  showCount = true,
  showLegend = true,
  ungroupedLabel = "Other items",
  emptyMessage = "No items supplied",
  countLabel = countItems,
  selection: controlledSelection,
  defaultSelection = null,
  onSelectionChange,
  highlight,
  selectedCategoryId = null,
  onCategorySelectionChange,
  onItemHoverChange,
  onItemFocusChange,
  onItemActivate,
  onGroupHoverChange,
  onGroupFocusChange,
  onGroupActivate,
  renderDetails,
  onGroupAnchorsChange,
  layoutRevision,
}: WaffleChartProps<Metadata>) {
  const compact = variant === "compact";
  const interactive = !compact && interaction === "inspect";
  const [localSelection, setLocalSelection] = useState(defaultSelection);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [focused, setFocused] = useState<WaffleChartSelection>(null);
  const [tabItemId, setTabItemId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const anchorElements = useRef(new Map<string, HTMLElement>());
  const cellElements = useRef(new Map<string, HTMLButtonElement>());
  const groupControls = useRef(new Map<string, HTMLButtonElement>());
  const hoveredItemElement = useRef<HTMLElement | null>(null);
  const hoveredGroupElement = useRef<HTMLElement | null>(null);
  const restoringDismissedFocus = useRef(false);
  const instructionsId = useId();
  const detailsId = useId();
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const groupMap = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  // React may remove/move a keyed cell between group parents without firing
  // blur/pointerleave. Clear transient targets when their real DOM owner changes.
  useEffect(() => {
    if (
      focused?.type === "item" &&
      (!interactive ||
        !itemMap.has(focused.id) ||
        cellElements.current.get(focused.id) !== document.activeElement)
    ) {
      setFocused(null);
      onItemFocusChange?.(null);
    }
    if (
      focused?.type === "group" &&
      (!interactive ||
        !groupMap.has(focused.id) ||
        groupControls.current.get(focused.id) !== document.activeElement)
    ) {
      setFocused(null);
      onGroupFocusChange?.(null);
    }
    if (
      hoveredItem &&
      (!interactive ||
        !itemMap.has(hoveredItem) ||
        cellElements.current.get(hoveredItem) !== hoveredItemElement.current)
    ) {
      setHoveredItem(null);
      hoveredItemElement.current = null;
      onItemHoverChange?.(null);
    }
    if (
      hoveredGroup &&
      (!interactive ||
        !groupMap.has(hoveredGroup) ||
        anchorElements.current.get(hoveredGroup) !==
          hoveredGroupElement.current)
    ) {
      setHoveredGroup(null);
      hoveredGroupElement.current = null;
      onGroupHoverChange?.(null);
    }
  }, [
    interactive,
    itemMap,
    groupMap,
    focused,
    hoveredItem,
    hoveredGroup,
    onItemFocusChange,
    onGroupFocusChange,
    onItemHoverChange,
    onGroupHoverChange,
  ]);
  const categoryLabel = (id: string) =>
    categoryMap.get(id)?.label ?? `Unknown category: ${id}`;
  const itemLabel = (item: WaffleChartItem<Metadata>) =>
    `${item.label}, ${categoryLabel(item.categoryId)}${item.draft ? ", Draft" : ""}${item.muted ? ", Muted" : ""}`;
  const validTarget = (target: WaffleChartSelection): WaffleChartSelection =>
    target && (target.type === "item" ? itemMap : groupMap).has(target.id)
      ? target
      : null;
  const selection = validTarget(
    controlledSelection === undefined ? localSelection : controlledSelection,
  );
  const transient =
    validTarget(focused) ??
    (hoveredItem && itemMap.has(hoveredItem)
      ? { type: "item" as const, id: hoveredItem }
      : hoveredGroup && groupMap.has(hoveredGroup)
        ? { type: "group" as const, id: hoveredGroup }
        : null);
  const target = interactive ? (selection ?? transient) : null;
  const inspection: WaffleChartInspection<Metadata> | null = target
    ? {
        target,
        item: target.type === "item" ? itemMap.get(target.id) : undefined,
        group:
          target.type === "group"
            ? groupMap.get(target.id)
            : groupMap.get(itemMap.get(target.id)?.groupId ?? ""),
        pinned: !!selection,
        totalCount: items.length,
      }
    : null;
  const changeSelection = (next: WaffleChartSelection) => {
    if (controlledSelection === undefined) setLocalSelection(next);
    onSelectionChange?.(next);
  };
  const activate = (next: Exclude<WaffleChartSelection, null>) => {
    changeSelection(sameTarget(selection, next) ? null : next);
    if (next.type === "item") onItemActivate?.(itemMap.get(next.id)!);
    else onGroupActivate?.(groupMap.get(next.id)!);
  };
  const clear = (restoreFocus = false) => {
    const returnTarget =
      selection?.type === "item"
        ? cellElements.current.get(selection.id)
        : selection?.type === "group"
          ? groupControls.current.get(selection.id)
          : undefined;
    changeSelection(null);
    setFocused(null);
    setHoveredItem(null);
    setHoveredGroup(null);
    hoveredItemElement.current = null;
    hoveredGroupElement.current = null;
    onItemFocusChange?.(null);
    onItemHoverChange?.(null);
    onGroupFocusChange?.(null);
    onGroupHoverChange?.(null);
    if (selectedCategoryId !== null) onCategorySelectionChange?.(null);
    if (restoreFocus && returnTarget) {
      restoringDismissedFocus.current = true;
      returnTarget.focus();
      restoringDismissedFocus.current = false;
    }
  };
  const columns = Math.floor(safeNumber(maxColumns, 12, 1, 1000));
  const size = safeNumber(
    cellSize ?? (compact ? 8 : 20),
    compact ? 8 : 20,
    4,
    128,
  );
  const track = interactive ? Math.max(24, size) : size;
  const spacing = safeNumber(gap ?? (compact ? 3 : 6), compact ? 3 : 6, 0, 64);
  const style = {
    "--waffle-cell-size": `${size}px`,
    "--waffle-track-size": `${track}px`,
    "--waffle-gap": `${spacing}px`,
  } as React.CSSProperties;
  const groupedItems = useMemo(() => {
    const buckets = groups.map((group) => ({
      group: group as WaffleChartGroup | undefined,
      items: [] as WaffleChartItem<Metadata>[],
    }));
    const byId = new Map(buckets.map((bucket) => [bucket.group!.id, bucket]));
    const remainder = {
      group: undefined,
      items: [] as WaffleChartItem<Metadata>[],
    };
    for (const item of items) {
      (item.groupId
        ? (byId.get(item.groupId) ?? remainder)
        : remainder
      ).items.push(item);
    }
    if (remainder.items.length || !groups.length) buckets.push(remainder);
    return buckets;
  }, [items, groups]);
  const legend = useMemo(() => {
    const entries = new Map(
      categories.map((category) => [category.id, { ...category, count: 0 }]),
    );
    for (const item of items) {
      if (!entries.has(item.categoryId))
        entries.set(item.categoryId, {
          id: item.categoryId,
          label: `Unknown category: ${item.categoryId}`,
          color: "neutral.500",
          count: 0,
        });
      entries.get(item.categoryId)!.count++;
    }
    return [...entries.values()];
  }, [items, categories]);
  // A single revision object avoids coupling consumers to markup or class names.
  const geometryRevision = useMemo(
    () => [items, groups, compact, columns, size, spacing, layoutRevision],
    [items, groups, compact, columns, size, spacing, layoutRevision],
  );
  useGroupAnchors(
    root,
    anchorElements,
    compact ? undefined : onGroupAnchorsChange,
    geometryRevision,
  );
  const hasHighlight = !!(
    highlight?.itemIds?.length ||
    highlight?.groupIds?.length ||
    highlight?.categoryIds?.length ||
    selectedCategoryId !== null
  );
  const isHighlighted = (item: WaffleChartItem<Metadata>) =>
    !!(
      highlight?.itemIds?.includes(item.id) ||
      (item.groupId && highlight?.groupIds?.includes(item.groupId)) ||
      highlight?.categoryIds?.includes(item.categoryId) ||
      selectedCategoryId === item.categoryId
    );
  const categoryStyle = (
    category: Pick<WaffleChartCategory, "color"> | undefined,
  ) => getComponentThemeToken("waffle", "color", "color", category?.color);
  const gridStyle = (count: number) =>
    ({
      "--waffle-grid-width": `${Math.min(columns, Math.max(1, count)) * (track + spacing) - spacing}px`,
    }) as React.CSSProperties;
  const visibleItems = groupedItems.flatMap((bucket) => bucket.items);
  const currentTabId =
    tabItemId && itemMap.has(tabItemId) ? tabItemId : visibleItems[0]?.id;
  const moveFocus = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    item: WaffleChartItem<Metadata>,
  ) => {
    const index = visibleItems.findIndex((entry) => entry.id === item.id);
    let next: WaffleChartItem<Metadata> | undefined;
    if (event.key === "Home") next = visibleItems[0];
    else if (event.key === "End") next = visibleItems[visibleItems.length - 1];
    else if (event.key === "ArrowRight") next = visibleItems[index + 1];
    else if (event.key === "ArrowLeft") next = visibleItems[index - 1];
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const origin = event.currentTarget.getBoundingClientRect();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      // Read live cell geometry so navigation follows responsive wrapping.
      next = visibleItems
        .map((entry) => ({
          entry,
          rect: cellElements.current.get(entry.id)?.getBoundingClientRect(),
        }))
        .filter(({ rect }) => rect && (rect.top - origin.top) * direction > 1)
        .sort((a, b) => {
          const distance = (rect: DOMRect) =>
            Math.abs(rect.top - origin.top) +
            Math.abs(rect.left - origin.left) * 2;
          return distance(a.rect!) - distance(b.rect!);
        })[0]?.entry;
    } else return;
    event.preventDefault();
    if (next) {
      setTabItemId(next.id);
      cellElements.current.get(next.id)?.focus();
    }
  };
  const cell = (item: WaffleChartItem<Metadata>, passive = false) => {
    const selected =
      selection?.type === "item"
        ? selection.id === item.id
        : selection?.type === "group" && selection.id === item.groupId;
    const emphasized = isHighlighted(item);
    const content = (
      <span className={styles.marker} aria-hidden="true">
        {item.draft && <span className={styles.draft}>/</span>}
        {selected && <span className={styles.selectedMark}>✓</span>}
      </span>
    );
    const props = {
      className: styles.cell,
      style: categoryStyle(categoryMap.get(item.categoryId)),
      "data-waffle-item": item.id,
      "data-selected": selected || undefined,
      "data-highlighted": emphasized || undefined,
      "data-muted": item.muted || (hasHighlight && !emphasized) || undefined,
      "data-draft": item.draft || undefined,
      "data-unknown": !categoryMap.has(item.categoryId) || undefined,
    };
    if (passive)
      return (
        <span
          {...props}
          key={item.id}
          aria-hidden={compact || undefined}
          role={compact ? undefined : "img"}
          aria-label={compact ? undefined : itemLabel(item)}
        >
          {content}
        </span>
      );
    return (
      <button
        {...props}
        key={item.id}
        ref={(element) => {
          if (element) cellElements.current.set(item.id, element);
          else cellElements.current.delete(item.id);
        }}
        type="button"
        aria-label={itemLabel(item)}
        aria-pressed={!!selected}
        aria-describedby={instructionsId}
        tabIndex={item.id === currentTabId ? 0 : -1}
        onPointerEnter={(event) => {
          hoveredItemElement.current = event.currentTarget;
          setHoveredItem(item.id);
          onItemHoverChange?.(item);
        }}
        onPointerLeave={() => {
          hoveredItemElement.current = null;
          setHoveredItem(null);
          onItemHoverChange?.(null);
        }}
        onFocus={() => {
          setTabItemId(item.id);
          if (restoringDismissedFocus.current) return;
          setFocused({ type: "item", id: item.id });
          onItemFocusChange?.(item);
        }}
        onBlur={() => {
          setFocused(null);
          onItemFocusChange?.(null);
        }}
        onClick={() => activate({ type: "item", id: item.id })}
        onKeyDown={(event) => moveFocus(event, item)}
      >
        {content}
      </button>
    );
  };
  if (compact) {
    const draftItems = items.filter((item) => item.draft);
    return (
      <span
        className={styles.root}
        data-variant="compact"
        style={style}
        role="img"
        aria-label={`${accessibilityLabel}: ${countLabel(items.length)}${items.length ? `. ${items.map(itemLabel).join("; ")}` : `. ${emptyMessage}`}`}
      >
        <span className={styles.grid} style={gridStyle(items.length)}>
          {items.map((item) => cell(item, true))}
        </span>
        {showCount && (
          <span className={styles.count} aria-hidden="true">
            {items.length}
          </span>
        )}
        {draftItems.length > 0 && (
          <span className={styles.draftLabel} aria-hidden="true">
            / Draft {draftItems.length}
          </span>
        )}
      </span>
    );
  }
  return (
    <div
      ref={root}
      className={styles.root}
      style={style}
      role="group"
      aria-label={accessibilityLabel}
      onKeyDown={(event) => {
        if (interactive && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          clear();
        }
      }}
    >
      {showCount && (
        <div className={styles.total}>{countLabel(items.length)}</div>
      )}
      {interactive && (
        <span id={instructionsId} className={styles.srOnly}>
          Arrow keys move between items. Enter or Space pins details. Escape
          clears selection and inspection.
        </span>
      )}
      {!items.length && <p className={styles.empty}>{emptyMessage}</p>}
      <div className={styles.groups}>
        {groupedItems.map(({ group, items: members }) => (
          <div
            key={group ? `group:${group.id}` : "ungrouped"}
            className={styles.group}
            ref={
              group
                ? (element) => {
                    if (element) anchorElements.current.set(group.id, element);
                    else anchorElements.current.delete(group.id);
                  }
                : undefined
            }
            role="group"
            aria-label={
              group?.label ?? (groups.length ? ungroupedLabel : undefined)
            }
            data-waffle-group={group?.id}
            data-highlighted={
              (!!group && highlight?.groupIds?.includes(group.id)) || undefined
            }
            data-selected={
              (selection?.type === "group" && selection.id === group?.id) ||
              undefined
            }
            onPointerEnter={
              interactive && group
                ? (event) => {
                    hoveredGroupElement.current = event.currentTarget;
                    setHoveredGroup(group.id);
                    onGroupHoverChange?.(group);
                  }
                : undefined
            }
            onPointerLeave={
              interactive && group
                ? () => {
                    hoveredGroupElement.current = null;
                    setHoveredGroup(null);
                    onGroupHoverChange?.(null);
                  }
                : undefined
            }
          >
            {(group || groups.length > 0) && (
              <div className={styles.caption}>
                {interactive && group ? (
                  <button
                    type="button"
                    className={styles.groupButton}
                    ref={(element) => {
                      if (element) groupControls.current.set(group.id, element);
                      else groupControls.current.delete(group.id);
                    }}
                    aria-pressed={
                      selection?.type === "group" && selection.id === group.id
                    }
                    onClick={() => activate({ type: "group", id: group.id })}
                    onFocus={() => {
                      if (restoringDismissedFocus.current) return;
                      setFocused({ type: "group", id: group.id });
                      onGroupFocusChange?.(group);
                    }}
                    onBlur={() => {
                      setFocused(null);
                      onGroupFocusChange?.(null);
                    }}
                  >
                    {group.label}{" "}
                    <span className={styles.count}>{members.length}</span>
                  </button>
                ) : (
                  <span>
                    {group?.label ?? ungroupedLabel}{" "}
                    <span className={styles.count}>{members.length}</span>
                  </span>
                )}
                {group?.description && (
                  <span className={styles.description}>
                    {group.description}
                  </span>
                )}
              </div>
            )}
            <div className={styles.grid} style={gridStyle(members.length)}>
              {members.map((item) => cell(item, !interactive))}
            </div>
          </div>
        ))}
      </div>
      {items.some((item) => item.draft) && (
        <div className={styles.draftLabel}>/ Draft</div>
      )}
      {showLegend && (
        <div className={styles.legend} role="group" aria-label="Categories">
          {legend.map((category) => {
            const content = (
              <>
                <span
                  className={styles.swatch}
                  style={categoryStyle(category)}
                  aria-hidden="true"
                />
                <span>{category.label}</span>
                <span className={styles.count}>{category.count}</span>
              </>
            );
            return interactive && onCategorySelectionChange ? (
              <button
                className={styles.legendEntry}
                key={category.id}
                type="button"
                aria-pressed={selectedCategoryId === category.id}
                onClick={() =>
                  onCategorySelectionChange(
                    selectedCategoryId === category.id ? null : category.id,
                  )
                }
              >
                {content}
              </button>
            ) : (
              <span className={styles.legendEntry} key={category.id}>
                {content}
              </span>
            );
          })}
        </div>
      )}
      {interactive && (
        <div
          className={styles.details}
          id={detailsId}
          aria-live="polite"
          aria-atomic="true"
        >
          {inspection ? (
            <>
              <div className={styles.detailsHeading}>
                {inspection.pinned ? "Selected" : "Inspecting"}
                {inspection.pinned && (
                  <button
                    type="button"
                    className={styles.clear}
                    onClick={() => clear(true)}
                  >
                    Clear selection
                  </button>
                )}
              </div>
              {renderDetails ? (
                renderDetails(inspection)
              ) : (
                <div>
                  {inspection.item
                    ? itemLabel(inspection.item)
                    : inspection.group?.label}
                </div>
              )}
            </>
          ) : (
            <span className={styles.hint}>
              Focus or select a cell or group to inspect it
            </span>
          )}
        </div>
      )}
    </div>
  );
}
