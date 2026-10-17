import React, { useCallback, useEffect, useRef, useState } from "react";
import { WaffleChart } from "./WaffleChart";
import {
  groupedWaffleItems,
  waffleCategories,
  waffleGroups,
  waffleItems,
} from "./WaffleChart.fixtures";
import type { ExampleMetadata } from "./WaffleChart.fixtures";
import type { WaffleChartGroupAnchor, WaffleChartSelection } from "./types";
import styles from "./WaffleChart.examples.module.scss";
import { routeExampleConnection } from "./exampleRouting";

const relationships = [
  { id: "shared-atlas", groupId: "shared", targetId: "atlas" },
  { id: "shared-beacon", groupId: "shared", targetId: "beacon" },
  { id: "specialist-beacon", groupId: "specialist", targetId: "beacon" },
];
const targets = [
  {
    id: "atlas",
    label: "Project Atlas",
    description: "Shared group participates",
  },
  {
    id: "beacon",
    label: "Project Beacon",
    description: "Shared and specialist groups participate",
  },
];

/** Caller-owned relationships and SVG layer; only the public anchors locate groups. */
export function LinkedWaffleGroups() {
  const frame = useRef<HTMLDivElement>(null);
  const pool = useRef<HTMLDivElement>(null);
  const targetElements = useRef(new Map<string, HTMLButtonElement>());
  const [anchors, setAnchors] = useState<readonly WaffleChartGroupAnchor[]>([]);
  const [paths, setPaths] = useState<
    readonly { id: string; groupId: string; path: string }[]
  >([]);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [hoveredItemGroup, setHoveredItemGroup] = useState<string | null>(null);
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  const [focusedItemGroup, setFocusedItemGroup] = useState<string | null>(null);
  const [targetGroup, setTargetGroup] = useState<string | null>(null);
  const [selection, setSelection] = useState<WaffleChartSelection>(null);
  const [category, setCategory] = useState<string | null>(null);
  const selectedGroup =
    selection?.type === "group"
      ? selection.id
      : selection?.type === "item"
        ? groupedWaffleItems.find((item) => item.id === selection.id)?.groupId
        : null;
  const activeGroup =
    selectedGroup ??
    focusedItemGroup ??
    focusedGroup ??
    targetGroup ??
    hoveredItemGroup ??
    hoveredGroup;
  const updateAnchors = useCallback(
    (next: readonly WaffleChartGroupAnchor[]) => setAnchors(next),
    [],
  );
  useEffect(() => {
    const container = frame.current;
    if (!container || !pool.current) return;
    const measure = () => {
      if (!pool.current) return;
      const parent = container.getBoundingClientRect();
      const poolBounds = pool.current.getBoundingClientRect();
      const next = relationships.flatMap((relationship, lane) => {
        const anchor = anchors.find(
          (entry) => entry.groupId === relationship.groupId,
        );
        const target = targetElements.current.get(relationship.targetId);
        if (!anchor || !target) return [];
        // Re-read the supported public element for caller-owned target/layout changes.
        const source = anchor.element.getBoundingClientRect();
        const destination = target.getBoundingClientRect();
        const outgoing = relationships.filter(
          (edge) => edge.groupId === relationship.groupId,
        );
        const incoming = relationships.filter(
          (edge) => edge.targetId === relationship.targetId,
        );
        const { path } = routeExampleConnection({
          source,
          destination,
          pool: poolBounds,
          frame: parent,
          lane,
          sourcePort: outgoing.findIndex((edge) => edge.id === relationship.id),
          sourcePortCount: outgoing.length,
          targetPort: incoming.findIndex((edge) => edge.id === relationship.id),
          targetPortCount: incoming.length,
        });
        return [{ ...relationship, path }];
      });
      setPaths((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(pool.current);
    for (const target of targetElements.current.values())
      observer.observe(target);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchors]);
  return (
    <div className={styles.example}>
      <h3 className={styles.heading}>Resource pool and linked work</h3>
      <p className={styles.intro}>
        17 supplied resources, each shown once. Shared group connects to two
        targets. Unlinked carries no availability meaning.
      </p>
      <div
        className={styles.composition}
        ref={frame}
        data-waffle-example="connections"
      >
        <svg className={styles.connections} aria-hidden="true">
          {paths.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              data-waffle-connection={edge.id}
              data-highlighted={activeGroup === edge.groupId || undefined}
              data-muted={
                (!!activeGroup && activeGroup !== edge.groupId) || undefined
              }
            />
          ))}
        </svg>
        <div className={styles.pool} ref={pool} data-waffle-pool>
          <WaffleChart<ExampleMetadata>
            accessibilityLabel="Synthetic resource pool"
            items={groupedWaffleItems}
            groups={waffleGroups}
            categories={waffleCategories}
            maxColumns={7}
            selection={selection}
            onSelectionChange={setSelection}
            highlight={{ groupIds: activeGroup ? [activeGroup] : [] }}
            selectedCategoryId={category}
            onCategorySelectionChange={setCategory}
            onGroupAnchorsChange={updateAnchors}
            onGroupHoverChange={(group) => setHoveredGroup(group?.id ?? null)}
            onGroupFocusChange={(group) => setFocusedGroup(group?.id ?? null)}
            onItemHoverChange={(item) =>
              setHoveredItemGroup(item?.groupId ?? null)
            }
            onItemFocusChange={(item) =>
              setFocusedItemGroup(item?.groupId ?? null)
            }
            renderDetails={({ item, group, pinned }) => (
              <div>
                <strong>{item?.label ?? group?.label}</strong>
                <div>
                  {item
                    ? `${item.metadata?.discipline}${item.draft ? " · Draft" : ""}`
                    : group?.description}
                </div>
                <div className={styles.small}>
                  {pinned
                    ? "Pinned until cleared"
                    : "Select to pin these details"}
                </div>
              </div>
            )}
          />
        </div>
        <div className={styles.targets} aria-label="Linked targets">
          {targets.map((target) => (
            <button
              key={target.id}
              ref={(element) => {
                if (element) targetElements.current.set(target.id, element);
                else targetElements.current.delete(target.id);
              }}
              className={styles.target}
              data-waffle-target={target.id}
              type="button"
              aria-pressed={
                selection?.type === "group" && selection.id === "shared"
              }
              onPointerEnter={() => setTargetGroup("shared")}
              onPointerLeave={() => setTargetGroup(null)}
              onFocus={() => setTargetGroup("shared")}
              onBlur={() => setTargetGroup(null)}
              onClick={() =>
                setSelection(
                  selection?.type === "group" && selection.id === "shared"
                    ? null
                    : { type: "group", id: "shared" },
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSelection(null);
                  setTargetGroup(null);
                }
              }}
            >
              <strong>{target.label}</strong>
              <span>{target.description}</span>
              <span className={styles.small}>Inspect shared group</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ControlledWaffleInspection() {
  const [items, setItems] = useState([...waffleItems]);
  const [selection, setSelection] = useState<WaffleChartSelection>(null);
  const [category, setCategory] = useState<string | null>(null);
  return (
    <div className={styles.example}>
      <h3 className={styles.heading}>Inspect and update by stable identity</h3>
      <p className={styles.intro}>
        Hover or focus for exact labels. Enter, Space, or a tap pins selection.
        Category buttons dim other cells and keep the pool total unchanged.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => setItems((current) => [...current].reverse())}
        >
          Reorder items
        </button>
        <button
          type="button"
          onClick={() =>
            setItems((current) => {
              const id =
                Math.max(
                  ...current.map((item) => Number(item.id.split("-")[1])),
                  0,
                ) + 1;
              return [
                ...current,
                {
                  id: `resource-${id}`,
                  label: `Resource ${String(id).padStart(2, "0")}`,
                  categoryId: "operations",
                  draft: true,
                  metadata: {
                    discipline: "Operations",
                    note: "New synthetic resource",
                  },
                },
              ];
            })
          }
        >
          Add item
        </button>
        <button
          type="button"
          disabled={selection?.type !== "item"}
          onClick={() => {
            setItems((current) =>
              current.filter((item) => item.id !== selection?.id),
            );
            setSelection(null);
          }}
        >
          Remove selected item
        </button>
      </div>
      <WaffleChart<ExampleMetadata>
        accessibilityLabel="Inspectable synthetic resources"
        items={items}
        categories={waffleCategories}
        selection={selection}
        onSelectionChange={setSelection}
        selectedCategoryId={category}
        onCategorySelectionChange={setCategory}
        renderDetails={({ item, totalCount }) => (
          <div>
            <strong>{item?.label}</strong>
            <div>
              {item?.metadata?.discipline}
              {item?.draft ? " · Draft" : ""}
            </div>
            <div>{item?.metadata?.note}</div>
            <div className={styles.small}>
              {totalCount} items remain in the supplied pool
            </div>
          </div>
        )}
      />
    </div>
  );
}
