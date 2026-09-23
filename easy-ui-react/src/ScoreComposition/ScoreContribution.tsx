import React from "react";
import ExpandMoreIcon from "@easypost/easy-ui-icons/ExpandMore400";
import { Disclosure } from "../Disclosure";
import { Icon } from "../Icon";
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
  sentiment = "neutral",
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
  const validMeter = validScale && withinScale;
  const fillState = validMeter
    ? score === 0
      ? "none"
      : score === maxScore
        ? "full"
        : "partial"
    : undefined;
  const fraction = validMeter ? score / maxScore : 0;
  const roundedPercent = Math.round(fraction * 100);
  const percentText =
    fillState === "partial" && roundedPercent === 100
      ? "<100%"
      : fillState === "partial" && roundedPercent === 0
        ? "<1%"
        : `${roundedPercent}%`;
  const fillLabel =
    fillState &&
    {
      none: labels.noContribution,
      partial: labels.partialContribution,
      full: labels.fullContribution,
    }[fillState];
  const effectiveSentiment = validMeter ? sentiment : "neutral";
  const valueText = scoreText(score, formatScore, labels, true);
  const maxText = scoreText(maxScore, formatScore, labels);
  const content = (
    <div
      className={styles.contribution}
      data-fill-state={fillState}
      data-sentiment={effectiveSentiment}
      style={typography && visualizationTypographyStyle(typography)}
    >
      {explanation != null ? (
        <div className={styles.contributionTitle}>
          <Disclosure.Trigger
            variant="text"
            isBlock
            aria-label={`${labels.explanation}: ${label}`}
          >
            <span className={styles.titleContent}>
              <strong
                className={styles.contributionLabel}
                data-viewrule="score-primary"
              >
                {label}
              </strong>
              <span className={styles.chevron}>
                <Icon symbol={ExpandMoreIcon} size="sm" />
              </span>
            </span>
          </Disclosure.Trigger>
        </div>
      ) : (
        <strong
          className={styles.contributionLabel}
          data-viewrule="score-primary"
        >
          {label}
        </strong>
      )}
      <div className={styles.scoreLine}>
        <strong>{valueText}</strong>
        <span>/ {maxText}</span>
        {fillLabel && (
          <span
            className={styles.contributionStatus}
            data-sentiment={effectiveSentiment}
            data-score-fill-label=""
          >
            {`${fillLabel} · ${percentText}`}
          </span>
        )}
      </div>
      {validMeter ? (
        <div
          className={styles.meter}
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={maxScore}
          aria-valuenow={score}
          aria-valuetext={`${valueText} / ${maxText}, ${fillLabel}, ${percentText}`}
        >
          <div
            className={styles.meterFill}
            style={{ width: `${fraction * 100}%` }}
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
        <Disclosure.Content>
          <div className={styles.explanation} data-viewrule="score-primary">
            {explanation}
          </div>
        </Disclosure.Content>
      )}
    </div>
  );
  return explanation != null ? (
    <Disclosure mountPolicy="unmount">{content}</Disclosure>
  ) : (
    content
  );
}
