import React from "react";
import { Text } from "../Text";
import styles from "./DurationReference.module.scss";

// Synthetic completed observations; nearest-rank P50 = 9 h, P90 = 18 h.
// The counts also supply the histogram, keeping its landmarks consistent.
const samples = [
  [1.5, 20],
  [4.5, 100],
  [7.5, 260],
  [9, 120],
  [10.5, 180],
  [13.5, 140],
  [16.5, 60],
  [18, 20],
  [19.5, 60],
  [22.5, 30],
  [25.5, 10],
] as const;
const max = 30;
const bins = Array.from({ length: 10 }, (_, index) => ({
  from: index * 3,
  to: (index + 1) * 3,
  count: samples.reduce(
    (sum, [duration, count]) =>
      sum + (duration >= index * 3 && duration < (index + 1) * 3 ? count : 0),
    0,
  ),
}));
const peak = Math.max(...bins.map(({ count }) => count));

/** Story-only reference composition; assessment policy stays outside the graphic. */
export function DurationReferenceExample({
  value,
  locale = "en",
}: {
  value: number | null;
  locale?: "en" | "fr";
}) {
  const valid =
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const inRange = valid && value <= max;
  const format = (number: number) =>
    new Intl.NumberFormat(locale).format(number);
  const elapsed = locale === "fr" ? "Écoulé" : "Elapsed";
  const description =
    locale === "fr"
      ? "Durées terminées · 1 000 observations fictives"
      : "Completed durations · 1,000 synthetic observations";
  const valueLabel = valid
    ? `${elapsed}: ${format(value)} h${value > max ? (locale === "fr" ? " · Hors échelle" : " · Outside scale") : ""}`
    : locale === "fr"
      ? "Durée indisponible"
      : "Elapsed unavailable";
  const distributionLabel = bins
    .map(
      ({ from, to, count }) =>
        `${format(from)}–${format(to)} h: ${format(count)}`,
    )
    .join("; ");
  return (
    <figure className={styles.root} aria-label={description}>
      <div
        className={styles.plot}
        role="img"
        aria-label={`${description}. ${valueLabel}. P50: 9 h. P90: 18 h. ${distributionLabel}.`}
      >
        <div className={styles.bins} aria-hidden="true">
          {bins.map(({ from, count }) => (
            <span
              key={from}
              className={styles.bin}
              style={{ height: `${(count / peak) * 100}%` }}
            />
          ))}
        </div>
        <span
          className={styles.percentile}
          style={{ left: "30%" }}
          aria-hidden="true"
        />
        <span
          className={styles.percentile}
          style={{ left: "60%" }}
          aria-hidden="true"
        />
        {inRange && (
          <span
            className={styles.elapsed}
            style={{ left: `${(value / max) * 100}%` }}
            aria-hidden="true"
          >
            <span className={styles.marker} />
          </span>
        )}
      </div>
      <div className={styles.axis} aria-hidden="true">
        <span>0 h</span>
        <span>30 h</span>
      </div>
      <figcaption className={styles.caption}>
        <div className={styles.landmarks}>
          <span className={styles.current}>
            {inRange && <span className={styles.key} aria-hidden="true" />}
            {valueLabel}
          </span>
          <span>P50: 9 h</span>
          <span>P90: 18 h</span>
        </div>
        <Text as="span" variant="caption" color="subdued">
          {description}
        </Text>
      </figcaption>
    </figure>
  );
}
