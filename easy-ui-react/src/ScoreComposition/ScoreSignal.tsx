import React from "react";
import { visualizationTypographyStyle } from "../visualization/typography";
import { classNames } from "../utilities/css";
import { defaultLabels } from "./presentation";
import type { ScorePresentationProps, ScoreSignalData } from "./types";
import styles from "./ScoreComposition.module.scss";

/** A compact, independently usable observation box with protected text padding. */
export type ScoreSignalProps = Omit<ScoreSignalData, "id"> &
  Omit<ScorePresentationProps, "formatScore">;

export function ScoreSignal({
  label,
  value,
  displayValue,
  sentiment = "neutral",
  statusLabel,
  description,
  labels: overrides,
  typography,
}: ScoreSignalProps) {
  const labels = { ...defaultLabels, ...overrides };
  const available =
    value !== null && (typeof value !== "number" || Number.isFinite(value));
  const effectiveSentiment = available ? sentiment : "neutral";
  const status = available
    ? statusLabel?.trim() ||
      {
        neutral: undefined,
        positive: labels.positiveSignal,
        warning: labels.warningSignal,
        negative: labels.negativeSignal,
      }[effectiveSentiment]
    : undefined;
  const text =
    value === null
      ? labels.missingValue
      : typeof value === "number" && !Number.isFinite(value)
        ? labels.invalidValue
        : (displayValue ??
          (typeof value === "boolean"
            ? value
              ? labels.yes
              : labels.no
            : String(value)));
  return (
    <div
      className={styles.signal}
      style={typography && visualizationTypographyStyle(typography)}
    >
      <div className={styles.signalRow}>
        <span className={styles.signalLabel} data-viewrule="score-primary">
          {label}
        </span>
        <span
          className={classNames(
            styles.signalValue,
            !!status && styles.signalStatus,
          )}
          data-sentiment={effectiveSentiment}
        >
          <strong>{text}</strong>
          {status && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={styles.signalStatusLabel}
                data-score-status-label=""
              >
                {status}
              </span>
            </>
          )}
        </span>
      </div>
      {description != null && (
        <div className={styles.supportingText}>{description}</div>
      )}
    </div>
  );
}
