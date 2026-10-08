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

const total = samples.reduce((sum, [, count]) => sum + count, 0);
let runningCount = 0;
const cumulative = [
  { duration: 0, fraction: 0 },
  ...samples.map(([duration, count]) => {
    runningCount += count;
    return { duration, fraction: runningCount / total };
  }),
  { duration: max, fraction: 1 },
];
const curvePath = cumulative
  .map(
    ({ duration, fraction }, index) =>
      `${index ? "L" : "M"} ${(duration / max) * 300} ${100 - fraction * 100}`,
  )
  .join(" ");
function fractionAt(duration: number) {
  const nextIndex = cumulative.findIndex((point) => point.duration >= duration);
  if (nextIndex <= 0) return nextIndex === 0 ? 0 : 1;
  const previous = cumulative[nextIndex - 1],
    next = cumulative[nextIndex];
  return (
    previous.fraction +
    ((next.fraction - previous.fraction) * (duration - previous.duration)) /
      (next.duration - previous.duration)
  );
}
export type ReferenceVisualization =
  "cumulative" | "histogram" | "both" | "none";

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
  currentAssessment,
  section = "all",
  visualization = "cumulative",
  showDistribution = true,
}: {
  value: number | null;
  locale?: "en" | "fr";
  regions?: readonly DurationHealthRegion[];
  currentAssessment?: HealthIndicatorAssessment;
  section?: "all" | "primary" | "details";
  visualization?: ReferenceVisualization;
  showDistribution?: boolean;
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

  if (visualization === "none") return null;
  const hasCurve = visualization === "cumulative" || visualization === "both";
  const showCurve = hasCurve && section !== "details";
  const regionHeader = visibleRegions.length > 0 && (
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
  );
  const regionLegend = visibleRegions.length > 0 && (
    <div className={styles.compactRegions} aria-hidden="true">
      {visibleRegions.map((region) => (
        <span key={region.from} data-assessment={region.assessment}>
          <span>{region.shortLabel}</span>
          <span>{rangeLabel(region)}</span>
        </span>
      ))}
    </div>
  );
  const histogram = (
    <figure className={styles.distribution}>
      <figcaption>
        <Text as="span" variant="caption" color="subdued">
          {description}
        </Text>
      </figcaption>
      {!hasCurve && regionHeader}
      <div
        className={styles.histogram}
        role="img"
        aria-label={`${description}. ${rangesLabel}P50: 9 h. P90: 18 h. ${distributionLabel}.`}
      >
        <div className={styles.track} aria-hidden="true">
          {visibleRegions.map((region) => (
            <span
              key={region.from}
              className={styles.region}
              data-assessment={region.assessment}
              style={{
                left: `${(region.from / max) * 100}%`,
                width: regionWidth(region),
              }}
            />
          ))}
        </div>
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
      {!hasCurve && regionLegend}
    </figure>
  );

  return (
    <div className={styles.root}>
      {showCurve && (
        <figure
          className={styles.figure}
          aria-label={
            locale === "fr" ? "Référence de durée" : "Duration reference"
          }
        >
          {regionHeader}
          <div
            className={styles.plot}
            data-has-regions={visibleRegions.length > 0}
            role="img"
            aria-label={`${valueLabel}. ${rangesLabel}${referenceLabel}: ${locale === "fr" ? "Pourcentage terminé" : "Percentage completed"}. P50: 9 h, 50%. P90: 18 h, 90%. 0–30 h. ${locale === "fr" ? "Interpolation entre les observations fictives" : "Interpolated between synthetic observations"}.`}
          >
            <span className={styles.yTitle} aria-hidden="true">
              {locale === "fr" ? "Historique (%)" : "Historical (%)"}
            </span>
            <div className={styles.yAxis} aria-hidden="true">
              <span>100</span>
              <span>50</span>
              <span>0</span>
            </div>
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
            <svg
              className={styles.curve}
              viewBox="0 0 300 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={curvePath} />
              {landmarks.map(({ label, value: landmark }) => (
                <circle
                  key={label}
                  cx={(landmark / max) * 300}
                  cy={100 - fractionAt(landmark) * 100}
                  r="2"
                />
              ))}
            </svg>
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
                data-current-assessment={currentAssessment ?? "unassessed"}
                style={{ left: `${(value / max) * 100}%` }}
                aria-hidden="true"
              >
                <span
                  className={styles.marker}
                  style={{
                    top: `calc(${(1 - fractionAt(value)) * 100}% - 4px)`,
                  }}
                />
              </span>
            )}
          </div>
          <Scale format={format} />
          {regionLegend}
          {!inRange && (
            <figcaption className={styles.valueState}>{valueLabel}</figcaption>
          )}
        </figure>
      )}
      {((visualization === "histogram" && section !== "details") ||
        (visualization === "both" && section !== "primary")) &&
        histogram}
      {visualization === "cumulative" &&
        showDistribution &&
        section !== "primary" && (
          <details className={styles.disclosure}>
            <summary>
              {locale === "fr"
                ? "Distribution de référence"
                : "Reference distribution"}
            </summary>
            {histogram}
          </details>
        )}
    </div>
  );
}
