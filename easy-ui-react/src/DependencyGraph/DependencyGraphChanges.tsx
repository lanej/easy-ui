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
  /** Hide the summary/diff switch when embedding a fixed diff inside a card. */
  showPresentationControls?: boolean;
  /** Inline changed fragments with shared text shown once. */
  compact?: boolean;
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

function DiffLine({
  kind,
  value,
  prefix = "",
  suffix = "",
}: {
  kind: "addition" | "removal";
  value: DependencyGraphChangeValue;
  prefix?: string;
  suffix?: string;
}) {
  const text = formatValue(value);
  const fragment = text.slice(prefix.length, text.length - suffix.length);
  return (
    <span className={styles.diffLine} data-diff={kind}>
      <span aria-hidden="true">{kind === "addition" ? "+" : "−"}</span>
      <span className={styles.visuallyHidden}>
        {kind === "addition" ? "Added: " : "Removed: "}
      </span>
      <code>
        {prefix && <span className={styles.visuallyHidden}>{prefix}</span>}
        {fragment || <span aria-hidden="true">∅</span>}
        {suffix && <span className={styles.visuallyHidden}>{suffix}</span>}
      </code>
    </span>
  );
}

function sharedText(before: string, after: string) {
  const a = Array.from(before),
    b = Array.from(after);
  let start = 0,
    end = 0;
  while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++;
  while (
    end < Math.min(a.length, b.length) - start &&
    a[a.length - end - 1] === b[b.length - end - 1]
  )
    end++;
  return {
    prefix: a.slice(0, start).join(""),
    suffix: end ? a.slice(-end).join("") : "",
  };
}

/** Summary or exact field diff for one resource, including missing/redacted values. */
export function DependencyGraphChanges({
  node,
  presentation: controlledPresentation,
  defaultPresentation = "summary",
  onPresentationChange,
  showPresentationControls = true,
  compact = false,
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
        <dl className={styles.fieldChanges}>
          {changes.map((change, index) => {
            const shared =
              compact &&
              change.type === "change" &&
              typeof change.before === "string" &&
              typeof change.after === "string" &&
              change.before !== change.after
                ? sharedText(
                    formatValue(change.before),
                    formatValue(change.after),
                  )
                : { prefix: "", suffix: "" };
            return (
              <div key={`${change.path}:${index}`}>
                <dt>
                  <code>{change.path}</code>
                </dt>
                <dd>
                  {shared.prefix && (
                    <code aria-hidden="true">{shared.prefix}</code>
                  )}
                  {change.type !== "add" && (
                    <DiffLine
                      kind="removal"
                      value={change.before}
                      {...shared}
                    />
                  )}
                  {change.type !== "remove" && (
                    <DiffLine
                      kind="addition"
                      value={change.after}
                      {...shared}
                    />
                  )}
                  {shared.suffix && (
                    <code aria-hidden="true">{shared.suffix}</code>
                  )}
                </dd>
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
