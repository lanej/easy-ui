import React from "react";
import type { EventTimelineEvent } from "../EventTimeline";
import type { InvestigationSelection } from "../InvestigationWorkspace";
import styles from "./PathComparison.module.scss";

export type ComparisonPath = {
  id: string;
  label: string;
  description?: string;
};
export type PathComparisonCell = {
  pathId: string;
  /** Stable observation IDs. Repeated labels never collapse distinct IDs. */
  eventIds: readonly string[];
  /** Supplied context, including gaps or conflicting evidence. */
  note?: string;
};
export type PathComparisonRow = {
  id: string;
  label: string;
  description?: string;
  cells: readonly PathComparisonCell[];
};
export type PathComparisonProps = {
  paths: readonly ComparisonPath[];
  events: readonly EventTimelineEvent[];
  /** Caller-defined alignment and membership, in display order. No chronology is inferred. */
  rows: readonly PathComparisonRow[];
  selection: InvestigationSelection;
  onSelectionChange: (selection: InvestigationSelection) => void;
  ariaLabel?: string;
  labels?: Partial<
    Record<
      | "stage"
      | "emptyCell"
      | "unavailableEvent"
      | "emptyRows"
      | "emptyPaths"
      | "received"
      | "unknownTime",
      string
    >
  >;
};

/** Aligned candidate histories, coordinated through the workspace's controlled selection. */
export function PathComparison({
  paths,
  events,
  rows,
  selection,
  onSelectionChange,
  ariaLabel = "Candidate path comparison",
  labels,
}: PathComparisonProps) {
  const text = {
    stage: "Observation group",
    emptyCell: "No observation supplied",
    unavailableEvent: "Observation unavailable",
    emptyRows: "No comparison rows supplied",
    emptyPaths: "No candidate paths supplied",
    received: "Received",
    unknownTime: "Time unknown",
    ...labels,
  };
  const records = new Map(events.map((event) => [event.id, event]));
  if (!paths.length) return <p className={styles.empty}>{text.emptyPaths}</p>;
  return (
    <div className={styles.root}>
      <table className={styles.comparison} aria-label={ariaLabel} role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              {text.stage}
            </th>
            {paths.map((path) => (
              <th
                key={path.id}
                scope="col"
                role="columnheader"
                data-selected={
                  (selection?.type === "path" &&
                    selection.pathId === path.id) ||
                  undefined
                }
              >
                <button
                  type="button"
                  className={styles.path}
                  aria-pressed={
                    selection?.type === "path" && selection.pathId === path.id
                  }
                  onClick={() =>
                    onSelectionChange({ type: "path", pathId: path.id })
                  }
                >
                  {path.label}
                </button>
                {path.description && (
                  <span className={styles.description}>{path.description}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {!rows.length && (
            <tr role="row">
              <td role="cell" colSpan={paths.length + 1}>
                {text.emptyRows}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} role="row">
              <th scope="row" role="rowheader">
                {row.label}
                {row.description && (
                  <span className={styles.description}>{row.description}</span>
                )}
              </th>
              {paths.map((path) => {
                const cell = row.cells.find((item) => item.pathId === path.id);
                return (
                  <td
                    key={path.id}
                    role="cell"
                    data-path-label={path.label}
                    data-selected={
                      (selection?.type === "path" &&
                        selection.pathId === path.id) ||
                      undefined
                    }
                  >
                    <div className={styles.observations}>
                      {!cell?.eventIds.length && (
                        <span className={styles.missing}>{text.emptyCell}</span>
                      )}
                      {cell?.eventIds.map((id) => {
                        const event = records.get(id);
                        if (!event)
                          return (
                            <span key={id} className={styles.missing}>
                              {text.unavailableEvent}: {id}
                            </span>
                          );
                        const current =
                          selection?.eventId === id &&
                          (selection.type !== "path" ||
                            selection.pathId === path.id);
                        return (
                          <button
                            key={id}
                            type="button"
                            className={styles.event}
                            aria-current={current ? "true" : undefined}
                            aria-label={`${event.label} · ${event.timeLabel || text.unknownTime} · ${path.label}${event.receivedTimeLabel ? ` · ${text.received} ${event.receivedTimeLabel}` : ""}`}
                            onClick={() =>
                              onSelectionChange({
                                type: "path",
                                pathId: path.id,
                                eventId: id,
                              })
                            }
                          >
                            <strong>{event.label}</strong>
                            <span>
                              {event.timeLabel || text.unknownTime}
                              {event.locationLabel &&
                                ` · ${event.locationLabel}`}
                            </span>
                            {event.receivedTimeLabel && (
                              <span className={styles.received}>
                                {text.received} {event.receivedTimeLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {cell?.note && (
                        <span className={styles.note}>{cell.note}</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
