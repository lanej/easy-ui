import React from "react";
import { Badge, type BadgeVariant } from "../Badge";
import { visualizationTypographyStyle } from "../visualization/typography";
import { defaultFormatScore, defaultLabels, scoreText } from "./presentation";
import type { ScorePresentationProps, ScoreResultData } from "./types";
import styles from "./ScoreComposition.module.scss";

export type ScoreResultProps = ScoreResultData & ScorePresentationProps;

const variants: Record<
  NonNullable<ScoreResultData["sentiment"]>,
  BadgeVariant
> = {
  neutral: "gray",
  positive: "success",
  negative: "danger",
};

/** Emphasizes the supplied score and application-owned outcome without calculating either. */
export function ScoreResult({
  label = "Total score",
  score,
  maxScore,
  disposition,
  sentiment = "neutral",
  supportingText,
  formatScore = defaultFormatScore,
  labels: overrides,
  typography,
}: ScoreResultProps) {
  const labels = { ...defaultLabels, ...overrides };
  return (
    <div
      className={styles.result}
      style={typography && visualizationTypographyStyle(typography)}
    >
      <span className={styles.resultLabel}>{label}</span>
      <strong
        className={styles.resultValue}
        data-unavailable={score === null || !Number.isFinite(score)}
      >
        {scoreText(score, formatScore, labels)}
      </strong>
      {maxScore !== undefined && (
        <span className={styles.resultMaximum}>
          / {scoreText(maxScore, formatScore, labels)}
        </span>
      )}
      {disposition && (
        <div className={styles.disposition}>
          <Badge variant={variants[sentiment]}>
            <span
              className={styles.dispositionLabel}
              data-sentiment={sentiment}
            >
              {disposition}
            </span>
          </Badge>
        </div>
      )}
      {supportingText != null && (
        <div className={styles.supportingText}>{supportingText}</div>
      )}
    </div>
  );
}
