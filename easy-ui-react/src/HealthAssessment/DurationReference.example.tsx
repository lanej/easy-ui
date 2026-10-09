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

function regionAt(regions: readonly DurationHealthRegion[], value: number) {
  return regions.find(({ from, to }) => value >= from && value < to);
}

function Scale({
  format,
  regions,
  showThresholds,
  showPercentileLabels,
}: {
  format: (value: number) => string;
  regions: readonly DurationHealthRegion[];
  showThresholds: boolean;
  showPercentileLabels: boolean;
}) {
  const thresholds = showThresholds
    ? regions
        .map(({ from }) => from)
        .filter((value) => value > 0 && value < max)
    : [];
  return (
    <div
      className={styles.scale}
      data-has-thresholds={thresholds.length > 0}
      data-has-percentile-labels={showPercentileLabels}
      aria-hidden="true"
    >
      <span className={styles.endpoint}>0 h</span>
      {showPercentileLabels &&
        landmarks.map(({ label, value }) => (
          <span
            key={label}
            className={styles.percentileLabel}
            data-percentile={label}
            data-reference-assessment={
              regionAt(regions, value)?.assessment ?? "unassessed"
            }
            style={{ left: `${(value / max) * 100}%` }}
          >
            {label}
            <strong>{format(value)} h</strong>
          </span>
        ))}
      <span className={styles.endpoint} data-end="true">
        {max} h
      </span>
      {thresholds.map((value) => (
        <span
          key={value}
          className={styles.thresholdLabel}
          style={{ left: `${(value / max) * 100}%` }}
        >
          {format(value)} h
        </span>
      ))}
    </div>
  );
}

/** Bars and the curve share duration coordinates; their vertical scales differ. */
function HistogramBars({
  regions,
  format,
}: {
  regions: readonly DurationHealthRegion[];
  format: (value: number) => string;
}) {
  return (
    <svg
      className={styles.histogramBars}
      viewBox="0 0 300 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {bins.map(({ from, to, count }) => {
        const left = from + 0.05,
          right = to - 0.05;
        const edges = [
          ...new Set([
            left,
            right,
            ...regions
              .flatMap((region) => [region.from, region.to])
              .filter((edge) => edge > left && edge < right),
          ]),
        ].sort((a, b) => a - b);
        return (
          <g
            key={from}
            data-bin-from={from}
            data-bin-to={to}
            data-bin-count={count}
          >
            <title>{`${format(from)}–${format(to)} h: ${format(count)} observations`}</title>
            {edges.slice(0, -1).map((start, index) => {
              const end = edges[index + 1];
              return (
                <rect
                  key={start}
                  className={styles.bin}
                  data-reference-assessment={
                    regionAt(regions, (start + end) / 2)?.assessment ??
                    "unassessed"
                  }
                  data-segment-from={start}
                  data-segment-to={end}
                  x={(start / max) * 300}
                  y={100 - (count / peak) * 100}
                  width={((end - start) / max) * 300}
                  height={(count / peak) * 100}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** Story-only composition of caller-supplied assessment ranges and reference data. */
export function DurationReferenceExample({
  value,
  locale = "en",
  regions = [],
  currentAssessment,
  section = "all",
  visualization = "cumulative",
  showDistribution = true,
  showHealthBands = true,
  showHealthBandLabels = false,
  showPercentiles = true,
  showPercentileLabels = false,
  showCountAxis = false,
  showSampleCount = false,
}: {
  value: number | null;
  locale?: "en" | "fr";
  regions?: readonly DurationHealthRegion[];
  currentAssessment?: HealthIndicatorAssessment;
  section?: "all" | "primary" | "details";
  visualization?: ReferenceVisualization;
  showDistribution?: boolean;
  showHealthBands?: boolean;
  showHealthBandLabels?: boolean;
  showPercentiles?: boolean;
  showPercentileLabels?: boolean;
  showCountAxis?: boolean;
  showSampleCount?: boolean;
}) {
  if (visualization === "none" || section === "details") return null;
  const valid =
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const inRange = valid && value <= max;
  const format = (number: number) =>
    new Intl.NumberFormat(locale).format(number);
  const visibleRegions = regions.filter(({ from, to }) => from < max && to > 0);
  const bands = showHealthBands ? visibleRegions : [];
  const regionWidth = ({ from, to }: DurationHealthRegion) =>
    `${((Math.min(max, to) - Math.max(0, from)) / max) * 100}%`;
  const rangeLabel = ({ from, to }: DurationHealthRegion) =>
    Number.isFinite(to)
      ? `${from > 0 ? `${format(from)}–` : ""}<${format(to)} h`
      : `≥${format(from)} h`;
  const rangesLabel = regions.length
    ? `${locale === "fr" ? "Plages d’évaluation illustratives" : "Illustrative assessment ranges"}: ${regions.map((region) => `${region.label}: ${rangeLabel(region)}`).join("; ")}. `
    : "";
  const valueLabel = valid
    ? `${locale === "fr" ? "Écoulé" : "Elapsed"}: ${format(value)} h${value > max ? (locale === "fr" ? " · Hors échelle" : " · Outside scale") : ""}`
    : locale === "fr"
      ? "Durée indisponible"
      : "Elapsed unavailable";
  const percentileDescription = showPercentiles
    ? landmarks
        .map(
          ({ label, value }) =>
            `${label}: ${format(value)} h${regionAt(regions, value) ? `, ${regionAt(regions, value)?.label}` : ""}`,
        )
        .join(". ") + ". "
    : "";
  const referenceLabel =
    locale === "fr"
      ? "Référence des durées terminées"
      : "Completed-duration reference";
  const hasCurve = visualization !== "histogram";
  const hasHistogram =
    visualization === "histogram" ||
    visualization === "both" ||
    showDistribution;
  const distributionLabel = hasHistogram
    ? `${locale === "fr" ? "Nombre par intervalle" : "Count per interval"}: ${bins.map(({ from, to, count }) => `${format(from)}–${format(to)} h: ${format(count)}`).join("; ")}. `
    : "";
  const description =
    locale === "fr"
      ? "1 000 durées terminées fictives"
      : "1,000 synthetic completed durations";
  return (
    <div
      className={styles.root}
      data-section={section}
      data-percentiles={
        showPercentiles ? (showPercentileLabels ? "labeled" : "points") : "none"
      }
      data-visualization={
        hasCurve ? (hasHistogram ? "overlay" : "cumulative") : "histogram"
      }
    >
      <figure
        className={styles.figure}
        data-has-count-axis={hasHistogram && showCountAxis}
        aria-label={referenceLabel}
      >
        {showSampleCount && (
          <figcaption className={styles.sampleCount}>
            <Text as="p" variant="caption" color="subdued">
              {description}
            </Text>
          </figcaption>
        )}
        {showHealthBandLabels && bands.length > 0 && (
          <div className={styles.regionLabels} aria-hidden="true">
            {bands.map((region) => (
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
          data-has-count-axis={hasHistogram && showCountAxis}
          title={referenceLabel}
          role="img"
          aria-label={`${valueLabel}. ${rangesLabel}${referenceLabel}. ${hasCurve ? (locale === "fr" ? "Pourcentage cumulé terminé. " : "Cumulative percentage completed. ") : ""}${percentileDescription}${distributionLabel}0–30 h. ${description}.`}
        >
          <div className={styles.track} aria-hidden="true">
            {bands.map((region) => (
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
          {hasHistogram && <HistogramBars regions={regions} format={format} />}
          {hasCurve && (
            <svg
              className={styles.curve}
              viewBox="0 0 300 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={curvePath} />
            </svg>
          )}
          {showPercentiles &&
            landmarks.map(({ label, value: landmark }) => (
              <span
                key={label}
                className={hasCurve ? styles.curvePoint : styles.histogramPoint}
                data-percentile={label}
                data-reference-assessment={
                  regionAt(regions, landmark)?.assessment ?? "unassessed"
                }
                style={{
                  left: `${(landmark / max) * 100}%`,
                  top: hasCurve
                    ? `${100 - fractionAt(landmark) * 100}%`
                    : undefined,
                }}
                title={`${label}: ${format(landmark)} h${regionAt(regions, landmark) ? ` · ${regionAt(regions, landmark)?.label}` : ""}`}
                aria-hidden="true"
              />
            ))}
          {showPercentiles &&
            showPercentileLabels &&
            landmarks.map(({ label, value: landmark }) => (
              <span
                key={label}
                className={styles.percentile}
                data-percentile={label}
                data-reference-assessment={
                  regionAt(regions, landmark)?.assessment ?? "unassessed"
                }
                style={{ left: `${(landmark / max) * 100}%` }}
                aria-hidden="true"
              />
            ))}
          {hasCurve && inRange && (
            <span
              className={styles.elapsed}
              data-current-assessment={currentAssessment ?? "unassessed"}
              style={{ left: `${(value / max) * 100}%` }}
              aria-hidden="true"
            >
              <span
                className={styles.marker}
                style={{ top: `calc(${100 - fractionAt(value) * 100}% - 4px)` }}
              />
            </span>
          )}
          {hasHistogram && showCountAxis && (
            <div className={styles.countAxis} aria-hidden="true">
              <span className={styles.countTitle}>
                {locale === "fr" ? "Nombre" : "Count"}
              </span>
              {[peak, (peak * 2) / 3, peak / 3, 0].map((count) => (
                <span
                  className={styles.countTick}
                  key={count}
                  data-end={
                    count === 0 ? "bottom" : count === peak ? "top" : undefined
                  }
                  style={{ top: `${100 - (count / peak) * 100}%` }}
                >
                  {format(count)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div
          className={styles.axisFrame}
          data-has-count-axis={hasHistogram && showCountAxis}
        >
          <Scale
            format={format}
            regions={regions}
            showThresholds={showHealthBands && !showHealthBandLabels}
            showPercentileLabels={showPercentiles && showPercentileLabels}
          />
        </div>
        {showHealthBandLabels && bands.length > 0 && (
          <div className={styles.compactRegions} aria-hidden="true">
            {bands.map((region) => (
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
    </div>
  );
}

/** Story-only reference metrics supplied through the observationDetails slot. */
export function DurationPercentileMetrics({
  locale = "en",
  regions = [],
}: {
  locale?: "en" | "fr";
  regions?: readonly DurationHealthRegion[];
}) {
  return (
    <dl
      className={styles.metrics}
      aria-label={
        locale === "fr" ? "Percentiles de référence" : "Reference percentiles"
      }
    >
      {landmarks.map(({ label, value }) => (
        <div
          key={label}
          data-percentile={label}
          data-reference-assessment={
            regionAt(regions, value)?.assessment ?? "unassessed"
          }
          title={regionAt(regions, value)?.label}
        >
          <dt>
            <span className={styles.legendDot} aria-hidden="true" />
            {label}
          </dt>
          <dd>
            {new Intl.NumberFormat(locale).format(value)} <span>h</span>
            {regionAt(regions, value) && (
              <span className={styles.srOnly}>
                {" "}
                · {regionAt(regions, value)?.label}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
