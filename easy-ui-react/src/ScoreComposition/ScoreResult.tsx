import React from "react";
import CancelIcon from "@easypost/easy-ui-icons/Cancel";
import CheckCircleIcon from "@easypost/easy-ui-icons/CheckCircle";
import InfoIcon from "@easypost/easy-ui-icons/Info";
import { Icon } from "../Icon";
import { visualizationTypographyStyle } from "../visualization/typography";
import { defaultFormatScore, defaultLabels, scoreText } from "./presentation";
import type { ScorePresentationProps, ScoreResultData } from "./types";
import styles from "./ScoreComposition.module.scss";

export type ScoreResultProps = ScoreResultData & ScorePresentationProps;

const outcomeIcons = {
  neutral: InfoIcon,
  positive: CheckCircleIcon,
  negative: CancelIcon,
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
      data-sentiment={sentiment}
      style={typography && visualizationTypographyStyle(typography)}
    >
      {disposition && (
        <div className={styles.disposition}>
          <span className={styles.dispositionIcon}>
            <Icon symbol={outcomeIcons[sentiment]} size="lg" />
          </span>
          <strong className={styles.dispositionLabel}>{disposition}</strong>
        </div>
      )}
      <span className={styles.resultLabel}>{label}</span>
      <div className={styles.resultScore}>
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
      </div>
      {supportingText != null && (
        <div className={styles.supportingText}>{supportingText}</div>
      )}
    </div>
  );
}
