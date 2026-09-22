import React from "react";
import { Disclosure } from "../Disclosure";
import { visualizationTypographyStyle } from "../visualization/typography";
import { defaultFormatScore, defaultLabels, scoreText } from "./presentation";
import type { ScoreContributionData, ScorePresentationProps } from "./types";
import styles from "./ScoreComposition.module.scss";

/** A contribution card with an exact score, bounded meter, and optional explanation. */
export type ScoreContributionProps = Omit<
  ScoreContributionData,
  "id" | "signals"
> &
  ScorePresentationProps & {
    /** Human-readable source labels. Kept visible even without connectors. */
    sourceLabels?: readonly string[];
  };

export function ScoreContribution({
  label,
  score,
  maxScore,
  sourceLabels = [],
  explanation,
  labels: overrides,
  formatScore = defaultFormatScore,
  typography,
}: ScoreContributionProps) {
  const labels = { ...defaultLabels, ...overrides };
  const validScale = Number.isFinite(maxScore) && maxScore > 0;
  const available = score !== null && Number.isFinite(score);
  const withinScale = available && score >= 0 && score <= maxScore;
  const valueText = scoreText(score, formatScore, labels, true);
  const maxText = scoreText(maxScore, formatScore, labels);
  return (
    <div
      className={styles.contribution}
      style={typography && visualizationTypographyStyle(typography)}
    >
      <strong className={styles.contributionLabel}>{label}</strong>
      <div className={styles.scoreLine}>
        <strong>{valueText}</strong>
        <span>/ {maxText}</span>
      </div>
      {validScale && withinScale ? (
        <div
          className={styles.meter}
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={maxScore}
          aria-valuenow={score}
          aria-valuetext={`${valueText} / ${maxText}`}
        >
          <div
            className={styles.meterFill}
            style={{ width: `${(score / maxScore) * 100}%` }}
          />
        </div>
      ) : (
        <>
          <div className={styles.meter} aria-hidden="true" />
          {(!validScale || available) && (
            <span className={styles.supportingText}>
              {validScale ? labels.outsideScale : labels.invalidScale}
            </span>
          )}
        </>
      )}
      <div className={styles.sources}>
        {sourceLabels.length ? (
          <>
            <span>{labels.basedOn}</span>
            <ul role="list">
              {sourceLabels.map((source, index) => (
                <li key={index}>{source}</li>
              ))}
            </ul>
          </>
        ) : (
          labels.noSources
        )}
      </div>
      {explanation != null && (
        <Disclosure mountPolicy="unmount">
          <div className={styles.explanationTrigger}>
            <Disclosure.Trigger
              variant="link"
              aria-label={`${labels.explanation}: ${label}`}
            >
              {labels.explanation}
            </Disclosure.Trigger>
          </div>
          <Disclosure.Content>
            <div className={styles.explanation}>{explanation}</div>
          </Disclosure.Content>
        </Disclosure>
      )}
    </div>
  );
}
