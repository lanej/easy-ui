import React from "react";
import { Text } from "../Text";
import styles from "./DurationValue.module.scss";

export type DurationValueProps = {
  /** Finite nonnegative duration in the supplied unit. Zero is valid. */
  value: number | null;
  /** Visible localized unit. No conversion or unit inference is performed. */
  unit: string;
  /** @default md */
  size?: "sm" | "md";
  /** Formats the number only; defaults to String, preserving precision. */
  formatValue?: (value: number) => string;
  /** @default Duration */
  accessibilityLabel?: string;
  /** Localized description of the current value and unit; ignored when unavailable. */
  accessibilityValueText?: string;
  /** Suppresses any previous duration while loading. */
  isLoading?: boolean;
  /** @default Loading… */
  loadingLabel?: string;
  /** @default Unavailable */
  emptyLabel?: string;
};

/** Displays a supplied duration without inferring health or reference thresholds. */
export function DurationValue({
  value,
  unit,
  size = "md",
  formatValue = String,
  accessibilityLabel = "Duration",
  accessibilityValueText,
  isLoading = false,
  loadingLabel = "Loading…",
  emptyLabel = "Unavailable",
}: DurationValueProps) {
  const hasValue =
    !isLoading &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0;
  const formattedValue = hasValue ? formatValue(value) : null;
  return (
    <span
      className={styles.root}
      data-size={size}
      role="group"
      aria-label={accessibilityLabel}
      aria-busy={isLoading}
    >
      {hasValue ? (
        <span
          role="img"
          aria-label={accessibilityValueText ?? `${formattedValue} ${unit}`}
        >
          <span className={styles.value} aria-hidden="true">
            <Text
              as="span"
              variant={size === "sm" ? "subtitle2" : "heading3"}
              breakWord
            >
              {formattedValue}
            </Text>
          </span>{" "}
          <span className={styles.unit} aria-hidden="true">
            <Text as="span" variant="body2" color="neutral.600" breakWord>
              {unit}
            </Text>
          </span>
        </span>
      ) : (
        <span role={isLoading ? "status" : undefined}>
          <Text as="span" variant="body2" color="neutral.600" breakWord>
            {isLoading ? loadingLabel : emptyLabel}
          </Text>
        </span>
      )}
    </span>
  );
}
