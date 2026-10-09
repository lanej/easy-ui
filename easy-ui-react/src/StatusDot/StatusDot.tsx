import React from "react";
import styles from "./StatusDot.module.scss";

export type StatusDotTone =
  "neutral" | "success" | "warning" | "danger" | "primary";

export type StatusDotProps = {
  /** Required accessible status name, also available as a native hover hint. */
  label: string;
  /** Caller-supplied presentation; no domain status is inferred. */
  tone?: StatusDotTone;
  size?: "sm" | "md";
};

/** A static status marker. Use a nearby visible label when the meaning is unfamiliar. */
export function StatusDot({
  label,
  tone = "neutral",
  size = "md",
}: StatusDotProps) {
  return (
    <span
      className={styles.root}
      role="img"
      aria-label={label}
      title={label}
      data-tone={tone}
      data-size={size}
    />
  );
}
