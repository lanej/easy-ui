import React from "react";
import { useId } from "react-aria";
import { Disclosure } from "../Disclosure";
import { ScoreDisclosureTitle } from "./ScoreDisclosureTitle";
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
  const valueId = useId();
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
  const row = (
    <span className={styles.signalRow}>
      <span className={styles.signalLabel} data-viewrule="score-primary">
        {label}
      </span>
      <span
        className={classNames(
          styles.signalValue,
          !!status && styles.signalStatus,
        )}
        id={valueId}
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
    </span>
  );
  const content = (
    <div
      className={styles.signal}
      data-expandable={description != null}
      style={typography && visualizationTypographyStyle(typography)}
    >
      {description != null ? (
        <ScoreDisclosureTitle
          accessibleLabel={`${labels.explanation}: ${label}`}
          descriptionId={valueId}
          className={styles.signalTitle}
        >
          {row}
        </ScoreDisclosureTitle>
      ) : (
        row
      )}
      {description != null && (
        <Disclosure.Content>
          <div
            className={styles.signalDescription}
            data-viewrule="score-primary"
          >
            {description}
          </div>
        </Disclosure.Content>
      )}
    </div>
  );
  return description != null ? (
    <Disclosure mountPolicy="unmount">{content}</Disclosure>
  ) : (
    content
  );
}
