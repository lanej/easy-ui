import React, { useState } from "react";
import { Button } from "../Button";
import type {
  DependencyGraphChangePresentation,
  DependencyGraphChangeValue,
  DependencyGraphNode,
} from "./types";
import styles from "./DependencyGraph.module.scss";

export type DependencyGraphChangesProps = {
  node: DependencyGraphNode;
  presentation?: DependencyGraphChangePresentation;
  defaultPresentation?: DependencyGraphChangePresentation;
  onPresentationChange?: (
    presentation: DependencyGraphChangePresentation,
  ) => void;
};

const summaries = {
  create: "Resource will be added.",
  update: "Resource will be updated.",
  replace: "Resource will be removed and recreated.",
  delete: "Resource will be removed.",
  unchanged: "No resource change planned.",
  unknown: "Resource change is unknown.",
} as const;

function DiffLine({
  kind,
  value,
}: {
  kind: "addition" | "removal";
  value: DependencyGraphChangeValue;
}) {
  const text =
    typeof value === "string"
      ? value === ""
        ? '""'
        : value
      : value.status === "redacted"
        ? "Redacted value"
        : "Unknown value";
  return (
    <div className={styles.diffLine} data-diff={kind}>
      <span aria-hidden="true">{kind === "addition" ? "+" : "−"}</span>
      <span className={styles.visuallyHidden}>
        {kind === "addition" ? "Added: " : "Removed: "}
      </span>
      <code>{text}</code>
    </div>
  );
}

/** Summary or exact field diff for one resource, including missing/redacted values. */
export function DependencyGraphChanges({
  node,
  presentation: controlledPresentation,
  defaultPresentation = "summary",
  onPresentationChange,
}: DependencyGraphChangesProps) {
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
    >
      <h4>Resource changes</h4>
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
      {presentation === "summary" ? (
        <>
          <p>{node.changeSummary ?? summaries[node.change ?? "unknown"]}</p>
          {!!counts.length && (
            <p className={styles.muted}>{counts.join(" · ")}</p>
          )}
        </>
      ) : changes.length ? (
        <dl className={styles.fieldChanges}>
          {changes.map((change, index) => (
            <div key={`${change.path}:${index}`}>
              <dt>
                <code>{change.path}</code>
              </dt>
              <dd>
                {change.type !== "add" && (
                  <DiffLine kind="removal" value={change.before} />
                )}
                {change.type !== "remove" && (
                  <DiffLine kind="addition" value={change.after} />
                )}
              </dd>
            </div>
          ))}
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
