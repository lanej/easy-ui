import React, { type CSSProperties, type ReactNode } from "react";
import { Text } from "../Text";
import type { HealthIndicatorAssessment } from "../HealthIndicator";
import { position } from "../visualization/geometry";
import {
  observationState,
  observationLabel,
  plottedObservation,
  type OverflowPolicy,
} from "../visualization/valueState";
import {
  validDurationDomain,
  validQuantiles,
  validHistogram,
  validCumulative,
  validHealthRegions,
  regionAt,
  cumulativeFractionAt,
  clippedCumulative,
  type DurationQuantile,
  type DurationHistogramBin,
  type DurationCumulativePoint,
  type DurationHealthRegion,
} from "./model";
import styles from "./DurationDistribution.module.scss";
import { HistogramReference } from "./HistogramReference";

const defaultLabels = {
  elapsed: "Elapsed",
  currentAssessment: "Current assessment",
  healthy: "Healthy",
  degraded: "Degraded",
  unhealthy: "Unhealthy",
  missingValue: "Elapsed unavailable",
  invalidValue: "Invalid elapsed duration",
  outsideScale: "Outside scale",
  referenceOutsideScale: "Reference extends outside scale",
  invalidScale: "Invalid duration scale",
  missingReference: "Reference unavailable",
  invalidQuantiles: "Invalid quantiles",
  invalidHistogram: "Invalid histogram",
  invalidCumulative: "Invalid cumulative reference",
  invalidHealthRegions: "Invalid health ranges",
  invalidSampleCount: "Invalid sample count",
  emptyDistribution: "No completed observations",
  count: "Count",
  smoothedDensity: "Smoothed histogram density",
  concentration: "Reference concentration",
  observations: "completed observations",
  referenceValues: "Reference values",
  cumulative: "Cumulative percentage completed",
  quantiles: "Reference percentiles",
  loading: "Loading…",
};
export type DurationDistributionLabels = Partial<typeof defaultLabels>;
export type DurationDistributionProps = {
  /** Ongoing elapsed duration, distinct from the completed reference. Null is unavailable. */
  value: number | null;
  /** Finite nonnegative increasing viewport bounds, in the supplied unit. */
  domain: readonly [number, number];
  /** Exact caller-supplied unit; no conversion occurs. */
  unit: string;
  label?: string;
  /** Context and provenance supplied by the application, visible when provided. */
  description?: ReactNode;
  cohort?: string;
  sampleCount?: number | null;
  /** Ordered fractions [0,1] with nondecreasing durations; no density is inferred. */
  quantiles?: readonly DurationQuantile[] | null;
  /** Ordered, disjoint, half-open intervals and nonnegative integer counts. */
  bins?: readonly DurationHistogramBin[] | null;
  /** Ordered values and nondecreasing fractions [0,1]. Nothing is inferred from quantiles. */
  cumulative?: readonly DurationCumulativePoint[] | null;
  /** How supplied cumulative points are joined; no extrapolation outside their coverage. */
  interpolation?: "linear" | "step";
  /** Auto shows supplied sources; points draws only quantile landmarks. */
  visualization?: "auto" | "cumulative" | "histogram" | "both" | "points";
  /** Histogram bars or an explicitly smoothed count-per-unit density curve. */
  distributionStyle?: "binned" | "smooth";
  /** Full distribution plot or a compact bar whose intensity represents relative density. */
  distributionPresentation?: "plot" | "concentration";
  /** Supplied policy, separate from percentile rank. Intervals are [from,to). */
  healthRegions?: readonly DurationHealthRegion[];
  /** Shade only the current value's policy region by default; "all" colors every region. */
  healthRegionHighlight?: "current" | "all";
  currentAssessment?: HealthIndicatorAssessment;
  /** Outside values retain exact text; their markers are omitted unless clamp is explicit. */
  overflow?: OverflowPolicy;
  formatValue?: (value: number) => string;
  formatCount?: (count: number) => string;
  formatQuantileLabel?: (fraction: number) => string;
  /** Hide the visual scale for compact inline references; domain and quantiles remain accessible. */
  showScale?: boolean;
  showHealthBands?: boolean;
  showHealthBandLabels?: boolean;
  showPercentiles?: boolean;
  showPercentileLabels?: boolean;
  showCountAxis?: boolean;
  showSampleCount?: boolean;
  /** Optional native disclosure of exact supplied data; independent of the graph. */
  showDataTable?: boolean;
  /** Fill a composed reference column while preserving a 100px plot minimum. */
  stretch?: boolean;
  isLoading?: boolean;
  labels?: DurationDistributionLabels;
};

/** A native duration reference plot. Applications supply data, meaning, and assessment. */
export function DurationDistribution({
  value,
  domain,
  unit,
  label = "Completed-duration reference",
  description,
  cohort,
  sampleCount,
  quantiles = [],
  bins = [],
  cumulative = [],
  interpolation = "linear",
  visualization = "auto",
  distributionStyle = "binned",
  distributionPresentation = "plot",
  healthRegions = [],
  healthRegionHighlight = "current",
  currentAssessment,
  overflow = "omit",
  formatValue = String,
  formatCount = String,
  formatQuantileLabel = (fraction) => `P${fraction * 100}`,
  showScale = true,
  showHealthBands = true,
  showHealthBandLabels = false,
  showPercentiles = true,
  showPercentileLabels = false,
  showCountAxis = false,
  showSampleCount = false,
  showDataTable = false,
  stretch = true,
  isLoading = false,
  labels,
}: DurationDistributionProps) {
  const text = { ...defaultLabels, ...labels };
  const format = (n: number) => `${formatValue(n)} ${unit}`;
  const validScale = validDurationDomain(domain);
  const quantileData = quantiles ?? [],
    binData = bins ?? [],
    cumulativeData = cumulative ?? [];
  const quantilesValid = validQuantiles(quantileData),
    binsValid = validHistogram(binData);
  const cumulativeValid =
    cumulativeData.length !== 1 && validCumulative(cumulativeData);
  const regionsValid = validHealthRegions(healthRegions);
  const regions = regionsValid ? healthRegions : [];
  const marks = quantilesValid ? quantileData : [];
  const hasHistogram =
    binsValid &&
    binData.some((b) => b.count > 0) &&
    ["auto", "both", "histogram"].includes(visualization);
  const hasCurve =
    cumulativeValid &&
    cumulativeData.length > 1 &&
    ["auto", "both", "cumulative"].includes(visualization);
  const missingReference =
    !quantileData.length && !binData.length && !cumulativeData.length;
  const peak = Math.max(
    1,
    ...binData.filter((b) => Number.isFinite(b.count)).map((b) => b.count),
  );
  const sampleValid =
    sampleCount == null ||
    (Number.isSafeInteger(sampleCount) && sampleCount >= 0);
  const state = observationState(value, validScale ? domain : undefined, 0);
  const currentRegion =
    value !== null && (state === "valid" || state === "out-of-domain")
      ? regionAt(regions, value)
      : undefined;
  const highlightedRegions =
    healthRegionHighlight === "all"
      ? regions
      : currentRegion
        ? [currentRegion]
        : [];
  const valueText = observationLabel(value, state, format, {
    missing: text.missingValue,
    invalid: text.invalidValue,
    outside: text.outsideScale,
  });
  const assessmentText =
    (state === "valid" || state === "out-of-domain") && currentAssessment
      ? text[currentAssessment]
      : null;
  const currentDescription = [
    `${text.elapsed}: ${valueText}`,
    assessmentText && `${text.currentAssessment}: ${assessmentText}`,
  ]
    .filter(Boolean)
    .join(". ");
  const current = validScale
    ? plottedObservation(value, state, domain, overflow)
    : null;
  const offset = (n: number) => `${position(n, domain) * 100}%`;
  const inDomain = (n: number) => n >= domain[0] && n <= domain[1];
  const visibleRegions = validScale
    ? regions.filter((r) => r.from < domain[1] && r.to > domain[0])
    : [];
  const bands = showHealthBands ? visibleRegions : [];
  const thresholds =
    showHealthBands && !showHealthBandLabels
      ? [...new Set(regions.flatMap((r) => [r.from, r.to]))]
          .filter((n) => n > domain[0] && n < domain[1])
          .sort((a, b) => a - b)
      : [];
  const range = (r: DurationHealthRegion) =>
    r.to === Infinity
      ? `≥${format(r.from)}`
      : `${formatValue(r.from)}–<${format(r.to)}`;
  const markLabel = (q: DurationQuantile) =>
    q.label ?? formatQuantileLabel(q.fraction);
  const markDescription = (q: DurationQuantile) =>
    `${markLabel(q)}: ${format(q.value)}${regionAt(regions, q.value) ? ` · ${regionAt(regions, q.value)?.label}` : ""}${validScale && !inDomain(q.value) ? ` · ${text.outsideScale}` : ""}`;
  const countAxis =
    hasHistogram &&
    showCountAxis &&
    distributionStyle === "binned" &&
    distributionPresentation === "plot";
  const curvePoints =
    validScale && hasCurve
      ? clippedCumulative(cumulativeData, domain, interpolation)
      : [];
  const curvePath = curvePoints
    .map((p, i) => {
      const x = position(p.value, domain) * 300,
        y = 100 - p.fraction * 100;
      return !i
        ? `M ${x} ${y}`
        : interpolation === "step"
          ? `H ${x} V ${y}`
          : `L ${x} ${y}`;
    })
    .join(" ");
  const currentFraction =
    current !== null && hasCurve
      ? cumulativeFractionAt(cumulativeData, current, interpolation)
      : null;
  const problems = [
    !validScale && text.invalidScale,
    !quantilesValid && text.invalidQuantiles,
    !binsValid && text.invalidHistogram,
    !cumulativeValid && text.invalidCumulative,
    !regionsValid && text.invalidHealthRegions,
    !sampleValid && text.invalidSampleCount,
    missingReference && text.missingReference,
    binsValid &&
      binData.length > 0 &&
      binData.every((b) => b.count === 0) &&
      text.emptyDistribution,
  ].filter(Boolean);
  const plotDescription = [
    currentDescription,
    label,
    cohort,
    validScale && `${format(domain[0])}–${format(domain[1])}`,
    hasCurve &&
      `${text.cumulative}: ${cumulativeData.map((p) => `${format(p.value)}: ${formatCount(p.fraction * 100)}%`).join("; ")}`,
    hasHistogram && distributionStyle === "smooth" && text.smoothedDensity,
    hasHistogram &&
      distributionPresentation === "concentration" &&
      text.concentration,
    showPercentiles && marks.map(markDescription).join("; "),
    hasHistogram &&
      `${text.count}: ${binData.map((b) => `${formatValue(b.from)}–${format(b.to)}: ${formatCount(b.count)}`).join("; ")}`,
    regions.map((r) => `${r.label}: ${range(r)}`).join("; "),
    sampleValid &&
      sampleCount != null &&
      `${formatCount(sampleCount)} ${text.observations}`,
  ]
    .filter(Boolean)
    .join(". ");
  if (isLoading)
    return (
      <div className={styles.root} aria-busy="true">
        <span role="status">{text.loading}</span>
      </div>
    );
  return (
    <div
      className={styles.root}
      data-stretch={stretch}
      data-distribution-style={distributionStyle}
      data-concentration={
        hasHistogram && distributionPresentation === "concentration"
      }
      data-percentiles={
        showPercentiles ? (showPercentileLabels ? "labeled" : "points") : "none"
      }
      data-visualization={
        hasCurve
          ? hasHistogram
            ? "overlay"
            : "cumulative"
          : hasHistogram && distributionPresentation === "plot"
            ? "histogram"
            : "points"
      }
      style={
        {
          "--count-gutter": `${Math.max(48, formatCount(peak).length * 6 + 18)}px`,
        } as CSSProperties
      }
    >
      <figure
        className={styles.figure}
        aria-label={label}
        data-has-count-axis={countAxis}
      >
        {(description != null ||
          cohort ||
          (showSampleCount && sampleValid && sampleCount != null)) && (
          <figcaption className={styles.sampleCount}>
            {cohort && (
              <Text as="p" variant="caption" color="subdued">
                {cohort}
              </Text>
            )}
            {description}
            {showSampleCount && sampleValid && sampleCount != null && (
              <Text as="p" variant="caption" color="subdued">
                {formatCount(sampleCount)} {text.observations}
              </Text>
            )}
          </figcaption>
        )}
        {problems.map((problem, i) => (
          <p className={styles.valueState} key={i}>
            {problem}
          </p>
        ))}
        {validScale && (
          <>
            {showHealthBandLabels && bands.length > 0 && (
              <div className={styles.regionLabels} aria-hidden="true">
                {bands.map((r) => (
                  <span
                    key={r.from}
                    className={styles.regionLabel}
                    style={{
                      width: `${(position(Math.min(domain[1], r.to), domain) - position(Math.max(domain[0], r.from), domain)) * 100}%`,
                      left: offset(Math.max(domain[0], r.from)),
                    }}
                  >
                    {r.shortLabel ?? r.label}
                    <small>{range(r)}</small>
                  </span>
                ))}
              </div>
            )}
            <div
              className={styles.plot}
              role="img"
              aria-label={plotDescription}
              data-has-count-axis={countAxis}
            >
              <div className={styles.track} aria-hidden="true">
                {bands
                  .filter((r) => highlightedRegions.includes(r))
                  .map((r) => (
                    <span
                      key={r.from}
                      className={styles.region}
                      data-assessment={r.assessment}
                      style={{
                        left: offset(Math.max(domain[0], r.from)),
                        width: `${(position(Math.min(domain[1], r.to), domain) - position(Math.max(domain[0], r.from), domain)) * 100}%`,
                      }}
                    />
                  ))}
              </div>
              {hasHistogram &&
                (distributionStyle === "smooth" ||
                  distributionPresentation === "concentration") && (
                  <HistogramReference
                    bins={binData}
                    domain={domain}
                    regions={highlightedRegions}
                    style={distributionStyle}
                    presentation={distributionPresentation}
                  />
                )}
              {hasHistogram &&
                distributionStyle === "binned" &&
                distributionPresentation === "plot" && (
                  <svg
                    className={styles.histogramBars}
                    viewBox="0 0 300 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {binData
                      .filter((b) => b.from < domain[1] && b.to > domain[0])
                      .map((b) => {
                        const from = Math.max(b.from, domain[0]),
                          to = Math.min(b.to, domain[1]);
                        const gap = Math.min(
                          (to - from) / 4,
                          (domain[1] - domain[0]) / 600,
                        );
                        const left = from + gap,
                          right = to - gap;
                        const edges = [
                          ...new Set([
                            left,
                            right,
                            ...highlightedRegions
                              .flatMap((r) => [r.from, r.to])
                              .filter((n) => n > left && n < right),
                          ]),
                        ].sort((a, b) => a - b);
                        return (
                          <g
                            key={b.from}
                            data-bin-from={b.from}
                            data-bin-to={b.to}
                            data-bin-count={b.count}
                          >
                            <title>{`${formatValue(b.from)}–${format(b.to)}: ${formatCount(b.count)} ${text.observations}`}</title>
                            {edges.slice(0, -1).map((start, i) => (
                              <rect
                                key={start}
                                className={styles.bin}
                                data-segment-from={start}
                                data-segment-to={edges[i + 1]}
                                data-reference-assessment={
                                  regionAt(highlightedRegions, start)
                                    ?.assessment ?? "unassessed"
                                }
                                x={position(start, domain) * 300}
                                y={100 - (b.count / peak) * 100}
                                width={
                                  (position(edges[i + 1], domain) -
                                    position(start, domain)) *
                                  300
                                }
                                height={(b.count / peak) * 100}
                              />
                            ))}
                          </g>
                        );
                      })}
                  </svg>
                )}
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
                marks.map((q) => {
                  const projected = plottedObservation(
                    q.value,
                    observationState(q.value, domain, 0),
                    domain,
                    overflow,
                  );
                  if (projected === null) return null;
                  return (
                    <React.Fragment key={q.fraction}>
                      <span
                        className={
                          hasCurve ? styles.curvePoint : styles.histogramPoint
                        }
                        data-percentile={markLabel(q)}
                        data-reference-assessment={
                          regionAt(regions, q.value)?.assessment ?? "unassessed"
                        }
                        data-overflow={!inDomain(q.value)}
                        style={{
                          left: offset(projected),
                          top: hasCurve
                            ? `${100 - q.fraction * 100}%`
                            : undefined,
                        }}
                        title={markDescription(q)}
                        aria-hidden="true"
                      />
                      {showPercentileLabels && (
                        <span
                          className={styles.percentile}
                          data-percentile={markLabel(q)}
                          data-reference-assessment={
                            regionAt(regions, q.value)?.assessment ??
                            "unassessed"
                          }
                          style={{ left: offset(projected) }}
                          aria-hidden="true"
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              {current !== null && (
                <span
                  className={styles.elapsed}
                  data-current-assessment={currentAssessment ?? "unassessed"}
                  data-overflow={state === "out-of-domain"}
                  style={{ left: offset(current) }}
                  title={currentDescription}
                  aria-hidden="true"
                >
                  {(!hasCurve || currentFraction !== null) && (
                    <span
                      className={styles.marker}
                      style={{
                        top: `calc(${hasCurve ? 100 - (currentFraction ?? 0) * 100 : 100}% - 4px)`,
                      }}
                    />
                  )}
                </span>
              )}
              {countAxis && (
                <div className={styles.countAxis} aria-hidden="true">
                  <span className={styles.countTitle}>{text.count}</span>
                  {[
                    ...new Set([
                      peak,
                      Math.round((peak * 2) / 3),
                      Math.round(peak / 3),
                      0,
                    ]),
                  ].map((count) => (
                    <span
                      key={count}
                      className={styles.countTick}
                      data-end={
                        count === 0
                          ? "bottom"
                          : count === peak
                            ? "top"
                            : undefined
                      }
                      style={{ top: `${100 - (count / peak) * 100}%` }}
                    >
                      {formatCount(count)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {showScale && (
              <div className={styles.axisFrame} data-has-count-axis={countAxis}>
                <div
                  className={styles.scale}
                  data-has-thresholds={thresholds.length > 0}
                  data-has-percentile-labels={
                    showPercentiles && showPercentileLabels
                  }
                  aria-hidden="true"
                >
                  {!(
                    showPercentiles &&
                    showPercentileLabels &&
                    marks.some((q) => q.value === domain[0])
                  ) && (
                    <span className={styles.endpoint}>{format(domain[0])}</span>
                  )}
                  {!(
                    showPercentiles &&
                    showPercentileLabels &&
                    marks.some((q) => q.value === domain[1])
                  ) && (
                    <span className={styles.endpoint} data-end="true">
                      {format(domain[1])}
                    </span>
                  )}
                  {showPercentiles &&
                    showPercentileLabels &&
                    marks
                      .filter((q) => inDomain(q.value))
                      .map((q) => (
                        <span
                          key={q.fraction}
                          className={styles.percentileLabel}
                          data-percentile={markLabel(q)}
                          data-reference-assessment={
                            regionAt(regions, q.value)?.assessment ??
                            "unassessed"
                          }
                          data-edge={
                            q.value === domain[0]
                              ? "start"
                              : q.value === domain[1]
                                ? "end"
                                : undefined
                          }
                          style={{ left: offset(q.value) }}
                        >
                          {markLabel(q)}
                          <strong>{format(q.value)}</strong>
                        </span>
                      ))}
                  {thresholds.map((n) => (
                    <span
                      key={n}
                      className={styles.thresholdLabel}
                      style={{ left: offset(n) }}
                    >
                      {format(n)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {showHealthBandLabels && bands.length > 0 && (
              <div className={styles.compactRegions} aria-hidden="true">
                {bands.map((r) => (
                  <span
                    key={r.from}
                    data-assessment={r.assessment}
                    data-highlighted={highlightedRegions.includes(r)}
                  >
                    <span>{r.shortLabel ?? r.label}</span>
                    <span>{range(r)}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {(state !== "valid" || !validScale) && (
          <p className={styles.valueState}>
            {text.elapsed}: {valueText}
          </p>
        )}
        {validScale &&
          ((hasHistogram &&
            binData.some((b) => b.from < domain[0] || b.to > domain[1])) ||
            (hasCurve && cumulativeData.some((p) => !inDomain(p.value)))) && (
            <p className={styles.valueState}>{text.referenceOutsideScale}</p>
          )}
        {validScale && marks.some((q) => !inDomain(q.value)) && (
          <div className={styles.valueState}>
            {marks
              .filter((q) => !inDomain(q.value))
              .map((q) => (
                <p key={q.fraction}>{markDescription(q)}</p>
              ))}
          </div>
        )}
      </figure>
      {showDataTable && (
        <details className={styles.exactData}>
          <summary>{text.referenceValues}</summary>
          <dl>
            <dt>{text.elapsed}</dt>
            <dd>{valueText}</dd>
            {assessmentText && (
              <>
                <dt>{text.currentAssessment}</dt>
                <dd>{assessmentText}</dd>
              </>
            )}
            {quantilesValid &&
              marks.map((q) => (
                <React.Fragment key={q.fraction}>
                  <dt>{markLabel(q)}</dt>
                  <dd>{markDescription(q)}</dd>
                </React.Fragment>
              ))}
            {binsValid &&
              binData.map((b) => (
                <React.Fragment key={b.from}>
                  <dt>
                    {formatValue(b.from)}–{format(b.to)}
                  </dt>
                  <dd>
                    {formatCount(b.count)} {text.observations}
                  </dd>
                </React.Fragment>
              ))}
            {cumulativeValid &&
              cumulativeData.map((p, i) => (
                <React.Fragment key={i}>
                  <dt>{format(p.value)}</dt>
                  <dd>{formatCount(p.fraction * 100)}%</dd>
                </React.Fragment>
              ))}
          </dl>
        </details>
      )}
    </div>
  );
}
