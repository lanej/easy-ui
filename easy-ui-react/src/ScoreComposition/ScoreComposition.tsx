import React, { useEffect, useMemo, useRef, useState } from "react";
import { useId } from "react-aria";
import { visualizationTypographyStyle } from "../visualization/typography";
import { ScoreSignal } from "./ScoreSignal";
import { ScoreContribution } from "./ScoreContribution";
import { ScoreResult } from "./ScoreResult";
import { ScoreConnectorLayer, type ScoreConnection } from "./ScoreConnector";
import { defaultLabels } from "./presentation";
import type { ScoreCompositionProps } from "./types";
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
  const [hoveredContribution, setHoveredContribution] = useState<string | null>(
    null,
  );
  const [focusedContribution, setFocusedContribution] = useState<string | null>(
    null,
  );
  // Removed records must not retain a trace if their IDs are later reused.
  useEffect(() => {
    const ids = new Set(contributions.map(({ id }) => id));
    setHoveredContribution((id) => (id !== null && ids.has(id) ? id : null));
    setFocusedContribution((id) => (id !== null && ids.has(id) ? id : null));
  }, [contributions]);
  const signalById = useMemo(
    () => new Map(signals.map((signal) => [signal.id, signal])),
    [signals],
  );
  const connections = useMemo<ScoreConnection[]>(
    () =>
      contributions.flatMap((contribution) => [
        ...[...new Set(contribution.signals)]
          .filter((signal) => signalById.has(signal))
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
    [contributions, signalById],
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
      <div className={styles.layout} ref={layoutRef} data-score-layout="">
        <div className={styles.column}>
          <div id={`${id}-signals`} className={styles.columnLabel}>
            {labels.signals}
          </div>
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
        </div>
        <div className={styles.column}>
          <div id={`${id}-contributions`} className={styles.columnLabel}>
            {labels.contributions}
          </div>
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
        </div>
        <div className={styles.column}>
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
        <ScoreConnectorLayer
          layoutRef={layoutRef}
          connections={connections}
          highlightedContribution={focusedContribution ?? hoveredContribution}
        />
      </div>
      {footer != null && <footer className={styles.footer}>{footer}</footer>}
    </section>
  );
}
