import React, { useId } from "react";
import { ExpandButton } from "../ExpandButton";
import type {
  DependencyGraphDetailsContext,
  DependencyGraphChangePresentation,
  DependencyGraphEdge,
  DependencyGraphGroup,
  DependencyGraphNode,
  DependencyGraphProps,
  DependencyGraphSelection,
} from "./types";
import { dependencyChangeLabels } from "./model";
import { DependencyGraphChanges } from "./DependencyGraphChanges";
import { DependencyGraphCategories } from "./DependencyGraphCategories";
import styles from "./DependencyGraph.module.scss";
import { dependencyGroupHierarchy } from "./groups";

export type DependencyGraphDetailsProps = {
  nodes: readonly DependencyGraphNode[];
  edges: readonly DependencyGraphEdge[];
  groups?: readonly DependencyGraphGroup[];
  selection: DependencyGraphSelection;
  onSelectionChange: (selection: DependencyGraphSelection) => void;
  renderDetails?: DependencyGraphProps["renderDetails"];
  renderAttributeAnnotation?: DependencyGraphProps["renderAttributeAnnotation"];
  defaultChangePresentation?: DependencyGraphChangePresentation;
  /** Inline details fill their row without a separate scrolling sidebar. */
  placement?: "sidebar" | "inline";
  /** Optional size control for an application-owned inspector layout. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export function dependencyGraphDetailsContext({
  nodes,
  edges,
  groups = [],
  selection,
}: Omit<
  DependencyGraphDetailsProps,
  "onSelectionChange"
>): DependencyGraphDetailsContext {
  const node =
    selection?.type === "node"
      ? nodes.find((record) => record.id === selection.id)
      : undefined;
  const group =
    selection?.type === "group"
      ? groups.find((record) => record.id === selection.id)
      : undefined;
  const members = new Set(
    group
      ? (
          dependencyGroupHierarchy(nodes, groups).members.get(group.id) ?? []
        ).map((record) => record.id)
      : [],
  );
  const relationships = edges.filter((edge) =>
    node
      ? edge.source === node.id || edge.target === node.id
      : group
        ? members.has(edge.source) || members.has(edge.target)
        : selection?.type === "edge"
          ? edge.id === selection.id
          : selection?.type === "edges"
            ? selection.ids.includes(edge.id)
            : false,
  );
  return { selection, node, group, edges: relationships };
}

/** Can live beside an application-owned inspector using the same controlled selection. */
export function DependencyGraphDetails(props: DependencyGraphDetailsProps) {
  const {
    selection,
    nodes,
    groups = [],
    onSelectionChange,
    renderDetails,
  } = props;
  const contentId = useId();
  const context = dependencyGraphDetailsContext(props);
  const records = new Map(nodes.map((node) => [node.id, node]));
  const title =
    context.node?.label ??
    context.group?.label ??
    (context.edges.length === 1
      ? (context.edges[0].label ?? "Relationship")
      : "Relationships");
  const found = context.node || context.group || context.edges.length;
  const inline = props.placement === "inline";
  const Container = inline ? "section" : "aside";
  return (
    <Container
      className={styles.details}
      aria-label={inline ? `Details for ${title}` : "Graph selection details"}
      data-graph-details
      data-placement={props.placement}
      data-expanded={props.expanded || undefined}
    >
      <div className={styles.detailHeading}>
        <h3>{selection && found ? title : "Selection"}</h3>
        <div className={styles.detailActions}>
          {selection && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => onSelectionChange(null)}
              aria-label={
                inline ? `Close details for ${title}` : "Clear graph selection"
              }
            >
              {inline ? "Close" : "Clear"}
            </button>
          )}
          {props.onExpandedChange && (
            <ExpandButton
              expanded={props.expanded}
              accessibilityLabel={`${props.expanded ? "Collapse" : "Expand"} selection details`}
              aria-controls={contentId}
              onPress={() => props.onExpandedChange?.(!props.expanded)}
            />
          )}
        </div>
      </div>
      <div id={contentId}>
        {!selection ? (
          <p className={styles.muted}>
            Select a resource or relationship to inspect it.
          </p>
        ) : !found ? (
          <p role="status">
            The selected record is unavailable in the supplied graph.
          </p>
        ) : (
          <div className={styles.detailContent}>
            <div className={styles.detailPrimary}>
              {context.node && (
                <>
                  {context.node.kind === "unresolved" && (
                    <p className={styles.referenceLabel}>
                      Unresolved reference
                    </p>
                  )}
                  {context.node.typeLabel && (
                    <p className={styles.detailDescription}>
                      {context.node.typeLabel}
                    </p>
                  )}
                  <div className={styles.nodeMetadata}>
                    <span
                      className={
                        context.node.change ? styles.change : styles.muted
                      }
                      data-change={context.node.change}
                    >
                      {context.node.change
                        ? dependencyChangeLabels[context.node.change]
                        : "Change not supplied"}
                    </span>
                    <DependencyGraphCategories
                      categories={context.node.categories}
                    />
                  </div>
                  {context.node.description && (
                    <p className={styles.detailDescription}>
                      {context.node.description}
                    </p>
                  )}
                  <code className={styles.identifier}>
                    {context.node.address ?? context.node.id}
                  </code>
                  {context.node.address &&
                    context.node.address !== context.node.id && (
                      <span className={styles.identifier}>
                        Record ID: {context.node.id}
                      </span>
                    )}
                  <DependencyGraphChanges
                    key={context.node.id}
                    node={context.node}
                    defaultPresentation={props.defaultChangePresentation}
                    renderAttributeAnnotation={props.renderAttributeAnnotation}
                  />
                </>
              )}
              {context.group?.description && (
                <p className={styles.detailDescription}>
                  {context.group.description}
                </p>
              )}
              {context.group && (
                <div className={styles.members}>
                  {(
                    dependencyGroupHierarchy(nodes, groups).members.get(
                      context.group.id,
                    ) ?? []
                  ).map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className={styles.relationship}
                      onClick={() =>
                        onSelectionChange({ type: "node", id: node.id })
                      }
                    >
                      <strong>{node.label}</strong>
                      <span>
                        {node.change
                          ? dependencyChangeLabels[node.change]
                          : "Change not supplied"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {renderDetails?.(context)}
            </div>
            <div className={styles.detailRelationships}>
              <h4>
                {context.node || context.group
                  ? "Connected relationships"
                  : "Selected relationships"}{" "}
                <span className={styles.muted}>({context.edges.length})</span>
              </h4>
              {!context.edges.length && (
                <p className={styles.muted}>
                  No relationships supplied for this selection.
                </p>
              )}
              <ul className={styles.relationships}>
                {context.edges.map((edge) => {
                  const source = records.get(edge.source);
                  const target = records.get(edge.target);
                  const current =
                    selection.type === "edge" && selection.id === edge.id;
                  return (
                    <li key={edge.id}>
                      <button
                        type="button"
                        className={styles.relationship}
                        data-link-change={edge.change}
                        aria-pressed={current}
                        onClick={() =>
                          onSelectionChange({ type: "edge", id: edge.id })
                        }
                      >
                        <span>
                          {source?.label ?? edge.source}
                          {edge.sourceAttributePath !== undefined && (
                            <code> · {edge.sourceAttributePath}</code>
                          )}{" "}
                          <span aria-hidden="true">→</span>
                          <span className={styles.visuallyHidden}>
                            {" "}
                            is a dependency of{" "}
                          </span>{" "}
                          {target?.label ?? edge.target}
                          {edge.targetAttributePath !== undefined && (
                            <code> · {edge.targetAttributePath}</code>
                          )}
                        </span>
                        <strong>{edge.label ?? "Dependency"}</strong>
                        <span
                          className={styles.linkChange}
                          data-link-change={edge.change ?? "unknown"}
                        >
                          {edge.change === "add"
                            ? "Added relationship"
                            : edge.change === "remove"
                              ? "Removed relationship"
                              : edge.change === "update"
                                ? "Modified relationship"
                                : edge.change === "unchanged"
                                  ? "Unchanged relationship"
                                  : "Relationship change unknown"}
                        </span>
                      </button>
                      {(!source || !target) && (
                        <span className={styles.unavailable}>
                          Endpoint unavailable in supplied resources
                        </span>
                      )}
                      {edge.description &&
                        (selection.type === "edge" ||
                          selection.type === "edges") && (
                          <p className={styles.edgeDescription}>
                            {edge.description}
                          </p>
                        )}
                      {(selection.type === "edge" ||
                        selection.type === "edges") && (
                        <div className={styles.endpointActions}>
                          {source && (
                            <button
                              type="button"
                              className={styles.textButton}
                              onClick={() =>
                                onSelectionChange({
                                  type: "node",
                                  id: source.id,
                                })
                              }
                            >
                              Inspect dependency
                            </button>
                          )}
                          {target && (
                            <button
                              type="button"
                              className={styles.textButton}
                              onClick={() =>
                                onSelectionChange({
                                  type: "node",
                                  id: target.id,
                                })
                              }
                            >
                              Inspect dependent
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
