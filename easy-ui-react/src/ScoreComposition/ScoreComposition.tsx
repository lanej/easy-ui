import React, { useEffect, useMemo, useRef, useState } from "react";
import { useId } from "react-aria";
import { visualizationTypographyStyle } from "../visualization/typography";
import { ScoreColumn } from "./ScoreColumn";
import { ScoreSignal } from "./ScoreSignal";
import { ScoreContribution } from "./ScoreContribution";
import { ScoreResult } from "./ScoreResult";
import { ScoreConnectorLayer, type ScoreConnection } from "./ScoreConnector";
import { defaultLabels } from "./presentation";
import type { ScoreCompositionColumn, ScoreCompositionProps } from "./types";
import styles from "./ScoreComposition.module.scss";

/**
 * Explains a supplied score through observations and capped contributions.
 * Ordinary DOM content follows signals → contributions → result; SVG is decorative.
 * Applications own scoring, source relationships, outcome, and provenance.
 */
export function ScoreComposition({
  signals,
  contributions,
  result,
  collapsedColumns,
  defaultCollapsedColumns = [],
  onCollapsedColumnsChange,
  title,
  description,
  metadata,
  footer,
  variant = "card",
  formatScore,
  labels: overrides,
  typography,
  ...aria
}: ScoreCompositionProps) {
  const id = useId();
  const layoutRef = useRef<HTMLDivElement>(null);
  const labels = { ...defaultLabels, ...overrides };
  const [localCollapsedColumns, setLocalCollapsedColumns] = useState(
    defaultCollapsedColumns,
  );
  const collapsed = collapsedColumns ?? localCollapsedColumns;
  const signalsCollapsed = signals.length > 0 && collapsed.includes("signals");
  const contributionsCollapsed =
    contributions.length > 0 && collapsed.includes("contributions");
  const setColumnExpanded = (
    column: ScoreCompositionColumn,
    expanded: boolean,
  ) => {
    const next = (["signals", "contributions"] as const).filter((name) =>
      name === column ? !expanded : collapsed.includes(name),
    );
    if (collapsedColumns === undefined) setLocalCollapsedColumns(next);
    onCollapsedColumnsChange?.(next);
  };
  const [hoveredContribution, setHoveredContribution] = useState<string | null>(
    null,
  );
  const [focusedContribution, setFocusedContribution] = useState<string | null>(
    null,
  );
  // Removed records must not retain a trace if their IDs are later reused.
  useEffect(() => {
    const ids = new Set(
      contributionsCollapsed ? [] : contributions.map(({ id }) => id),
    );
    setHoveredContribution((id) => (id !== null && ids.has(id) ? id : null));
    setFocusedContribution((id) => (id !== null && ids.has(id) ? id : null));
  }, [contributions, contributionsCollapsed]);
  const signalById = useMemo(
    () => new Map(signals.map((signal) => [signal.id, signal])),
    [signals],
  );
  const connections = useMemo<ScoreConnection[]>(
    () =>
      (contributionsCollapsed ? [] : contributions).flatMap((contribution) => [
        ...[...new Set(contribution.signals)]
          .filter((signal) => !signalsCollapsed && signalById.has(signal))
          .map((signal): ScoreConnection => ({
            from: ["signal", signal],
            to: ["contribution", contribution.id],
            contributionId: contribution.id,
            isInactive: signalById.get(signal)?.triggered === false,
          })),
        {
          from: ["contribution", contribution.id],
          to: ["result", "result"],
          contributionId: contribution.id,
        },
      ]),
    [contributions, signalById, signalsCollapsed, contributionsCollapsed],
  );
  return (
    <section
      className={styles.root}
      data-variant={variant}
      style={visualizationTypographyStyle(typography)}
      aria-labelledby={
        aria["aria-labelledby"] ??
        (!aria["aria-label"] && title ? `${id}-title` : undefined)
      }
      aria-label={
        aria["aria-label"] ??
        (!aria["aria-labelledby"] && !title ? "Score composition" : undefined)
      }
      aria-describedby={
        aria["aria-describedby"] ??
        (description != null ? `${id}-description` : undefined)
      }
    >
      {(title || description != null || metadata != null) && (
        <header className={styles.header}>
          {title && (
            <h2 id={`${id}-title`} className={styles.title}>
              {title}
            </h2>
          )}
          {description != null && (
            <div id={`${id}-description`} className={styles.description}>
              {description}
            </div>
          )}
          {metadata != null && (
            <div className={styles.metadata}>{metadata}</div>
          )}
        </header>
      )}
      <div
        className={styles.layout}
        ref={layoutRef}
        data-score-layout=""
        data-signals-collapsed={signalsCollapsed}
        data-contributions-collapsed={contributionsCollapsed}
      >
        <ScoreColumn
          column="signals"
          labelId={`${id}-signals`}
          label={labels.signals}
          count={signals.length}
          isCollapsed={signalsCollapsed}
          onExpandedChange={(expanded) =>
            setColumnExpanded("signals", expanded)
          }
          labels={labels}
        >
          {signals.length ? (
            <ul
              role="list"
              aria-labelledby={`${id}-signals`}
              className={styles.signalList}
            >
              {signals.map((signal) => (
                <li
                  key={signal.id}
                  data-score-node="signal"
                  data-score-id={signal.id}
                >
                  <ScoreSignal {...signal} labels={overrides} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>{labels.noSignals}</p>
          )}
        </ScoreColumn>
        <ScoreColumn
          column="contributions"
          labelId={`${id}-contributions`}
          label={labels.contributions}
          count={contributions.length}
          isCollapsed={contributionsCollapsed}
          onExpandedChange={(expanded) =>
            setColumnExpanded("contributions", expanded)
          }
          labels={labels}
        >
          {contributions.length ? (
            <ul
              role="list"
              aria-labelledby={`${id}-contributions`}
              className={styles.contributionList}
            >
              {contributions.map(({ signals: sources, ...contribution }) => (
                <li
                  key={contribution.id}
                  onMouseEnter={() => setHoveredContribution(contribution.id)}
                  onMouseLeave={() => setHoveredContribution(null)}
                  onFocusCapture={() => setFocusedContribution(contribution.id)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setFocusedContribution(null);
                    }
                  }}
                  data-score-node="contribution"
                  data-score-id={contribution.id}
                  data-score-sources-complete={
                    sources.length > 0 &&
                    sources.every((source) => signalById.has(source))
                  }
                >
                  <ScoreContribution
                    {...contribution}
                    sourceLabels={[...new Set(sources)].map(
                      (source) =>
                        signalById.get(source)?.label ??
                        `${labels.unavailableSignal}: ${source}`,
                    )}
                    formatScore={formatScore}
                    labels={overrides}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>{labels.noContributions}</p>
          )}
        </ScoreColumn>
        <div className={styles.column} data-score-column="result">
          <div className={styles.columnLabel}>{labels.result}</div>
          <div className={styles.resultContainer}>
            <div data-score-node="result" data-score-id="result">
              <ScoreResult
                {...result}
                formatScore={formatScore}
                labels={overrides}
              />
            </div>
          </div>
        </div>
        {connections.length > 0 && (
          <ScoreConnectorLayer
            layoutRef={layoutRef}
            connections={connections}
            highlightedContribution={focusedContribution ?? hoveredContribution}
          />
        )}
      </div>
      {footer != null && <footer className={styles.footer}>{footer}</footer>}
    </section>
  );
}
