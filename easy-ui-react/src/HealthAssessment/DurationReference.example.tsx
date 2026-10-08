import React from "react";
import { Text } from "../Text";
import type { HealthIndicatorAssessment } from "../HealthIndicator";
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

export type DurationHealthRegion = {
  from: number;
  to: number;
  assessment: HealthIndicatorAssessment;
  label: string;
  shortLabel: string;
};

/** Story-only reference composition; assessment policy stays outside the graphic. */
export function DurationReferenceExample({
  value,
  locale = "en",
  regions = [],
}: {
  value: number | null;
  locale?: "en" | "fr";
  regions?: readonly DurationHealthRegion[];
}) {
  const valid =
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const inRange = valid && value <= max;
  const format = (number: number) =>
    new Intl.NumberFormat(locale).format(number);
  const elapsed = locale === "fr" ? "Écoulé" : "Elapsed";
  const description =
    locale === "fr"
      ? "1 000 durées terminées fictives"
      : "1,000 synthetic completed durations";
  const visibleRegions = regions.filter(({ from, to }) => from < max && to > 0);
  const regionWidth = ({ from, to }: DurationHealthRegion) =>
    `${((Math.min(max, to) - Math.max(0, from)) / max) * 100}%`;
  const regionsLabel = regions.length
    ? `${locale === "fr" ? "Plages d’évaluation illustratives" : "Illustrative assessment ranges"}: ${regions
        .map(
          ({ from, to, label }) =>
            `${label}: ${Number.isFinite(to) ? `${format(from)} ≤ h < ${format(to)}` : `h ≥ ${format(from)}`}`,
        )
        .join("; ")}. `
    : "";
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
      {visibleRegions.length > 0 && (
        <div className={styles.regionLabels} aria-hidden="true">
          {visibleRegions.map((region) => (
            <span
              key={region.from}
              className={styles.regionLabel}
              data-assessment={region.assessment}
              style={{ width: regionWidth(region) }}
            >
              {region.shortLabel}
            </span>
          ))}
        </div>
      )}
      <div
        className={styles.plot}
        data-has-regions={visibleRegions.length > 0}
        role="img"
        aria-label={`${description}. ${valueLabel}. ${regionsLabel}P50: 9 h. P90: 18 h. ${distributionLabel}.`}
      >
        {visibleRegions.map((region) => (
          <span
            key={region.from}
            className={styles.region}
            data-assessment={region.assessment}
            style={{
              left: `${(Math.max(0, region.from) / max) * 100}%`,
              width: regionWidth(region),
            }}
            aria-hidden="true"
          />
        ))}
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
        {[
          0,
          ...visibleRegions.map(({ from }) => from).filter((from) => from > 0),
          max,
        ].map((tick) => (
          <span key={tick} style={{ left: `${(tick / max) * 100}%` }}>
            {format(tick)} h
          </span>
        ))}
      </div>
      {visibleRegions.length > 0 && (
        <div className={styles.compactRegions} aria-hidden="true">
          {visibleRegions.map(({ from, to, assessment, shortLabel }) => (
            <span
              key={from}
              className={styles.regionLabel}
              data-assessment={assessment}
            >
              <span>{shortLabel}</span>
              <span>
                {Number.isFinite(to)
                  ? `${from > 0 ? `${format(from)}–` : ""}<${format(to)} h`
                  : `≥${format(from)} h`}
              </span>
            </span>
          ))}
        </div>
      )}
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
