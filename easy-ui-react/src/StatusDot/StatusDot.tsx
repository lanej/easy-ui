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
  /** Highlights the current item without changing its semantic status tone. */
  current?: boolean;
  /** Animate once when the dot becomes current. Respects reduced-motion preferences. */
  animate?: boolean;
};

/** A non-interactive status marker; current indicates context, not urgency. */
export function StatusDot({
  label,
  tone = "neutral",
  size = "md",
  current = false,
  animate = true,
}: StatusDotProps) {
  return (
    <span
      className={styles.root}
      role="img"
      aria-label={label}
      aria-current={current ? "true" : undefined}
      title={label}
      data-tone={tone}
      data-size={size}
      data-current={current || undefined}
      data-animate={(current && animate) || undefined}
    />
  );
}
