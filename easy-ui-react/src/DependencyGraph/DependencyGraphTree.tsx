import React from "react";
import ChevronRightIcon from "@easypost/easy-ui-icons/ChevronRight400";
import {
  Button as AriaButton,
  Tree,
  TreeItem,
  TreeItemContent,
} from "react-aria-components";
import { Icon } from "../Icon";
import { ExpandButton } from "../ExpandButton";
import { DependencyGraphChanges } from "./DependencyGraphChanges";
import {
  DependencyGraphCategories,
  dependencyGraphCategoryLabels,
} from "./DependencyGraphCategories";
import { dependencyChangeLabels, hasDependencyGraphChanges } from "./model";
import type { DependencyGraphProps, DependencyGraphSelection } from "./types";
import type { DependencyTreeEntry, DependencyTreeModel } from "./tree";
import graphStyles from "./DependencyGraph.module.scss";
import styles from "./DependencyGraphTree.module.scss";

type Props = Pick<
  DependencyGraphProps,
  "renderNodeAnnotation" | "renderAttributeAnnotation"
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
}: Props) {
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
  const selectedKey =
    selection?.type === "node" || selection?.type === "group"
      ? `${selection.type}:${selection.id}`
      : undefined;

  const renderEntry = (
    entry: DependencyTreeEntry,
    children: React.ReactNode[],
  ): React.ReactNode => {
    const { node, group, reference } = entry;
    const label = node?.label ?? group!.label;
    const changed = node && hasDependencyGraphChanges(node);
    const diffShown = !!node && expandedChanges.includes(node.id);
    const descendants = entry.resourceCount - (node && !reference ? 1 : 0);
    const descendantChanges =
      entry.changedCount - (changed && !reference ? 1 : 0);
    const annotation = node && !reference && renderNodeAnnotation?.(node);
    const hasAnnotation =
      annotation != null &&
      typeof annotation !== "boolean" &&
      annotation !== "";
    const detailId = `${instanceId}-tree-diff-${encodeURIComponent(entry.key)}`;
    const annotationId = `${instanceId}-tree-annotation-${encodeURIComponent(entry.key)}`;
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
        style={({ level }) =>
          ({ "--tree-depth": level - 1 }) as React.CSSProperties
        }
        data-tree-node={reference ? undefined : node?.id}
        data-tree-group={group?.id}
        data-tree-reference={reference ? node?.id : undefined}
        onAction={reference ? () => onReveal(node!.id) : undefined}
      >
        <TreeItemContent>
          {({ isExpanded, hasChildItems }) => (
            <>
              <div className={styles.row}>
                {hasChildItems ? (
                  <AriaButton
                    slot="chevron"
                    className={styles.disclosure}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    data-expanded={isExpanded || undefined}
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
                  <strong className={styles.label}>{label}</strong>
                  {node?.typeLabel && (
                    <span className={styles.type}>{node.typeLabel}</span>
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
                  {node && changed && !reference && (
                    <span className={styles.fields}>
                      <ExpandButton
                        expanded={diffShown}
                        accessibilityLabel={`${diffShown ? "Hide" : "Show"} attribute differences for ${label}`}
                        aria-controls={detailId}
                        onPress={() =>
                          onExpandedChangesChange(
                            diffShown
                              ? expandedChanges.filter((id) => id !== node.id)
                              : [...expandedChanges, node.id],
                          )
                        }
                      />
                      <span>
                        {node.changes?.length
                          ? `${node.changes.length} ${node.changes.length === 1 ? "field" : "fields"}`
                          : "Changes"}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              {node && changed && !reference && (
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
    <Tree
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
  );
}
