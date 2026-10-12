import React, { useEffect, useMemo, useRef, useState } from "react";
import { useId } from "react-aria";
import { Button } from "../Button";
import { Select } from "../Select";
import { TextField } from "../TextField";
import { DependencyGraphDetails } from "./DependencyGraphDetails";
import { DependencyGraphChanges } from "./DependencyGraphChanges";
import {
  buildDependencyGraph,
  dependencyChangeLabels,
  hasDependencyGraphChanges,
  visibleDependencyNodes,
} from "./model";
import type { GraphItem } from "./model";
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
  expandedChangeNodeIds: controlledExpandedChanges,
  defaultExpandedChangeNodeIds = [],
  onExpandedChangeNodeIdsChange,
  highlightedEdgeIds = [],
  coverage,
  status = "ready",
  message,
  onRetry,
  height = 480,
  showDetails = true,
  defaultChangePresentation,
  renderDetails,
}: DependencyGraphProps) {
  const [localSelection, setLocalSelection] = useState(defaultSelection);
  const [localView, setLocalView] = useState(defaultView);
  const [localCollapsed, setLocalCollapsed] = useState(
    defaultCollapsedGroupIds,
  );
  const [query, setQuery] = useState("");
  const [localExpandedChanges, setLocalExpandedChanges] = useState(
    defaultExpandedChangeNodeIds,
  );
  const [nodeHeights, setNodeHeights] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const firstFit = useRef(false);
  const instanceId = useId().replace(/:/g, "");
  const selection =
    controlledSelection === undefined ? localSelection : controlledSelection;
  const view = controlledView ?? localView;
  const collapsed = controlledCollapsed ?? localCollapsed;
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
  // Selection/search never participate in layout. Local exploration preserves coordinates.
  const model = useMemo(
    () =>
      duplicate
        ? null
        : buildDependencyGraph(nodes, edges, groups, collapsed, nodeHeights),
    [nodes, edges, groups, collapsed, duplicate, nodeHeights],
  );
  const visible = useMemo(
    () => visibleDependencyNodes(nodes, edges, view),
    [nodes, edges, view],
  );
  const items =
    model?.items.filter((item) =>
      item.members.some((node) => visible.has(node.id)),
    ) ?? [];
  const renderedNodeIds = items
    .filter((item) => item.node)
    .map((item) => item.node!.id)
    .join("\0");
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
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
    });
    viewport.current
      ?.querySelectorAll("[data-graph-resource-card]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [renderedNodeIds, status, duplicate]);
  const clusters = (model?.clusters ?? []).flatMap((cluster) => {
    const members = items.filter(
      (item) => item.node?.groupId === cluster.group.id,
    );
    if (!members.length) return [];
    const x = Math.min(...members.map((item) => item.x)) - 16;
    const y = Math.min(...members.map((item) => item.y)) - 44;
    return [
      {
        ...cluster,
        x,
        y,
        width: Math.max(...members.map((item) => item.x + item.width)) - x + 16,
        height:
          Math.max(...members.map((item) => item.y + item.height)) - y + 16,
      },
    ];
  });
  const connections =
    model?.connections
      .map((connection) => ({
        ...connection,
        edges: connection.edges.filter(
          (edge) => visible.has(edge.source) && visible.has(edge.target),
        ),
      }))
      .filter((connection) => connection.edges.length) ?? [];
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
  const fit = () => {
    const element = viewport.current;
    if (!element || !items.length) return;
    const rootSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    const unit =
      (Number.isFinite(rootSize) && rootSize > 0 ? rootSize : 16) / 16;
    const boxes = [...items, ...clusters];
    const x = Math.min(...boxes.map((item) => item.x));
    const y = Math.min(...boxes.map((item) => item.y));
    const right = Math.max(...boxes.map((item) => item.x + item.width));
    const bottom = Math.max(...boxes.map((item) => item.y + item.height));
    // Keep labels readable: large neighborhoods scroll instead of shrinking to a hairball.
    const scale = Math.max(
      element.clientWidth < 600 ||
        items.some(
          (item) => item.node && expandedChanges.includes(item.node.id),
        )
        ? 1
        : 0.75,
      Math.min(
        1,
        (element.clientWidth - 48) / ((right - x) * unit),
        (element.clientHeight - 48) / ((bottom - y) * unit),
      ),
    );
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
      fit();
    }
  });
  const showNode = (id: string) => {
    const node = nodes.find((record) => record.id === id);
    if (!node) return;
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
    <section className={styles.root} data-dependency-graph aria-label={title}>
      <header className={styles.heading}>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <span className={styles.count}>
          {visible.size} of {nodes.length} resources
        </span>
      </header>
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
        <div className={styles.cameraControls}>
          <Button
            size="sm"
            variant="text"
            color="primary"
            aria-label="Zoom out graph"
            isDisabled={zoom <= 0.75}
            onPress={() => setZoom((value) => Math.max(0.75, value - 0.15))}
          >
            −
          </Button>
          <output aria-label="Graph zoom">{Math.round(zoom * 100)}%</output>
          <Button
            size="sm"
            variant="text"
            color="primary"
            aria-label="Zoom in graph"
            isDisabled={zoom >= 1.5}
            onPress={() => setZoom((value) => Math.min(1.5, value + 0.15))}
          >
            +
          </Button>
          <Button size="sm" variant="outlined" color="primary" onPress={fit}>
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
                ref={viewport}
                tabIndex={0}
                aria-label="Dependency graph canvas"
                style={{
                  height: Number.isFinite(height) && height > 0 ? height : 480,
                }}
              >
                <div
                  className={styles.scrollArea}
                  style={{
                    width: rem(model!.width * zoom),
                    height: rem(model!.height * zoom),
                  }}
                >
                  <div
                    className={styles.canvas}
                    style={{
                      width: rem(model!.width),
                      height: rem(model!.height),
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
                          <button
                            type="button"
                            className={styles.textButton}
                            aria-label={`Collapse ${cluster.group.label}`}
                            onClick={() =>
                              changeCollapsed([...collapsed, cluster.group.id])
                            }
                          >
                            Collapse
                          </button>
                        </div>
                      </div>
                    ))}
                    <svg
                      className={styles.edges}
                      viewBox={`0 0 ${model!.width} ${model!.height}`}
                      aria-hidden="true"
                    >
                      <defs>
                        <marker
                          id={`${instanceId}-arrow`}
                          viewBox="0 0 10 10"
                          refX="9"
                          refY="5"
                          markerWidth="7"
                          markerHeight="7"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 0 L 10 5 L 0 10 z" />
                        </marker>
                      </defs>
                      {connections.map((connection) => {
                        const ids = connection.edges.map((edge) => edge.id);
                        const selected = sameEdgeSelection(selection, ids);
                        const midpoint =
                          connection.points[
                            Math.floor(connection.points.length / 2)
                          ];
                        const path = connection.points
                          .map(
                            (point, index) =>
                              `${index ? "L" : "M"} ${point.x} ${point.y}`,
                          )
                          .join(" ");
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
                              markerEnd={`url(#${instanceId}-arrow)`}
                            />
                            <title>
                              {connection.edges
                                .map((edge) => edge.label ?? edge.id)
                                .join("; ")}
                            </title>
                            {ids.length > 1 && midpoint && (
                              <g className={styles.bundleLabel}>
                                <rect
                                  x={midpoint.x - 14}
                                  y={midpoint.y - 12}
                                  width="28"
                                  height="24"
                                  rx="6"
                                />
                                <text
                                  x={midpoint.x}
                                  y={midpoint.y}
                                  dominantBaseline="central"
                                  textAnchor="middle"
                                >
                                  {ids.length}
                                </text>
                              </g>
                            )}
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
                      const shown = item.members.filter((member) =>
                        visible.has(member.id),
                      ).length;
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
                            aria-label={
                              node
                                ? `${label}, ${dependencyChangeLabels[node.change ?? "unknown"]}${node.description ? `, ${node.description}` : ""}`
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
                              {node ? (
                                <span
                                  className={styles.change}
                                  data-change={node.change ?? "unknown"}
                                >
                                  {
                                    dependencyChangeLabels[
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
                            <strong className={styles.nodeLabel}>
                              {label}
                            </strong>
                            <span
                              className={styles.nodeDescription}
                              title={
                                node?.changeSummary ??
                                node?.description ??
                                item.group?.description
                              }
                            >
                              {node?.changeSummary ??
                                node?.description ??
                                item.group?.description ??
                                node?.id}
                            </span>
                          </button>
                          {node && hasDependencyGraphChanges(node) && (
                            <>
                              <button
                                type="button"
                                className={styles.cardExpand}
                                aria-label={`${expandedChanges.includes(node.id) ? "Hide" : "Show"} attribute differences for ${label}`}
                                aria-expanded={expandedChanges.includes(
                                  node.id,
                                )}
                                aria-controls={`${instanceId}-diff-${items.indexOf(item)}`}
                                onClick={() =>
                                  changeExpandedChanges(
                                    expandedChanges.includes(node.id)
                                      ? expandedChanges.filter(
                                          (id) => id !== node.id,
                                        )
                                      : [...expandedChanges, node.id],
                                  )
                                }
                              >
                                {expandedChanges.includes(node.id)
                                  ? "Hide attribute differences"
                                  : "Show attribute differences"}
                              </button>
                              <div
                                id={`${instanceId}-diff-${items.indexOf(item)}`}
                                hidden={!expandedChanges.includes(node.id)}
                                className={styles.nodeChanges}
                                data-graph-card-diff={node.id}
                              >
                                {expandedChanges.includes(node.id) && (
                                  <DependencyGraphChanges
                                    node={node}
                                    presentation="diff"
                                    showPresentationControls={false}
                                  />
                                )}
                              </div>
                            </>
                          )}
                          {item.group && (
                            <button
                              type="button"
                              className={styles.groupExpand}
                              aria-label={`Expand ${label}`}
                              onClick={() =>
                                changeCollapsed(
                                  collapsed.filter(
                                    (id) => id !== item.group!.id,
                                  ),
                                )
                              }
                            >
                              Expand group
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className={styles.canvasFooter}>
                <span>
                  Dependency <span aria-hidden="true">→</span> dependent
                </span>
                <span>
                  Scroll to explore · Arrow keys move between resources
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
            defaultChangePresentation={defaultChangePresentation}
          />
        )}
      </div>
    </section>
  );
}
