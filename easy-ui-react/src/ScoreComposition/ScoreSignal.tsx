import React from "react";
import { visualizationTypographyStyle } from "../visualization/typography";
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
  description,
  labels: overrides,
  typography,
}: ScoreSignalProps) {
  const labels = { ...defaultLabels, ...overrides };
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
        <span className={styles.signalLabel}>{label}</span>
        <strong className={styles.signalValue}>{text}</strong>
      </div>
      {description != null && (
        <div className={styles.supportingText}>{description}</div>
      )}
    </div>
  );
}
