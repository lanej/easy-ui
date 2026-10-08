import React from "react";
import { Text } from "../Text";
import type { HealthIndicatorAssessment } from "../HealthIndicator";
import styles from "./DurationReference.module.scss";

// Synthetic completed observations; nearest-rank P50 = 9 h, P90 = 18 h.
// Assessment ranges come from the application, independently of these samples.
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
const landmarks = [
  { label: "P50", value: 9 },
  { label: "P90", value: 18 },
];
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

function Scale({ format }: { format: (value: number) => string }) {
  return (
    <div className={styles.scale} aria-hidden="true">
      <span className={styles.endpoint}>0 h</span>
      {landmarks.map(({ label, value }) => (
        <span
          key={label}
          className={styles.percentileLabel}
          style={{ left: `${(value / max) * 100}%` }}
        >
          {label}
          <strong>{format(value)} h</strong>
        </span>
      ))}
      <span className={styles.endpoint}>{max} h</span>
    </div>
  );
}

/** Story-only composition of caller-supplied ranges and a reference disclosure. */
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
  const visibleRegions = regions.filter(({ from, to }) => from < max && to > 0);
  const regionWidth = ({ from, to }: DurationHealthRegion) =>
    `${((Math.min(max, to) - Math.max(0, from)) / max) * 100}%`;
  const rangeLabel = ({ from, to }: DurationHealthRegion) =>
    Number.isFinite(to)
      ? `${from > 0 ? `${format(from)}–` : ""}<${format(to)} h`
      : `≥${format(from)} h`;
  const rangesLabel = regions.length
    ? `${locale === "fr" ? "Plages d’évaluation illustratives" : "Illustrative assessment ranges"}: ${regions.map((region) => `${region.label}: ${Number.isFinite(region.to) ? `${format(region.from)} ≤ h < ${format(region.to)}` : `h ≥ ${format(region.from)}`}`).join("; ")}. `
    : "";
  const valueLabel = valid
    ? `${locale === "fr" ? "Écoulé" : "Elapsed"}: ${format(value)} h${value > max ? (locale === "fr" ? " · Hors échelle" : " · Outside scale") : ""}`
    : locale === "fr"
      ? "Durée indisponible"
      : "Elapsed unavailable";
  const description =
    locale === "fr"
      ? "1 000 durées terminées fictives"
      : "1,000 synthetic completed durations";
  const referenceLabel =
    locale === "fr"
      ? "Référence des durées terminées"
      : "Completed-duration reference";
  const distributionLabel = bins
    .map(
      ({ from, to, count }) =>
        `${format(from)}–${format(to)} h: ${format(count)}`,
    )
    .join("; ");

  return (
    <div className={styles.root}>
      <figure
        className={styles.figure}
        aria-label={
          locale === "fr" ? "Référence de durée" : "Duration reference"
        }
      >
        {visibleRegions.length > 0 && (
          <div className={styles.regionLabels} aria-hidden="true">
            {visibleRegions.map((region) => (
              <span
                key={region.from}
                className={styles.regionLabel}
                style={{ width: regionWidth(region) }}
              >
                {region.shortLabel}
                <small>{rangeLabel(region)}</small>
              </span>
            ))}
          </div>
        )}
        <div
          className={styles.plot}
          data-has-regions={visibleRegions.length > 0}
          role="img"
          aria-label={`${valueLabel}. ${rangesLabel}${referenceLabel}: P50: 9 h. P90: 18 h. 0–30 h.`}
        >
          <div className={styles.track} aria-hidden="true">
            {visibleRegions.map((region) => (
              <span
                key={region.from}
                className={styles.region}
                data-assessment={region.assessment}
                style={{
                  left: `${(Math.max(0, region.from) / max) * 100}%`,
                  width: regionWidth(region),
                }}
              />
            ))}
          </div>
          {landmarks.map(({ label, value: landmark }) => (
            <span
              key={label}
              className={styles.percentile}
              style={{ left: `${(landmark / max) * 100}%` }}
              aria-hidden="true"
            />
          ))}
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
        <Scale format={format} />
        {visibleRegions.length > 0 && (
          <div className={styles.compactRegions} aria-hidden="true">
            {visibleRegions.map((region) => (
              <span key={region.from} data-assessment={region.assessment}>
                <span>{region.shortLabel}</span>
                <span>{rangeLabel(region)}</span>
              </span>
            ))}
          </div>
        )}
        {!inRange && (
          <figcaption className={styles.valueState}>{valueLabel}</figcaption>
        )}
      </figure>
      <details className={styles.disclosure}>
        <summary>
          {locale === "fr"
            ? "Distribution de référence"
            : "Reference distribution"}
        </summary>
        <figure className={styles.distribution}>
          <figcaption>
            <Text as="span" variant="caption" color="subdued">
              {description}
            </Text>
          </figcaption>
          <div
            className={styles.histogram}
            role="img"
            aria-label={`${description}. P50: 9 h. P90: 18 h. ${distributionLabel}.`}
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
            {landmarks.map(({ label, value: landmark }) => (
              <span
                key={label}
                className={styles.histogramPercentile}
                style={{ left: `${(landmark / max) * 100}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
          <Scale format={format} />
        </figure>
      </details>
    </div>
  );
}
