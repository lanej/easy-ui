import React from "react";
import styles from "./MeterBar.module.scss";

export type MeterBarTone = "neutral" | "success" | "warning" | "danger";

type MeterBarSharedProps = {
  /** Finite, positive maximum shared by every bar. Does not imply a population. */
  max: number;
  /** Supplied visual meaning; never inferred from the value. */
  tone?: MeterBarTone;
  /** Track thickness: sm = 4px, md = 8px, lg = 12px. */
  thickness?: "sm" | "md" | "lg";
};

export type MeterBarValueProps = MeterBarSharedProps & {
  /** Finite value on a zero-to-max scale. Invalid values draw nothing. */
  value: number;
  data?: never;
  formatValue?: never;
  accessibilityLabel?: never;
  unavailableLabel?: never;
};

export type MeterBarDatum = {
  /** Unique, stable identifier. Input order is preserved. */
  id: string;
  /** Visible and accessible name of this metric. */
  label: string;
  /** Null or invalid values remain visible as unavailable, not zero. */
  value: number | null;
  /** Optional row tone; falls back to the MeterBar tone. */
  tone?: MeterBarTone;
};

export type MeterBarComparisonProps = MeterBarSharedProps & {
  /** Comparable measurements in the same units, all using the shared maximum. */
  data: readonly MeterBarDatum[];
  value?: never;
  /** Display and accessible value text. Does not change fill geometry. */
  formatValue?: (value: number) => string;
  /** Optional accessible group name; no visible heading is added. */
  accessibilityLabel?: string;
  /** Localized replacement for missing or invalid measurements. */
  unavailableLabel?: string;
};

export type MeterBarProps = MeterBarValueProps | MeterBarComparisonProps;

function isValidValue(value: number | null, max: number): value is number {
  return (
    value !== null &&
    Number.isFinite(value) &&
    Number.isFinite(max) &&
    max > 0 &&
    value >= 0 &&
    value <= max
  );
}

/** Visual-only renderer; each owner supplies its accessible meter semantics. */
function MeterBarTrack({
  value,
  max,
  tone = "neutral",
  thickness = "md",
}: MeterBarValueProps) {
  if (!isValidValue(value, max)) {
    return null;
  }

  return (
    <span
      className={styles.track}
      data-meter-bar=""
      data-tone={tone}
      data-thickness={thickness}
      aria-hidden="true"
    >
      <span
        className={styles.fill}
        data-meter-fill=""
        style={{ inlineSize: `${(value / max) * 100}%` }}
      />
    </span>
  );
}

function MeterBarComparison({
  data,
  max,
  tone = "neutral",
  thickness = "md",
  formatValue = String,
  accessibilityLabel,
  unavailableLabel = "Unavailable",
}: MeterBarComparisonProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.comparison}
      data-meter-comparison=""
      role="group"
      aria-label={accessibilityLabel}
    >
      {data.map((datum) => {
        const value = datum.value;
        const valid = isValidValue(value, max);
        const valueText = valid ? formatValue(value) : unavailableLabel;

        return (
          <div
            key={datum.id}
            className={styles.comparisonRow}
            data-meter-row=""
            data-state={valid ? "valid" : "unavailable"}
            role={valid ? "meter" : undefined}
            aria-label={valid ? datum.label : undefined}
            aria-valuemin={valid ? 0 : undefined}
            aria-valuemax={valid ? max : undefined}
            aria-valuenow={valid ? value : undefined}
            aria-valuetext={valid ? valueText : undefined}
          >
            <span className={styles.comparisonLabel}>{datum.label}</span>
            <span className={styles.comparisonTrack}>
              {valid && (
                <MeterBarTrack
                  value={value}
                  max={max}
                  tone={datum.tone ?? tone}
                  thickness={thickness}
                />
              )}
            </span>
            <span className={styles.comparisonValue}>
              {valid ? <bdi dir="ltr">{valueText}</bdi> : valueText}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A single value is visual-only, preserving existing metric compositions.
 * A data array renders unframed, labeled comparisons with one meter per valid row.
 */
export function MeterBar(props: MeterBarProps) {
  return props.data !== undefined ? (
    <MeterBarComparison {...props} />
  ) : (
    <MeterBarTrack {...props} />
  );
}
