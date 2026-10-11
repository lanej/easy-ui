import React from "react";
import styles from "./MeterBar.module.scss";

export type MeterBarTone = "neutral" | "success" | "warning" | "danger";

export type MeterBarProps = {
  /** Finite value on a zero-to-max scale. Invalid values draw nothing. */
  value: number;
  /** Finite, positive scale maximum. This does not imply a population. */
  max: number;
  /** Supplied visual meaning; never inferred from the value. */
  tone?: MeterBarTone;
  /** Track thickness: sm = 4px, md = 8px, lg = 12px. */
  thickness?: "sm" | "md" | "lg";
};

/**
 * Visual-only track and fill shared by bounded metrics.
 * The owning molecule supplies labels, states, and one accessible meter.
 */
export function MeterBar({
  value,
  max,
  tone = "neutral",
  thickness = "md",
}: MeterBarProps) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(max) ||
    max <= 0 ||
    value < 0 ||
    value > max
  ) {
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
