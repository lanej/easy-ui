import React, { useRef, useState } from "react";
import ChevronRightIcon from "@easypost/easy-ui-icons/ChevronRight400";
import {
  Button as AriaButton,
  Tree,
  TreeItem,
  TreeItemContent,
} from "react-aria-components";
import { Icon } from "../Icon";
import { DependencyGraphChanges } from "./DependencyGraphChanges";
import { dependencyGraphAppearanceStyle } from "./appearance";
import { DependencyGraphDetails } from "./DependencyGraphDetails";
import {
  DependencyGraphCategories,
  dependencyGraphCategoryLabels,
} from "./DependencyGraphCategories";
import { dependencyChangeLabels, hasDependencyGraphChanges } from "./model";
import type { DependencyGraphProps, DependencyGraphSelection } from "./types";
import { dependencyTreeAncestors } from "./tree";
import type { DependencyTreeEntry, DependencyTreeModel } from "./tree";
import graphStyles from "./DependencyGraph.module.scss";
import styles from "./DependencyGraphTree.module.scss";

type Props = Pick<
  DependencyGraphProps,
  | "renderNodeAnnotation"
  | "renderAttributeAnnotation"
  | "renderDetails"
  | "renderDetailsMode"
  | "nodes"
  | "edges"
  | "groups"
  | "showDetails"
  | "defaultChangePresentation"
> & {
  tree: DependencyTreeModel;
  selection: DependencyGraphSelection;
  onSelect: (selection: DependencyGraphSelection) => void;
  collapsedGroups: readonly string[];
  collapsedNodes: readonly string[];
  onCollapsedGroupsChange: (ids: readonly string[]) => void;
  onCollapsedNodesChange: (ids: readonly string[]) => void;
  expandedChanges: readonly string[];
  onExpandedChangesChange: (ids: readonly string[]) => void;
  onReveal: (id: string) => void;
  instanceId: string;
};

/** Compact treegrid with React Aria's roving focus, typeahead, and disclosure keys. */
export function DependencyGraphTree({
  tree,
  selection,
  onSelect,
  collapsedGroups,
  collapsedNodes,
  onCollapsedGroupsChange,
  onCollapsedNodesChange,
  expandedChanges,
  onExpandedChangesChange,
  onReveal,
  instanceId,
  renderNodeAnnotation,
  renderAttributeAnnotation,
  renderDetails,
  renderDetailsMode,
  nodes,
  edges,
  groups,
  showDetails,
  defaultChangePresentation,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [relationshipOwner, setRelationshipOwner] = useState<{
    key: string;
    ids: readonly string[];
  }>();
  const branches = [...tree.entries.values()].filter(
    (entry) => entry.children.length,
  );
  const expandedKeys = branches
    .filter((entry) =>
      entry.group
        ? !collapsedGroups.includes(entry.group.id)
        : !collapsedNodes.includes(entry.node!.id),
    )
    .map((entry) => entry.key);
  const resourceKey =
    selection?.type === "node" || selection?.type === "group"
      ? `${selection.type}:${selection.id}`
      : undefined;
  const visibleKeys = new Set<string>();
  const expandedSet = new Set(expandedKeys);
  const pending = [...tree.roots];
  while (pending.length) {
    const entry = pending.pop()!;
    visibleKeys.add(entry.key);
    if (expandedSet.has(entry.key)) pending.push(...entry.children);
  }
  const selectedEdgeIds =
    selection?.type === "edge"
      ? [selection.id]
      : selection?.type === "edges"
        ? selection.ids
        : [];
  const selectedEdges = edges.filter((edge) =>
    selectedEdgeIds.includes(edge.id),
  );
  const endpoints = selectedEdges
    .flatMap((edge) => [edge.source, edge.target])
    .map((id) => `node:${id}`);
  const currentOwner =
    relationshipOwner &&
    relationshipOwner.ids.length === selectedEdgeIds.length &&
    relationshipOwner.ids.every((id) => selectedEdgeIds.includes(id)) &&
    visibleKeys.has(relationshipOwner.key)
      ? relationshipOwner.key
      : undefined;
  const selectedKey =
    resourceKey ??
    (selectedEdges.length
      ? (currentOwner ??
        endpoints.find((key) => visibleKeys.has(key)) ??
        endpoints
          .flatMap((key) => dependencyTreeAncestors(tree, key).reverse())
          .find((entry) => visibleKeys.has(entry.key))?.key)
      : undefined);
  const restoreRowFocus = (key: string) => {
    requestAnimationFrame(() => {
      const row = [
        ...(root.current?.querySelectorAll<HTMLElement>("[data-tree-key]") ??
          []),
      ].find((element) => element.dataset.treeKey === key);
      (
        row?.querySelector<HTMLElement>("[data-tree-row-header]") ?? row
      )?.scrollIntoView({ block: "nearest", inline: "nearest" });
      row?.focus({ preventScroll: true });
    });
  };
  const details = (ownerKey?: string) => (
    <DependencyGraphDetails
      nodes={nodes}
      edges={edges}
      groups={groups}
      selection={selection}
      onSelectionChange={(next) => {
        if (next?.type === "node") onReveal(next.id);
        else {
          if (ownerKey && (next?.type === "edge" || next?.type === "edges"))
            setRelationshipOwner({
              key: ownerKey,
              ids: next.type === "edges" ? next.ids : [next.id],
            });
          onSelect(next);
          if (!next) restoreRowFocus(ownerKey ?? tree.roots[0]?.key);
        }
      }}
      placement="inline"
      summaryInRow={
        !!ownerKey && ownerKey === resourceKey && visibleKeys.has(ownerKey)
      }
      renderDetails={renderDetails}
      renderDetailsMode={renderDetailsMode}
      renderAttributeAnnotation={renderAttributeAnnotation}
      defaultChangePresentation={defaultChangePresentation}
    />
  );
  // The inspector contains native and caller-owned controls. Their interactions
  // must not bubble into the treegrid's row selection or arrow-key navigation.
  const drawerEvents = {
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
    onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
    onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation(),
  };

  const renderEntry = (
    entry: DependencyTreeEntry,
    children: React.ReactNode[],
  ): React.ReactNode => {
    const { node, group, reference } = entry;
    const label = node?.label ?? group!.label;
    const changed = node && hasDependencyGraphChanges(node);
    const diffShown = !!node && expandedChanges.includes(node.id);
    const detailsShown =
      !!showDetails && !reference && selectedKey === entry.key;
    const descendants = entry.resourceCount - (node && !reference ? 1 : 0);
    const descendantChanges =
      entry.changedCount - (changed && !reference ? 1 : 0);
    const annotation = node && !reference && renderNodeAnnotation?.(node);
    const hasAnnotation =
      annotation != null &&
      typeof annotation !== "boolean" &&
      annotation !== "";
    const detailId = `${instanceId}-tree-diff-${encodeURIComponent(entry.key)}`;
    const drawerId = `${instanceId}-tree-details-${encodeURIComponent(entry.key)}`;
    const annotationId = `${instanceId}-tree-annotation-${encodeURIComponent(entry.key)}`;
    const contentShown = showDetails ? detailsShown : diffShown;
    const contentId = showDetails ? drawerId : detailId;
    const contentLabel = `${contentShown ? "Hide" : "Show"} ${showDetails ? "details" : "attribute differences"} for ${label}`;
    const toggleContent = () => {
      if (showDetails) {
        onSelect(
          detailsShown
            ? null
            : { type: node ? "node" : "group", id: node?.id ?? group!.id },
        );
        if (detailsShown) restoreRowFocus(entry.key);
      } else if (node) {
        onExpandedChangesChange(
          diffShown
            ? expandedChanges.filter((id) => id !== node.id)
            : [...expandedChanges, node.id],
        );
      }
    };
    const fieldCount = node?.changes?.length
      ? `${node.changes.length} ${node.changes.length === 1 ? "field" : "fields"}`
      : "Changes";
    const accessibleName = [
      label,
      node?.iconLabel,
      node?.typeLabel,
      node?.kind === "unresolved" ? "Unresolved" : null,
      node?.change ? dependencyChangeLabels[node.change] : null,
      ...dependencyGraphCategoryLabels(node?.categories),
      descendants > 0
        ? `${descendants} ${group ? "resources" : "below"}${descendantChanges ? `, ${descendantChanges} changed` : ""}`
        : null,
      reference === "cycle"
        ? "Cycle reference"
        : reference
          ? "Shared reference"
          : null,
    ]
      .filter(Boolean)
      .join(", ");
    return (
      <TreeItem
        key={entry.key}
        id={entry.key}
        textValue={label}
        aria-label={accessibleName}
        aria-describedby={hasAnnotation ? annotationId : undefined}
        className={styles.item}
        data-custom-outline={!!node?.appearance?.borderColor || undefined}
        style={({ level }) =>
          ({
            ...dependencyGraphAppearanceStyle(node?.appearance),
            "--tree-depth": level - 1,
          }) as React.CSSProperties
        }
        data-tree-node={reference ? undefined : node?.id}
        data-tree-group={group?.id}
        data-tree-reference={reference ? node?.id : undefined}
        data-tree-key={entry.key}
        data-details-open={detailsShown || undefined}
        onAction={reference ? () => onReveal(node!.id) : undefined}
      >
        <TreeItemContent>
          {({ isExpanded, hasChildItems }) => (
            <>
              <div className={styles.row} data-tree-row-header>
                {hasChildItems ? (
                  <AriaButton
                    slot="chevron"
                    className={styles.disclosure}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    data-expanded={isExpanded || undefined}
                  >
                    <Icon symbol={ChevronRightIcon} size="sm" />
                  </AriaButton>
                ) : !reference && (showDetails || changed) ? (
                  <AriaButton
                    className={styles.disclosure}
                    aria-label={contentLabel}
                    aria-controls={contentId}
                    aria-expanded={contentShown}
                    data-expanded={contentShown || undefined}
                    onPress={toggleContent}
                  >
                    <Icon symbol={ChevronRightIcon} size="sm" />
                  </AriaButton>
                ) : (
                  <span className={styles.spacer} aria-hidden="true">
                    {reference ? "↪" : ""}
                  </span>
                )}
                {node?.icon && <Icon symbol={node.icon} size="sm" />}
                <span
                  className={styles.identity}
                  title={
                    node?.address ??
                    node?.description ??
                    group?.description ??
                    label
                  }
                >
                  <strong className={styles.label} title={label}>
                    {label}
                  </strong>
                  {node?.typeLabel && (
                    <span className={styles.type} title={node.typeLabel}>
                      {node.typeLabel}
                    </span>
                  )}
                </span>
                <div className={styles.metadata}>
                  {node?.kind === "unresolved" && (
                    <span className={graphStyles.referenceLabel}>
                      Unresolved
                    </span>
                  )}
                  {node?.change && (
                    <span
                      className={graphStyles.change}
                      data-change={node.change}
                    >
                      {dependencyChangeLabels[node.change]}
                    </span>
                  )}
                  <DependencyGraphCategories categories={node?.categories} />
                  {descendants > 0 && (
                    <span className={styles.count}>
                      {descendants} {group ? "resources" : "below"}
                      {descendantChanges > 0 &&
                        ` · ${descendantChanges} changed`}
                    </span>
                  )}
                  {hasAnnotation && (
                    <div id={annotationId} data-graph-node-annotation>
                      {annotation}
                    </div>
                  )}
                  {reference && (
                    <AriaButton
                      className={styles.reference}
                      onPress={() => onReveal(node!.id)}
                      aria-label={`Reveal primary row for ${label}`}
                    >
                      {reference === "cycle" ? "Cycle" : "Reference"}{" "}
                      <span aria-hidden="true">↗</span>
                    </AriaButton>
                  )}
                  {showDetails && !reference && !!node?.changes?.length && (
                    <span className={styles.fields}>{fieldCount}</span>
                  )}
                  {!showDetails &&
                    node &&
                    changed &&
                    !reference &&
                    (hasChildItems ? (
                      <AriaButton
                        className={styles.reference}
                        aria-label={contentLabel}
                        aria-controls={contentId}
                        aria-expanded={contentShown}
                        onPress={toggleContent}
                      >
                        {fieldCount}
                      </AriaButton>
                    ) : (
                      <span className={styles.fields}>{fieldCount}</span>
                    ))}
                </div>
              </div>
              {showDetails && !reference && (
                <div
                  id={drawerId}
                  hidden={!detailsShown}
                  className={styles.drawer}
                  data-tree-drawer={entry.key}
                  {...drawerEvents}
                >
                  {detailsShown && details(entry.key)}
                </div>
              )}
              {!showDetails && node && changed && !reference && (
                <div id={detailId} hidden={!diffShown} className={styles.diff}>
                  {diffShown && (
                    <DependencyGraphChanges
                      node={node}
                      presentation="diff"
                      showPresentationControls={false}
                      compact
                      renderAttributeAnnotation={renderAttributeAnnotation}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </TreeItemContent>
        {children}
      </TreeItem>
    );
  };

  // Build bottom-up instead of recursively walking long dependency chains.
  const rendered = new Map<string, React.ReactNode>();
  for (const entry of [...tree.entries.values()].reverse())
    rendered.set(
      entry.key,
      renderEntry(
        entry,
        entry.children.map((child) => rendered.get(child.key)),
      ),
    );

  return (
    <>
      <Tree
        ref={root}
        aria-label="Resource tree"
        className={styles.tree}
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={
          selectedKey && tree.entries.has(selectedKey) ? [selectedKey] : []
        }
        onSelectionChange={(keys) => {
          if (keys === "all") return;
          const key = [...keys][0];
          const entry = tree.entries.get(String(key));
          onSelect(
            entry
              ? {
                  type: entry.node ? "node" : "group",
                  id: entry.node?.id ?? entry.group!.id,
                }
              : null,
          );
        }}
        expandedKeys={expandedKeys}
        onExpandedChange={(keys) => {
          // Update only branches represented in this scope. Hidden child folds survive.
          const nextGroups = new Set(collapsedGroups);
          const nextNodes = new Set(collapsedNodes);
          for (const entry of branches) {
            const ids = entry.group ? nextGroups : nextNodes;
            const id = entry.group?.id ?? entry.node!.id;
            if (keys.has(entry.key)) ids.delete(id);
            else ids.add(id);
          }
          if ([...nextGroups].join("\0") !== collapsedGroups.join("\0"))
            onCollapsedGroupsChange([...nextGroups]);
          if ([...nextNodes].join("\0") !== collapsedNodes.join("\0"))
            onCollapsedNodesChange([...nextNodes]);
        }}
      >
        {tree.roots.map((entry) => rendered.get(entry.key))}
      </Tree>
      {showDetails &&
        selection &&
        (!selectedKey || !visibleKeys.has(selectedKey)) && (
          <div className={styles.drawer} {...drawerEvents}>
            {details()}
          </div>
        )}
    </>
  );
}
