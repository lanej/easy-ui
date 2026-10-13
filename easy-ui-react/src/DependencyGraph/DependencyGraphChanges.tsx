import React, { useId, useState } from "react";
import { Button } from "../Button";
import type {
  DependencyGraphChangePresentation,
  DependencyGraphChangeValue,
  DependencyGraphNode,
  DependencyGraphProps,
} from "./types";
import styles from "./DependencyGraph.module.scss";

export type DependencyGraphChangesProps = {
  node: DependencyGraphNode;
  presentation?: DependencyGraphChangePresentation;
  defaultPresentation?: DependencyGraphChangePresentation;
  onPresentationChange?: (
    presentation: DependencyGraphChangePresentation,
  ) => void;
  /** Hide the summary/diff switch when embedding a fixed diff inside a card. */
  showPresentationControls?: boolean;
  /** Omit the heading when embedding inside a resource card. */
  compact?: boolean;
  renderAttributeAnnotation?: DependencyGraphProps["renderAttributeAnnotation"];
};

const summaries = {
  create: "Resource will be added.",
  update: "Resource will be updated.",
  replace: "Resource will be removed and recreated.",
  delete: "Resource will be removed.",
  unchanged: "No resource change planned.",
  unknown: "Resource change is unknown.",
} as const;

const formatValue = (value: DependencyGraphChangeValue) =>
  typeof value === "string"
    ? value === ""
      ? '""'
      : value
    : value.status === "redacted"
      ? "Redacted value"
      : "Unknown value";

function DiffValue({
  kind,
  value,
}: {
  kind: "addition" | "removal";
  value?: DependencyGraphChangeValue;
}) {
  return (
    <span
      className={styles.diffLine}
      data-diff={value === undefined ? "absent" : kind}
    >
      <span className={styles.visuallyHidden}>
        {kind === "addition" ? "After: " : "Before: "}
      </span>
      {value === undefined ? (
        <span className={styles.muted}>Not present</span>
      ) : (
        <>
          <span aria-hidden="true">{kind === "addition" ? "+" : "−"}</span>
          <code>{formatValue(value)}</code>
        </>
      )}
    </span>
  );
}

/** Summary or exact field diff for one resource, including missing/redacted values. */
export function DependencyGraphChanges({
  node,
  presentation: controlledPresentation,
  defaultPresentation = "summary",
  onPresentationChange,
  showPresentationControls = true,
  compact = false,
  renderAttributeAnnotation,
}: DependencyGraphChangesProps) {
  const instanceId = useId();
  const [localPresentation, setLocalPresentation] =
    useState(defaultPresentation);
  const presentation = controlledPresentation ?? localPresentation;
  const choose = (next: DependencyGraphChangePresentation) => {
    if (controlledPresentation === undefined) setLocalPresentation(next);
    onPresentationChange?.(next);
  };
  const changes = node.changes ?? [];
  const counts = [
    ["add", "added"],
    ["remove", "removed"],
    ["change", "changed"],
  ].flatMap(([type, label]) => {
    const count = changes.filter((change) => change.type === type).length;
    return count ? [`${count} ${label}`] : [];
  });
  return (
    <section
      className={styles.resourceChanges}
      aria-label={`${node.label} changes`}
      data-resource-changes={node.id}
      data-presentation={presentation}
      data-compact={compact || undefined}
    >
      {!compact && <h4>Resource changes</h4>}
      {showPresentationControls && (
        <div
          className={styles.changeControls}
          role="group"
          aria-label="Change presentation"
        >
          <Button
            size="sm"
            variant={presentation === "summary" ? "filled" : "outlined"}
            aria-pressed={presentation === "summary"}
            onPress={() => choose("summary")}
          >
            Summary
          </Button>
          <Button
            size="sm"
            variant={presentation === "diff" ? "filled" : "outlined"}
            aria-pressed={presentation === "diff"}
            onPress={() => choose("diff")}
          >
            Specific changes
          </Button>
        </div>
      )}
      {presentation === "summary" ? (
        <>
          <p>{node.changeSummary ?? summaries[node.change ?? "unknown"]}</p>
          {!!counts.length && (
            <p className={styles.muted}>{counts.join(" · ")}</p>
          )}
        </>
      ) : changes.length ? (
        <dl
          className={styles.fieldChanges}
          aria-label={`${node.label} attribute differences`}
        >
          {changes.map((change, index) => {
            const annotation = renderAttributeAnnotation?.(node, change);
            const hasAnnotation =
              annotation != null &&
              typeof annotation !== "boolean" &&
              annotation !== "";
            const annotationId = `${instanceId}-attribute-annotation-${index}`;
            return (
              <div
                key={`${change.path}:${index}`}
                data-field-change={change.path}
              >
                <dt aria-describedby={hasAnnotation ? annotationId : undefined}>
                  <code>{change.path}</code>
                </dt>
                <dd className={styles.fieldValues} data-field-values>
                  <DiffValue
                    kind="removal"
                    value={change.type === "add" ? undefined : change.before}
                  />
                  <DiffValue
                    kind="addition"
                    value={change.type === "remove" ? undefined : change.after}
                  />
                </dd>
                {hasAnnotation && (
                  <dd
                    id={annotationId}
                    className={styles.attributeAnnotation}
                    data-graph-attribute-annotation
                  >
                    {annotation}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      ) : null}
      {!changes.length && (
        <p className={styles.muted}>
          {node.changes === undefined
            ? "Specific changes were not supplied."
            : "No field changes supplied."}
        </p>
      )}
    </section>
  );
}
