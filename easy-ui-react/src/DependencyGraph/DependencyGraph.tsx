import React, { useEffect, useMemo, useRef, useState } from "react";
import { useId } from "react-aria";
import { Button } from "../Button";
import { ExpandButton } from "../ExpandButton";
import { CollapseButton } from "../CollapseButton";
import { Icon } from "../Icon";
import { Select } from "../Select";
import { TextField } from "../TextField";
import { DependencyGraphDetails } from "./DependencyGraphDetails";
import { DependencyGraphChanges } from "./DependencyGraphChanges";
import {
  buildDependencyGraph,
  createDependencyGraphOrder,
  dependencyGraphLayoutKey,
  dependencyChangeLabels,
  hasDependencyGraphChanges,
  foldDependencyBranches,
  visibleDependencyNodes,
} from "./model";
import type { GraphItem } from "./model";
import {
  attributePortKey,
  routeDependencyConnections,
  roundedConnectionPath,
} from "./routing";
import type {
  DependencyGraphGroup,
  DependencyGraphProps,
  DependencyGraphSelection,
  DependencyGraphView,
} from "./types";
import styles from "./DependencyGraph.module.scss";

const EMPTY_GROUPS: readonly DependencyGraphGroup[] = [];

const scopeLabels = {
  all: "All resources",
  changes: "Changes + context",
  dependencies: "Dependencies",
  dependents: "Dependents",
  neighbors: "Connected resources",
} as const;
const rem = (value: number) => `${value / 16}rem`;
const overviewChanges = {
  create: "+",
  update: "~",
  replace: "↻",
  delete: "−",
  unchanged: "=",
  unknown: "?",
} as const;
const sameEdgeSelection = (
  selection: DependencyGraphSelection,
  ids: readonly string[],
) =>
  selection?.type === "edge"
    ? ids.includes(selection.id)
    : selection?.type === "edges"
      ? selection.ids.some((id) => ids.includes(id))
      : false;

/** A directed dependency browser. Applications supply relationship meaning and evidence. */
export function DependencyGraph({
  title,
  description,
  accessibilityLabel,
  nodes,
  edges,
  groups = EMPTY_GROUPS,
  selection: controlledSelection,
  defaultSelection = null,
  onSelectionChange,
  view: controlledView,
  defaultView = { scope: "all" },
  onViewChange,
  collapsedGroupIds: controlledCollapsed,
  defaultCollapsedGroupIds = [],
  onCollapsedGroupIdsChange,
  collapsedNodeIds: controlledCollapsedNodes,
  defaultCollapsedNodeIds = [],
  onCollapsedNodeIdsChange,
  expandedChangeNodeIds: controlledExpandedChanges,
  defaultExpandedChangeNodeIds = [],
  onExpandedChangeNodeIdsChange,
  highlightedEdgeIds = [],
  hiddenEdgeIds = [],
  layoutRevision,
  coverage,
  status = "ready",
  message,
  onRetry,
  height = 480,
  showDetails = true,
  detailsExpanded: controlledDetailsExpanded,
  defaultDetailsExpanded = false,
  onDetailsExpandedChange,
  defaultChangePresentation,
  renderNodeAnnotation,
  renderAttributeAnnotation,
  renderDetails,
}: DependencyGraphProps) {
  const [localSelection, setLocalSelection] = useState(defaultSelection);
  const [localDetailsExpanded, setLocalDetailsExpanded] = useState(
    defaultDetailsExpanded,
  );
  const detailsExpanded = controlledDetailsExpanded ?? localDetailsExpanded;
  const changeDetailsExpanded = (expanded: boolean) => {
    if (controlledDetailsExpanded === undefined)
      setLocalDetailsExpanded(expanded);
    onDetailsExpandedChange?.(expanded);
  };
  const [localView, setLocalView] = useState(defaultView);
  const [localCollapsed, setLocalCollapsed] = useState(
    defaultCollapsedGroupIds,
  );
  const [query, setQuery] = useState("");
  const [localCollapsedNodes, setLocalCollapsedNodes] = useState(
    defaultCollapsedNodeIds,
  );
  const [localExpandedChanges, setLocalExpandedChanges] = useState(
    defaultExpandedChangeNodeIds,
  );
  const [nodeHeights, setNodeHeights] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [attributePorts, setAttributePorts] = useState<
    ReadonlyMap<string, number>
  >(() => new Map());
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState<number | null>(null);
  const firstFit = useRef(false);
  const instanceId = useId().replace(/:/g, "");
  const selection =
    controlledSelection === undefined ? localSelection : controlledSelection;
  const view = controlledView ?? localView;
  const collapsed = controlledCollapsed ?? localCollapsed;
  const collapsedNodes = controlledCollapsedNodes ?? localCollapsedNodes;
  const density = zoom < 0.7 ? "overview" : zoom < 1 ? "summary" : "detail";
  const changeCollapsedNodes = (next: readonly string[]) => {
    if (controlledCollapsedNodes === undefined)
      setLocalCollapsedNodes([...next]);
    onCollapsedNodeIdsChange?.(next);
  };
  const expandedChanges = controlledExpandedChanges ?? localExpandedChanges;
  const changeExpandedChanges = (next: readonly string[]) => {
    if (controlledExpandedChanges === undefined)
      setLocalExpandedChanges([...next]);
    onExpandedChangeNodeIdsChange?.(next);
  };
  const select = (next: DependencyGraphSelection) => {
    if (controlledSelection === undefined) setLocalSelection(next);
    onSelectionChange?.(next);
  };
  const changeView = (next: DependencyGraphView) => {
    if (!controlledView) setLocalView(next);
    onViewChange?.(next);
  };
  const changeCollapsed = (next: readonly string[]) => {
    if (controlledCollapsed === undefined) setLocalCollapsed([...next]);
    onCollapsedGroupIdsChange?.(next);
  };
  const duplicate = [
    ["resource", nodes],
    ["relationship", edges],
    ["group", groups],
  ].flatMap(([kind, records]) => {
    const seen = new Set<string>();
    return (records as readonly { id: string }[])
      .filter((record) => {
        const exists = seen.has(record.id);
        seen.add(record.id);
        return exists;
      })
      .map((record) => `Duplicate ${kind} ID: ${record.id}`);
  })[0];
  const layoutKey = dependencyGraphLayoutKey(nodes, groups, layoutRevision);
  const newLayout = () => ({
    key: layoutKey,
    error: duplicate,
    order: duplicate ? null : createDependencyGraphOrder(nodes, edges, groups),
  });
  const [layout, setLayout] = useState(newLayout);
  // Only a new resource/group identity or explicit revision starts a fresh layout.
  // Store the initial topology: callers may hide edges by filtering the edges prop.
  let currentLayout = layout;
  if (layout.key !== layoutKey || layout.error !== duplicate) {
    currentLayout = newLayout();
    setLayout(currentLayout);
  }
  const branches = useMemo(
    () =>
      foldDependencyBranches(
        nodes,
        edges,
        collapsedNodes,
        "nodeId" in view ? view.nodeId : undefined,
      ),
    [nodes, edges, collapsedNodes, view],
  );
  const projectedNodes = useMemo(
    () => nodes.filter((node) => branches.visible.has(node.id)),
    [nodes, branches],
  );
  const projectedEdges = useMemo(() => {
    const records = new Set(nodes.map((node) => node.id));
    const stops = new Set(collapsedNodes);
    return edges.filter(
      (edge) =>
        !records.has(edge.source) ||
        !records.has(edge.target) ||
        (branches.visible.has(edge.source) &&
          branches.visible.has(edge.target) &&
          !stops.has(edge.source)),
    );
  }, [nodes, edges, branches, collapsedNodes]);
  useEffect(() => {
    const element = viewport.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const unit =
        (parseFloat(getComputedStyle(document.documentElement).fontSize) ||
          16) / 16;
      setCanvasWidth(Math.floor(element.clientWidth / unit));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [status, duplicate, projectedNodes.length]);
  const model = useMemo(
    () =>
      duplicate
        ? null
        : buildDependencyGraph(
            projectedNodes,
            projectedEdges,
            groups,
            collapsed,
            nodeHeights,
            new Map(
              nodes.map((node) => [
                node.id,
                density === "overview"
                  ? 192
                  : density === "detail" && expandedChanges.includes(node.id)
                    ? Math.min(352, Math.max(240, (canvasWidth ?? 400) - 48))
                    : 256,
              ]),
            ),
            zoom,
            currentLayout.order ?? undefined,
          ),
    [
      nodes,
      projectedNodes,
      projectedEdges,
      groups,
      collapsed,
      duplicate,
      nodeHeights,
      expandedChanges,
      canvasWidth,
      density,
      zoom,
      currentLayout.order,
    ],
  );
  const visible = useMemo(
    () =>
      new Set(
        [...visibleDependencyNodes(nodes, edges, view)].filter((id) =>
          branches.visible.has(id),
        ),
      ),
    [nodes, edges, view, branches],
  );
  const items = useMemo(
    () =>
      model?.items.filter((item) =>
        item.members.some((node) => visible.has(node.id)),
      ) ?? [],
    [model, visible],
  );
  const renderedNodeIds = items
    .filter((item) => item.node)
    .map((item) => item.node!.id)
    .join("\0");
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const measurePorts = () => {
      const next = new Map<string, number>();
      const unit =
        (parseFloat(getComputedStyle(document.documentElement).fontSize) ||
          16) / 16;
      viewport.current
        ?.querySelectorAll<HTMLElement>("[data-graph-resource-card]")
        .forEach((card) => {
          const rect = card.getBoundingClientRect();
          const diff = card
            .querySelector("[data-graph-card-diff]")
            ?.getBoundingClientRect();
          const scale =
            new DOMMatrix(getComputedStyle(card.parentElement!).transform).a *
            unit;
          card
            .querySelectorAll<HTMLElement>("[data-field-change]")
            .forEach((field) => {
              const heading = field
                .querySelector("dt")
                ?.getBoundingClientRect();
              const key = attributePortKey(
                card.dataset.graphResourceCard!,
                field.dataset.fieldChange!,
              );
              if (
                heading &&
                diff &&
                heading.height > 0 &&
                heading.top >= diff.top &&
                heading.bottom <= diff.bottom &&
                !next.has(key)
              )
                next.set(
                  key,
                  Math.round(
                    ((heading.top + heading.height / 2 - rect.top) / scale) * 2,
                  ) / 2,
                );
            });
        });
      setAttributePorts((previous) =>
        previous.size === next.size &&
        [...next].every(([key, value]) => previous.get(key) === value)
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver((entries) => {
      const rootSize =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setNodeHeights((previous) => {
        const next = new Map(previous);
        let changed = false;
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const height = Math.ceil(
            ((entry.borderBoxSize?.[0]?.blockSize ?? element.offsetHeight) *
              16) /
              rootSize,
          );
          const id = element.dataset.graphResourceCard;
          if (id && height > 0 && next.get(id) !== height) {
            next.set(id, height);
            changed = true;
          }
        }
        return changed ? next : previous;
      });
      measurePorts();
    });
    viewport.current
      ?.querySelectorAll("[data-graph-resource-card]")
      .forEach((element) => observer.observe(element));
    viewport.current
      ?.querySelectorAll("[data-graph-resource-card] [data-field-change]")
      .forEach((element) => observer.observe(element));
    measurePorts();
    return () => observer.disconnect();
  }, [renderedNodeIds, status, duplicate, nodes, expandedChanges, density]);
  const clusters = useMemo(
    () =>
      (model?.clusters ?? []).flatMap((cluster) => {
        const members = items.filter(
          (item) => item.node?.groupId === cluster.group.id,
        );
        if (!members.length) return [];
        const x = Math.min(...members.map((item) => item.x)) - 16;
        const y =
          Math.min(...members.map((item) => item.y)) -
          Math.max(44, 25 / zoom + 8);
        return [
          {
            ...cluster,
            x,
            y,
            width:
              Math.max(...members.map((item) => item.x + item.width)) - x + 16,
            height:
              Math.max(...members.map((item) => item.y + item.height)) - y + 16,
          },
        ];
      }),
    [model, items, zoom],
  );
  const rawConnections = useMemo(
    () =>
      model?.connections
        .map((connection) => ({
          ...connection,
          edges: connection.edges.filter(
            (edge) =>
              visible.has(edge.source) &&
              visible.has(edge.target) &&
              !hiddenEdgeIds.includes(edge.id),
          ),
        }))
        .filter((connection) => connection.edges.length) ?? [],
    [model, visible, hiddenEdgeIds],
  );
  const connections = useMemo(
    () =>
      routeDependencyConnections(
        items,
        rawConnections,
        attributePorts,
        clusters.map((cluster) => ({
          x: cluster.x,
          y: cluster.y,
          width: cluster.width,
          height: Math.max(36, 25 / zoom + 4),
        })),
        zoom,
      ),
    [items, rawConnections, attributePorts, clusters, zoom],
  );
  const sceneWidth = Math.max(
    model?.width ?? 0,
    ...connections.flatMap((connection) =>
      connection.points.map((point) => point.x + 16),
    ),
  );
  const sceneHeight = Math.max(
    model?.height ?? 0,
    ...connections.flatMap((connection) =>
      connection.points.map((point) => point.y + 16),
    ),
  );
  const selectedNode =
    selection?.type === "node"
      ? nodes.find((node) => node.id === selection.id)
      : undefined;
  const focusNode =
    "nodeId" in view
      ? nodes.find((node) => node.id === view.nodeId)
      : undefined;
  const search = query.trim().toLowerCase();
  const matches = search
    ? nodes.filter((node) =>
        `${node.label} ${node.id} ${node.description ?? ""}`
          .toLowerCase()
          .includes(search),
      )
    : [];
  const highlighted = new Set(highlightedEdgeIds);
  const changeZoom = (next: number) => {
    const scale = Math.round(Math.max(0.4, Math.min(2, next)) * 100) / 100;
    const element = viewport.current;
    const centerX = element
      ? (element.scrollLeft + element.clientWidth / 2) / zoom
      : 0;
    const centerY = element
      ? (element.scrollTop + element.clientHeight / 2) / zoom
      : 0;
    setZoom(scale);
    if (element)
      requestAnimationFrame(() => {
        element.scrollLeft = Math.max(
          0,
          centerX * scale - element.clientWidth / 2,
        );
        element.scrollTop = Math.max(
          0,
          centerY * scale - element.clientHeight / 2,
        );
      });
  };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      changeZoom(zoom * Math.exp(-event.deltaY * 0.002));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  });
  const fit = (initial = false) => {
    const element = viewport.current;
    if (!element || !items.length) return;
    const rootSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    const unit =
      (Number.isFinite(rootSize) && rootSize > 0 ? rootSize : 16) / 16;
    const boxes = [
      ...items,
      ...clusters,
      ...connections.flatMap((connection) =>
        connection.points.map((point) => ({
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
        })),
      ),
    ];
    const x = Math.min(...boxes.map((item) => item.x));
    const y = Math.min(...boxes.map((item) => item.y));
    const right = Math.max(...boxes.map((item) => item.x + item.width));
    const bottom = Math.max(...boxes.map((item) => item.y + item.height));
    // Initial expanded cards remain readable. Explicit fit can use the overview.
    const fitted = Math.max(
      initial &&
        (element.clientWidth < 600 ||
          items.some(
            (item) => item.node && expandedChanges.includes(item.node.id),
          ))
        ? 1
        : 0.4,
      Math.min(
        1,
        (element.clientWidth - 48) / ((right - x) * unit),
        (element.clientHeight - 48) / ((bottom - y) * unit),
      ),
    );
    const scale = Math.floor(fitted * 100) / 100;
    setZoom(scale);
    const anchorId = selectedNode?.id ?? focusNode?.id;
    const anchor =
      element.clientWidth < 600 && anchorId
        ? items.find((item) =>
            item.members.some((node) => node.id === anchorId),
          )
        : undefined;
    requestAnimationFrame(() => {
      element.scrollLeft = Math.max(0, (anchor?.x ?? x) * unit * scale - 24);
      element.scrollTop = Math.max(0, (anchor?.y ?? y) * unit * scale - 24);
    });
  };
  useEffect(() => {
    const measured =
      typeof ResizeObserver === "undefined" ||
      items.every((item) => !item.node || nodeHeights.has(item.node.id));
    if (!firstFit.current && items.length && status === "ready" && measured) {
      firstFit.current = true;
      fit(true);
    }
  });
  const showNode = (id: string) => {
    const node = nodes.find((record) => record.id === id);
    if (!node) return;
    if (!branches.visible.has(id)) changeCollapsedNodes([]);
    if (node.groupId && collapsed.includes(node.groupId))
      changeCollapsed(collapsed.filter((groupId) => groupId !== node.groupId));
    changeView({ scope: "neighbors", nodeId: id, depth: 1 });
    select({ type: "node", id });
    setQuery("");
    // Layout commits after group expansion; focus scrolls the actual HTML button into view.
    requestAnimationFrame(() => {
      const button = [
        ...(viewport.current?.querySelectorAll<HTMLButtonElement>(
          "[data-graph-node]",
        ) ?? []),
      ].find((element) => element.dataset.graphNode === id);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };
  const navigate = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    item: GraphItem,
  ) => {
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    const next = items
      .filter(
        (candidate) =>
          (candidate.x - item.x) * direction[0] +
            (candidate.y - item.y) * direction[1] >
          0,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - item.x, a.y - item.y) -
          Math.hypot(b.x - item.x, b.y - item.y),
      )[0];
    if (!next) return;
    event.preventDefault();
    const button = [
      ...(viewport.current?.querySelectorAll<HTMLButtonElement>(
        "[data-graph-item]",
      ) ?? []),
    ].find((element) => element.dataset.graphItem === next.key);
    button?.focus();
  };
  const chooseScope = (scope: DependencyGraphView["scope"]) => {
    if (scope === "all") changeView({ scope });
    else if (scope === "changes") changeView({ scope, depth: 1 });
    else if (selectedNode ?? focusNode)
      changeView({ scope, nodeId: (selectedNode ?? focusNode)!.id, depth: 1 });
  };
  const selectedEdgeIds = new Set(
    selection?.type === "edge"
      ? [selection.id]
      : selection?.type === "edges"
        ? selection.ids
        : [],
  );
  const isSelected = (item: GraphItem) =>
    selection?.type === "group"
      ? item.group?.id === selection.id
      : item.members.some(
          (node) =>
            (selection?.type === "node" && node.id === selection.id) ||
            edges.some(
              (edge) =>
                selectedEdgeIds.has(edge.id) &&
                (edge.source === node.id || edge.target === node.id),
            ),
        );

  return (
    <section
      className={styles.root}
      data-dependency-graph
      data-graph-density={density}
      style={{ "--dependency-graph-zoom": zoom } as React.CSSProperties}
      aria-label={accessibilityLabel || title || "Resource dependencies"}
    >
      {(title || description) && (
        <header className={styles.heading}>
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
        </header>
      )}
      {coverage && (
        <p className={styles.coverage} data-coverage={coverage.status}>
          <strong>
            {coverage.status === "complete"
              ? "Relationship evidence complete"
              : coverage.status === "partial"
                ? "Partial relationship evidence"
                : "Relationship coverage unknown"}
          </strong>
          {coverage.description && <span>{coverage.description}</span>}
        </p>
      )}
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <TextField
            type="search"
            aria-label="Find resource"
            placeholder="Find resource"
            size="sm"
            value={query}
            onChange={setQuery}
          />
          {search && (
            <div
              className={styles.searchResults}
              role="region"
              aria-label="Resource search results"
            >
              <span role="status" className={styles.muted}>
                {matches.length} matching resources
              </span>
              {matches.slice(0, 20).map((node) => (
                <button
                  type="button"
                  key={node.id}
                  onClick={() => showNode(node.id)}
                >
                  <strong>{node.label}</strong>
                  <span>{node.description ?? node.id}</span>
                </button>
              ))}
              {matches.length > 20 && (
                <p className={styles.muted}>
                  Refine your search to see more results.
                </p>
              )}
            </div>
          )}
        </div>
        <div className={styles.scope}>
          <Select
            aria-label="Graph scope"
            size="sm"
            selectedKey={view.scope}
            disabledKeys={
              selectedNode || focusNode
                ? []
                : ["dependencies", "dependents", "neighbors"]
            }
            onSelectionChange={(key) =>
              chooseScope(key as DependencyGraphView["scope"])
            }
          >
            {Object.entries(scopeLabels).map(([key, label]) => (
              <Select.Option key={key}>{label}</Select.Option>
            ))}
          </Select>
        </div>
        {view.scope !== "all" && (
          <Button
            size="sm"
            variant="outlined"
            color="primary"
            onPress={() =>
              changeView({
                ...view,
                depth: Math.min(nodes.length, (view.depth ?? 1) + 1),
              })
            }
          >
            Expand one level
          </Button>
        )}
        {!!collapsedNodes.length && (
          <Button
            size="sm"
            variant="outlined"
            onPress={() => changeCollapsedNodes([])}
          >
            Expand all branches
          </Button>
        )}
        <div className={styles.cameraControls}>
          <CollapseButton
            accessibilityLabel="Zoom out graph"
            aria-expanded={undefined}
            isDisabled={zoom <= 0.4}
            onPress={() => changeZoom(zoom - 0.2)}
          />
          <output aria-label="Graph zoom">{Math.round(zoom * 100)}%</output>
          <ExpandButton
            accessibilityLabel="Zoom in graph"
            aria-expanded={undefined}
            isDisabled={zoom >= 2}
            onPress={() => changeZoom(zoom + 0.2)}
          />
          <Button
            size="sm"
            variant="outlined"
            color="primary"
            onPress={() => fit()}
          >
            Fit visible
          </Button>
        </div>
      </div>
      {focusNode && (
        <p className={styles.focusContext}>
          {scopeLabels[view.scope]} of <strong>{focusNode.label}</strong> ·{" "}
          {"depth" in view ? (view.depth ?? 1) : 0}{" "}
          {"depth" in view && (view.depth ?? 1) === 1 ? "level" : "levels"}
        </p>
      )}
      {!!model?.unavailable.length && (
        <details className={styles.unresolved}>
          <summary>
            {model.unavailable.length}{" "}
            {model.unavailable.length === 1
              ? "relationship has"
              : "relationships have"}{" "}
            unavailable endpoints
          </summary>
          {model.unavailable.map((edge) => (
            <button
              type="button"
              key={edge.id}
              className={styles.relationship}
              onClick={() => select({ type: "edge", id: edge.id })}
            >
              {edge.label ?? edge.id}: {edge.source} → {edge.target}
            </button>
          ))}
        </details>
      )}
      <div
        className={styles.workspace}
        data-has-details={showDetails || undefined}
        data-details-expanded={detailsExpanded || undefined}
      >
        <div className={styles.graphColumn}>
          {status !== "ready" || duplicate || !nodes.length || !items.length ? (
            <div
              className={styles.state}
              role="status"
              aria-busy={status === "loading" || undefined}
            >
              {duplicate ??
                message ??
                (status === "loading"
                  ? "Loading dependencies…"
                  : status === "error"
                    ? "Dependencies could not be loaded."
                    : !nodes.length
                      ? "No resources supplied."
                      : "No resources in this view.")}
              {status === "error" && onRetry && (
                <Button size="sm" onPress={onRetry}>
                  Retry
                </Button>
              )}
              {nodes.length > 0 &&
                !duplicate &&
                status === "ready" &&
                !items.length && (
                  <Button
                    size="sm"
                    variant="outlined"
                    onPress={() => changeView({ scope: "all" })}
                  >
                    Show all resources
                  </Button>
                )}
            </div>
          ) : (
            <>
              <div
                className={styles.viewport}
                data-graph-canvas
                id={`${instanceId}-canvas`}
                ref={viewport}
                tabIndex={0}
                aria-label="Dependency graph canvas"
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (["+", "=", "-", "0"].includes(event.key)) {
                    event.preventDefault();
                    if (event.key === "0") fit();
                    else changeZoom(zoom + (event.key === "-" ? -0.2 : 0.2));
                  }
                }}
                style={{
                  height: Number.isFinite(height) && height > 0 ? height : 480,
                }}
              >
                <div
                  className={styles.scrollArea}
                  style={{
                    width: rem(sceneWidth * zoom),
                    height: rem(sceneHeight * zoom),
                  }}
                >
                  <div
                    className={styles.canvas}
                    style={{
                      width: rem(sceneWidth),
                      height: rem(sceneHeight),
                      transform: `scale(${zoom})`,
                    }}
                  >
                    {clusters.map((cluster) => (
                      <div
                        key={cluster.group.id}
                        className={styles.cluster}
                        style={{
                          left: rem(cluster.x),
                          top: rem(cluster.y),
                          width: rem(cluster.width),
                          height: rem(cluster.height),
                        }}
                      >
                        <div className={styles.clusterHeading}>
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() =>
                              select({ type: "group", id: cluster.group.id })
                            }
                          >
                            {cluster.group.label}
                          </button>
                          <CollapseButton
                            accessibilityLabel={`Collapse ${cluster.group.label}`}
                            aria-controls={`${instanceId}-canvas`}
                            onPress={() =>
                              changeCollapsed([...collapsed, cluster.group.id])
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <svg
                      className={styles.edges}
                      viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
                      aria-hidden="true"
                    >
                      <defs>
                        {[
                          "unknown",
                          "unchanged",
                          "add",
                          "remove",
                          "update",
                        ].map((change) => (
                          <marker
                            key={change}
                            id={`${instanceId}-arrow-${change}`}
                            data-link-change={change}
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="7"
                            markerHeight="7"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 0 L 10 5 L 0 10 z" />
                          </marker>
                        ))}
                      </defs>
                      {connections.map((connection) => {
                        const ids = connection.edges.map((edge) => edge.id);
                        const change = connection.edges[0].change ?? "unknown";
                        const selected = sameEdgeSelection(selection, ids);
                        const path = roundedConnectionPath(connection.points);
                        return (
                          <g
                            key={connection.key}
                            className={styles.connection}
                            data-selected={selected || undefined}
                            data-highlighted={
                              ids.some((id) => highlighted.has(id)) || undefined
                            }
                            data-dashed={
                              connection.edges.every(
                                (edge) => edge.variant === "dashed",
                              ) || undefined
                            }
                            data-link-change={change}
                            data-graph-source-attribute={
                              connection.sourceAttribute
                            }
                            data-graph-target-attribute={
                              connection.targetAttribute
                            }
                            data-graph-route-points={JSON.stringify(
                              connection.points,
                            )}
                            data-graph-edge-ids={JSON.stringify(ids)}
                            onClick={() =>
                              select(
                                ids.length === 1
                                  ? { type: "edge", id: ids[0] }
                                  : { type: "edges", ids },
                              )
                            }
                          >
                            <path className={styles.edgeHitArea} d={path} />
                            <path
                              className={styles.edgeLine}
                              d={path}
                              markerEnd={`url(#${instanceId}-arrow-${change})`}
                            />
                            <title>
                              {connection.edges
                                .map(
                                  (edge) =>
                                    `${edge.change === "add" ? "Added: " : edge.change === "remove" ? "Removed: " : edge.change === "update" ? "Modified: " : ""}${edge.label ?? edge.id}`,
                                )
                                .join("; ")}
                            </title>
                          </g>
                        );
                      })}
                    </svg>
                    {items.map((item) => {
                      const selected = isSelected(item);
                      const node = item.node;
                      const changed = item.members.filter(
                        (member) =>
                          member.change &&
                          member.change !== "unchanged" &&
                          member.change !== "unknown",
                      ).length;
                      const label = node?.label ?? item.group!.label;
                      const cardDescription =
                        node?.changeSummary ??
                        node?.description ??
                        item.group?.description;
                      const diffShown =
                        !!node &&
                        density === "detail" &&
                        expandedChanges.includes(node.id);
                      const branchCollapsed =
                        !!node && collapsedNodes.includes(node.id);
                      const dependents = node
                        ? (branches.dependentCounts.get(node.id) ?? 0)
                        : 0;
                      const shown = item.members.filter((member) =>
                        visible.has(member.id),
                      ).length;
                      const annotation = node && renderNodeAnnotation?.(node);
                      const hasAnnotation =
                        annotation != null &&
                        typeof annotation !== "boolean" &&
                        annotation !== "";
                      const annotationId = `${instanceId}-annotation-${items.indexOf(item)}`;
                      return (
                        <article
                          key={item.key}
                          className={styles.node}
                          data-change={node?.change ?? "unknown"}
                          data-group={!!item.group || undefined}
                          data-selected={selected || undefined}
                          data-graph-item-card={item.key}
                          data-graph-resource-card={node?.id}
                          data-graph-layout-height={item.height}
                          style={{
                            left: rem(item.x),
                            top: rem(item.y),
                            width: rem(item.width),
                            height: node ? undefined : rem(item.height),
                          }}
                        >
                          <button
                            type="button"
                            className={styles.nodeSelect}
                            data-graph-node={node?.id}
                            data-graph-item={item.key}
                            aria-pressed={selected}
                            aria-describedby={
                              hasAnnotation ? annotationId : undefined
                            }
                            aria-label={
                              node
                                ? `${label}, ${dependencyChangeLabels[node.change ?? "unknown"]}${node.description ? `, ${node.description}` : ""}${node.iconLabel ? `, ${node.iconLabel}` : ""}`
                                : `${label}, ${item.members.length} resources, ${changed} changed`
                            }
                            onKeyDown={(event) => navigate(event, item)}
                            onClick={() =>
                              select({
                                type: node ? "node" : "group",
                                id: node?.id ?? item.group!.id,
                              })
                            }
                          >
                            <span className={styles.nodeTop}>
                              {node?.icon && (
                                <span className={styles.resourceIcon}>
                                  <Icon symbol={node.icon} size="sm" />
                                </span>
                              )}
                              {node && (
                                <strong className={styles.nodeLabel}>
                                  {label}
                                </strong>
                              )}
                              {node ? (
                                <span
                                  className={styles.change}
                                  data-change={node.change ?? "unknown"}
                                  title={
                                    dependencyChangeLabels[
                                      node.change ?? "unknown"
                                    ]
                                  }
                                >
                                  {
                                    (density === "overview"
                                      ? overviewChanges
                                      : dependencyChangeLabels)[
                                      node.change ?? "unknown"
                                    ]
                                  }
                                </span>
                              ) : (
                                <span className={styles.muted}>
                                  {shown === item.members.length
                                    ? shown
                                    : `${shown} of ${item.members.length}`}{" "}
                                  resources · {changed} changed
                                </span>
                              )}
                            </span>
                            {!node && (
                              <strong className={styles.nodeLabel}>
                                {label}
                              </strong>
                            )}
                            {cardDescription && (
                              <span
                                className={styles.nodeDescription}
                                title={cardDescription}
                              >
                                {cardDescription}
                              </span>
                            )}
                          </button>
                          {hasAnnotation && (
                            <div
                              id={annotationId}
                              className={styles.nodeAnnotation}
                              data-graph-node-annotation
                            >
                              {annotation}
                            </div>
                          )}
                          {node &&
                            (hasDependencyGraphChanges(node) ||
                              dependents > 0) && (
                              <div className={styles.cardControls}>
                                {hasDependencyGraphChanges(node) && (
                                  <span className={styles.controlPair}>
                                    <ExpandButton
                                      accessibilityLabel={`${diffShown ? "Hide" : "Show"} attribute differences for ${label}`}
                                      expanded={diffShown}
                                      aria-controls={`${instanceId}-diff-${items.indexOf(item)}`}
                                      onPress={(event) => {
                                        const reveal =
                                          !diffShown && zoom < 1
                                            ? event.target.closest<HTMLElement>(
                                                "[data-graph-resource-card]",
                                              )
                                            : null;
                                        if (!diffShown && zoom < 1) setZoom(1);
                                        changeExpandedChanges(
                                          diffShown
                                            ? expandedChanges.filter(
                                                (id) => id !== node.id,
                                              )
                                            : expandedChanges.includes(node.id)
                                              ? expandedChanges
                                              : [...expandedChanges, node.id],
                                        );
                                        if (reveal)
                                          requestAnimationFrame(() =>
                                            requestAnimationFrame(() => {
                                              if (reveal.isConnected)
                                                reveal.scrollIntoView({
                                                  block: "nearest",
                                                  inline: "nearest",
                                                });
                                            }),
                                          );
                                      }}
                                    />
                                    <span className={styles.controlCaption}>
                                      {node.changes?.length
                                        ? `${node.changes.length} ${node.changes.length === 1 ? "field" : "fields"}`
                                        : "Changes"}
                                    </span>
                                  </span>
                                )}
                                {dependents > 0 && (
                                  <span className={styles.controlPair}>
                                    <CollapseButton
                                      accessibilityLabel={`${branchCollapsed ? "Expand" : "Collapse"} dependents of ${label}`}
                                      expanded={!branchCollapsed}
                                      aria-controls={`${instanceId}-canvas`}
                                      onPress={() =>
                                        changeCollapsedNodes(
                                          branchCollapsed
                                            ? collapsedNodes.filter(
                                                (id) => id !== node.id,
                                              )
                                            : [...collapsedNodes, node.id],
                                        )
                                      }
                                    />
                                    <span className={styles.controlCaption}>
                                      {branchCollapsed
                                        ? `${branches.hiddenCounts.get(node.id) ?? 0} hidden`
                                        : `${dependents} ${dependents === 1 ? "branch" : "branches"}`}
                                    </span>
                                  </span>
                                )}
                              </div>
                            )}
                          {node && hasDependencyGraphChanges(node) && (
                            <div
                              id={`${instanceId}-diff-${items.indexOf(item)}`}
                              hidden={!diffShown}
                              className={styles.nodeChanges}
                              data-graph-card-diff={node.id}
                            >
                              {diffShown && (
                                <DependencyGraphChanges
                                  node={node}
                                  presentation="diff"
                                  showPresentationControls={false}
                                  compact
                                  renderAttributeAnnotation={
                                    renderAttributeAnnotation
                                  }
                                />
                              )}
                            </div>
                          )}
                          {item.group && (
                            <div className={styles.groupExpand}>
                              <ExpandButton
                                accessibilityLabel={`Expand ${label}`}
                                aria-controls={`${instanceId}-canvas`}
                                onPress={() =>
                                  changeCollapsed(
                                    collapsed.filter(
                                      (id) => id !== item.group!.id,
                                    ),
                                  )
                                }
                              />
                              <span>Expand group</span>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className={styles.canvasFooter}>
                <span>
                  {visible.size} of {nodes.length} resources
                </span>
                <span>
                  Dependency <span aria-hidden="true">→</span> dependent
                </span>
                <span>
                  {density === "overview"
                    ? "Overview"
                    : density === "summary"
                      ? "Summaries"
                      : "Attribute detail"}{" "}
                  · Scroll to explore · Ctrl/⌘ + scroll to zoom
                </span>
              </div>
            </>
          )}
          {selectedNode &&
            (!visible.has(selectedNode.id) ||
              (selectedNode.groupId &&
                collapsed.includes(selectedNode.groupId))) && (
              <button
                type="button"
                className={styles.textButton}
                onClick={() => showNode(selectedNode.id)}
              >
                Reveal selected resource
              </button>
            )}
        </div>
        {showDetails && (
          <DependencyGraphDetails
            nodes={nodes}
            edges={edges}
            groups={groups}
            selection={selection}
            onSelectionChange={select}
            renderDetails={renderDetails}
            renderAttributeAnnotation={renderAttributeAnnotation}
            defaultChangePresentation={defaultChangePresentation}
            expanded={detailsExpanded}
            onExpandedChange={changeDetailsExpanded}
          />
        )}
      </div>
    </section>
  );
}
