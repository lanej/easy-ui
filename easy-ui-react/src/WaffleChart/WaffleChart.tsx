import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
const INSPECTION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Enter",
  " ",
]);

function categoryOrderedItems<Metadata>(
  items: readonly WaffleChartItem<Metadata>[],
  categories: readonly WaffleChartCategory[],
) {
  const buckets = new Map(
    categories.map((category) => [
      category.id,
      [] as WaffleChartItem<Metadata>[],
    ]),
  );
  for (const item of items) {
    const bucket = buckets.get(item.categoryId);
    if (bucket) bucket.push(item);
    else buckets.set(item.categoryId, [item]);
  }
  return [...buckets.values()].flat();
}

/** Discrete supplied resources. Applications own grouping and relationship meaning. */
export function WaffleChart<Metadata = unknown>({
  accessibilityLabel,
  items,
  categories,
  groups = EMPTY_GROUPS,
  variant = "default",
  interaction = "inspect",
  itemOrder = "input",
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
  const [contentFocused, setContentFocused] = useState(false);
  const [inspectionSource, setInspectionSource] = useState<"focus" | "hover">(
    "focus",
  );
  const [tabItemId, setTabItemId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLDivElement>(null);
  const anchorElements = useRef(new Map<string, HTMLElement>());
  const cellElements = useRef(new Map<string, HTMLButtonElement>());
  const groupControls = useRef(new Map<string, HTMLButtonElement>());
  const hoveredItemElement = useRef<HTMLElement | null>(null);
  const hoveredGroupElement = useRef<HTMLElement | null>(null);
  const restoringDismissedFocus = useRef(false);
  // React focus capture includes caller-owned portals, unlike DOM contains().
  const ownedContentElement = useRef<Element | null>(null);
  const focusRevision = useRef(0);
  const focusExitFrame = useRef<number | null>(null);
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
  const canChangeSelection =
    controlledSelection === undefined || !!onSelectionChange;
  const selectedAnnouncement = selection
    ? selection.type === "item"
      ? `Selected item: ${itemMap.get(selection.id)!.label}`
      : `Selected group: ${groupMap.get(selection.id)!.label}`
    : "";
  const focusedTarget = validTarget(focused);
  const hoveredTarget =
    hoveredItem && itemMap.has(hoveredItem)
      ? { type: "item" as const, id: hoveredItem }
      : hoveredGroup && groupMap.has(hoveredGroup)
        ? { type: "group" as const, id: hoveredGroup }
        : null;
  // Focus can remain on an unpinned control while the pointer explores other
  // targets. Let the latest interaction lead, without moving actual DOM focus.
  const transient =
    contentFocused && focusedTarget
      ? focusedTarget
      : inspectionSource === "hover"
        ? (hoveredTarget ?? focusedTarget)
        : (focusedTarget ?? hoveredTarget);
  const canDismissInspection =
    (!selection && !!transient) ||
    (!!selection && canChangeSelection) ||
    (selectedCategoryId !== null && !!onCategorySelectionChange);
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
  const inspectFromKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    next: Exclude<WaffleChartSelection, null>,
  ) => {
    // Escape leaves DOM focus in place after dismissal. A later inspection key
    // must restart inspection even when navigation cannot move to another cell.
    if (event.defaultPrevented || !INSPECTION_KEYS.has(event.key)) return;
    setFocused(next);
    setInspectionSource("focus");
    if (!sameTarget(focused, next) || inspectionSource !== "focus") {
      if (next.type === "item") onItemFocusChange?.(itemMap.get(next.id)!);
      else onGroupFocusChange?.(groupMap.get(next.id)!);
    }
  };
  const activate = (next: Exclude<WaffleChartSelection, null>) => {
    changeSelection(sameTarget(selection, next) ? null : next);
    if (next.type === "item") onItemActivate?.(itemMap.get(next.id)!);
    else onGroupActivate?.(groupMap.get(next.id)!);
  };
  const leaveHoverArea = useCallback(() => {
    const hadItem = !!hoveredItemElement.current;
    const hadGroup = !!hoveredGroupElement.current;
    setHoveredItem(null);
    setHoveredGroup(null);
    hoveredItemElement.current = null;
    hoveredGroupElement.current = null;
    if (hadItem) onItemHoverChange?.(null);
    if (hadGroup) onGroupHoverChange?.(null);
  }, [onItemHoverChange, onGroupHoverChange]);
  useEffect(() => {
    if (!interactive || selection || (!hoveredItem && !hoveredGroup)) return;
    const dismissHover = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        root.current?.contains(event.target as Node)
      )
        return;
      // Pure hover needn't move keyboard focus into the chart. Outside controls,
      // React roots and document-level overlays get the key first; dismiss only
      // if none handled it. In-chart Escape retains its scoped root behavior.
      event.preventDefault();
      leaveHoverArea();
    };
    window.addEventListener("keydown", dismissHover);
    return () => window.removeEventListener("keydown", dismissHover);
  }, [interactive, selection, hoveredItem, hoveredGroup, leaveHoverArea]);
  const isOriginControl = useCallback(
    (node: Element | null) =>
      [
        ...cellElements.current.values(),
        ...groupControls.current.values(),
      ].some((element) => element === node),
    [],
  );
  const ownsContentFocus = useCallback(
    (node: Element | null) =>
      !!node &&
      !isOriginControl(node) &&
      (!!root.current?.contains(node) ||
        ownedContentElement.current === node ||
        !!ownedContentElement.current?.contains(node)),
    [isOriginControl],
  );
  const cancelFocusExit = useCallback(() => {
    focusRevision.current++;
    if (focusExitFrame.current !== null) {
      cancelAnimationFrame(focusExitFrame.current);
      focusExitFrame.current = null;
    }
  }, []);
  useEffect(
    () => () => {
      focusRevision.current++;
      if (focusExitFrame.current !== null)
        cancelAnimationFrame(focusExitFrame.current);
    },
    [],
  );
  const contentRetainsTarget = () =>
    contentFocused &&
    !!focusedTarget &&
    ownsContentFocus(document.activeElement);
  const hoverGroup = (group: WaffleChartGroup) => {
    const retainInspection = contentRetainsTarget();
    // A group/caption is a new pointer target, rather than stale retained item
    // inspection. Use the public group's actual anchor element for lifecycle checks.
    if (hoveredItemElement.current) {
      hoveredItemElement.current = null;
      setHoveredItem(null);
      onItemHoverChange?.(null);
    }
    const element = anchorElements.current.get(group.id) ?? null;
    const changed =
      hoveredGroupElement.current !== element || inspectionSource !== "hover";
    hoveredGroupElement.current = element;
    setHoveredGroup(group.id);
    if (!retainInspection) {
      setInspectionSource("hover");
      if (changed) onGroupHoverChange?.(group);
    }
  };
  const targetControl = useCallback(
    (next: WaffleChartSelection) =>
      next?.type === "item"
        ? cellElements.current.get(next.id)
        : next?.type === "group"
          ? groupControls.current.get(next.id)
          : undefined,
    [],
  );
  const enterContentFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!target || isOriginControl(event.target)) return;
    cancelFocusExit();
    ownedContentElement.current = event.target;
    setContentFocused(true);
    if (focused?.type === "item" && target.type !== "item")
      onItemFocusChange?.(null);
    if (focused?.type === "group" && target.type !== "group")
      onGroupFocusChange?.(null);
    setFocused(target);
    setInspectionSource("focus");
    if (!sameTarget(focused, target) || inspectionSource !== "focus") {
      if (target.type === "item") onItemFocusChange?.(itemMap.get(target.id)!);
      else onGroupFocusChange?.(groupMap.get(target.id)!);
    }
  };
  const releaseFocusRegion = () => {
    ownedContentElement.current = null;
    setContentFocused(false);
    setFocused(null);
    if (focused?.type === "item") onItemFocusChange?.(null);
    if (focused?.type === "group") onGroupFocusChange?.(null);
    // Pointer targets tracked while chart content owned focus become active only now.
    if (hoveredItemElement.current || hoveredGroupElement.current) {
      setInspectionSource("hover");
      if (hoveredGroupElement.current && hoveredGroup)
        onGroupHoverChange?.(groupMap.get(hoveredGroup) ?? null);
      if (hoveredItemElement.current && hoveredItem)
        onItemHoverChange?.(itemMap.get(hoveredItem) ?? null);
    }
  };
  const focusRegionState = useRef({ focused, releaseFocusRegion });
  focusRegionState.current = { focused, releaseFocusRegion };
  const leaveFocusRegion = useCallback(() => {
    if (restoringDismissedFocus.current) return;
    cancelFocusExit();
    const revision = focusRevision.current;
    const settle = (allowPortalRestore: boolean) => {
      if (revision !== focusRevision.current) return;
      const active = document.activeElement;
      if (ownsContentFocus(active)) return;
      if (active === targetControl(focusRegionState.current.focused)) {
        ownedContentElement.current = null;
        setContentFocused(false);
        return;
      }
      if (
        allowPortalRestore &&
        active === document.body &&
        ownedContentElement.current &&
        !ownedContentElement.current.isConnected
      ) {
        // React Aria restores an overlay's trigger on the next frame. Keep its
        // owning details mounted through that handoff, then check actual focus.
        focusExitFrame.current = requestAnimationFrame(() => {
          focusExitFrame.current = null;
          settle(false);
        });
        return;
      }
      focusRegionState.current.releaseFocusRegion();
    };
    // A browser may run microtasks between native blur and destination focus.
    // Wait for the whole focus transition, then honor its React capture claim,
    // including caller-owned portals outside the chart's DOM.
    focusExitFrame.current = requestAnimationFrame(() => {
      focusExitFrame.current = null;
      settle(true);
    });
  }, [cancelFocusExit, ownsContentFocus, targetControl]);
  const restoreTargetFocus = () => {
    const returnTarget = targetControl(target);
    if (returnTarget) {
      restoringDismissedFocus.current = true;
      returnTarget.focus();
      restoringDismissedFocus.current = false;
    }
  };
  const clear = (restoreFocus = false) => {
    cancelFocusExit();
    ownedContentElement.current = null;
    changeSelection(null);
    setContentFocused(false);
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
    if (restoreFocus) restoreTargetFocus();
  };
  // React may remove/move a keyed cell between group parents without firing
  // blur/pointerleave. Clear transient targets when their real DOM owner changes.
  useEffect(() => {
    const withinContent = ownsContentFocus(document.activeElement);
    const waitingForFocus = focusExitFrame.current !== null;
    const restoringPortal =
      contentFocused &&
      document.activeElement === document.body &&
      !!ownedContentElement.current &&
      !ownedContentElement.current.isConnected;
    if (contentFocused && !interactive) {
      cancelFocusExit();
      ownedContentElement.current = null;
      setContentFocused(false);
    } else if (contentFocused && !withinContent) {
      leaveFocusRegion();
    }
    if (
      focused?.type === "item" &&
      (!interactive ||
        !itemMap.has(focused.id) ||
        (!withinContent &&
          !restoringPortal &&
          !waitingForFocus &&
          cellElements.current.get(focused.id) !== document.activeElement))
    ) {
      setFocused(null);
      onItemFocusChange?.(null);
    }
    if (
      focused?.type === "group" &&
      (!interactive ||
        !groupMap.has(focused.id) ||
        (!withinContent &&
          !restoringPortal &&
          !waitingForFocus &&
          groupControls.current.get(focused.id) !== document.activeElement))
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
    cancelFocusExit,
    ownsContentFocus,
    leaveFocusRegion,
    contentFocused,
    hoveredItem,
    hoveredGroup,
    onItemFocusChange,
    onGroupFocusChange,
    onItemHoverChange,
    onGroupHoverChange,
  ]);
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
    if (itemOrder === "category") {
      for (const bucket of buckets)
        bucket.items = categoryOrderedItems(bucket.items, categories);
    }
    return buckets;
  }, [items, groups, categories, itemOrder]);
  const compactItems = useMemo(
    () =>
      itemOrder === "category"
        ? categoryOrderedItems(items, categories)
        : items,
    [items, categories, itemOrder],
  );
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
  const totalLabel = countLabel(items.length);
  // A single revision object avoids coupling consumers to markup or class names.
  const geometryRevision = useMemo(
    () => [
      items,
      groups,
      categories,
      itemOrder,
      compact,
      columns,
      size,
      spacing,
      showCount,
      countLabel,
      totalLabel,
      layoutRevision,
    ],
    [
      items,
      groups,
      categories,
      itemOrder,
      compact,
      columns,
      size,
      spacing,
      showCount,
      countLabel,
      totalLabel,
      layoutRevision,
    ],
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
      const candidates = visibleItems
        .map((entry) => ({
          entry,
          rect: cellElements.current.get(entry.id)?.getBoundingClientRect(),
        }))
        .filter(({ rect }) => rect && (rect.top - origin.top) * direction > 1);
      const nearestRow = candidates.reduce(
        (nearest, { rect }) =>
          Math.min(nearest, Math.abs(rect!.top - origin.top)),
        Infinity,
      );
      // Horizontal proximity must never skip a nearer partial row. Treat
      // subpixel-aligned cells within 1px as members of the same visual row.
      next = candidates
        .filter(
          ({ rect }) => Math.abs(rect!.top - origin.top) <= nearestRow + 1,
        )
        .sort(
          (a, b) =>
            Math.abs(a.rect!.left - origin.left) -
            Math.abs(b.rect!.left - origin.left),
        )[0]?.entry;
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
          aria-label={
            compact
              ? undefined
              : `${itemLabel(item)}${selected ? ", Selected" : ""}`
          }
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
          const groupElement = anchorElements.current.get(item.groupId ?? "");
          if (
            hoveredGroupElement.current &&
            hoveredGroupElement.current !== groupElement
          ) {
            hoveredGroupElement.current = null;
            setHoveredGroup(null);
            onGroupHoverChange?.(null);
          }
          hoveredItemElement.current = event.currentTarget;
          setHoveredItem(item.id);
          if (!contentRetainsTarget()) {
            setInspectionSource("hover");
            onItemHoverChange?.(item);
          }
        }}
        onFocus={() => {
          cancelFocusExit();
          ownedContentElement.current = null;
          setContentFocused(false);
          setTabItemId(item.id);
          if (restoringDismissedFocus.current) return;
          if (focused?.type === "group") onGroupFocusChange?.(null);
          setFocused({ type: "item", id: item.id });
          setInspectionSource("focus");
          onItemFocusChange?.(item);
        }}
        onClick={() => activate({ type: "item", id: item.id })}
        onKeyDown={(event) => {
          inspectFromKeyboard(event, { type: "item", id: item.id });
          moveFocus(event, item);
        }}
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
        aria-label={`${accessibilityLabel}: ${totalLabel}${selectedAnnouncement ? `. ${selectedAnnouncement}` : ""}${items.length ? `. ${compactItems.map(itemLabel).join("; ")}` : `. ${emptyMessage}`}`}
      >
        <span className={styles.grid} style={gridStyle(items.length)}>
          {compactItems.map((item) => cell(item, true))}
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
      onFocusCapture={interactive ? enterContentFocus : undefined}
      onBlurCapture={interactive ? leaveFocusRegion : undefined}
      // Keep hover inspection available across the gap into selectable details.
      // It ends at the combined chart/details boundary, not the cell boundary.
      onPointerLeave={interactive ? leaveHoverArea : undefined}
      onKeyDown={(event) => {
        if (
          interactive &&
          event.key === "Escape" &&
          !event.defaultPrevented &&
          canDismissInspection
        ) {
          event.preventDefault();
          event.stopPropagation();
          clear(ownsContentFocus(event.target as Element));
        }
      }}
    >
      {showCount && <div className={styles.total}>{totalLabel}</div>}
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
              group
                ? `${group.label}${!interactive && selection?.type === "group" && selection.id === group.id ? ", Selected group" : ""}`
                : groups.length
                  ? ungroupedLabel
                  : undefined
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
              interactive && group ? () => hoverGroup(group) : undefined
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
                    onPointerEnter={(event) => {
                      // Entry from outside the group is already handled by its
                      // wrapper; this path reclaims its caption from a child cell.
                      if (
                        event.relatedTarget instanceof Node &&
                        anchorElements.current
                          .get(group.id)
                          ?.contains(event.relatedTarget)
                      )
                        hoverGroup(group);
                    }}
                    onClick={() => activate({ type: "group", id: group.id })}
                    onFocus={() => {
                      cancelFocusExit();
                      ownedContentElement.current = null;
                      setContentFocused(false);
                      if (restoringDismissedFocus.current) return;
                      if (focused?.type === "item") onItemFocusChange?.(null);
                      setFocused({ type: "group", id: group.id });
                      setInspectionSource("focus");
                      onGroupFocusChange?.(group);
                    }}
                    onKeyDown={(event) =>
                      inspectFromKeyboard(event, {
                        type: "group",
                        id: group.id,
                      })
                    }
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
          ref={details}
          className={styles.details}
          id={detailsId}
          aria-live="polite"
          aria-atomic="true"
        >
          {inspection ? (
            <>
              <div className={styles.detailsHeading}>
                {inspection.pinned ? "Selected" : "Inspecting"}
                {inspection.pinned && canChangeSelection && (
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
