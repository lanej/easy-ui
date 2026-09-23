import React, { useEffect, useRef, useState } from "react";
import { ChartSurface, ChartDataView, type ChartOption } from "../Chart";
import { useColorScheme, useTheme } from "../Theme";
import {
  visualizationTypographyStyle,
  type VisualizationTypography,
} from "../visualization/typography";
import styles from "./ScoreComposition.charts.module.scss";

// Synthetic application-owned model evaluations. Easy UI neither fits this
// curve nor calculates the score or threshold meanings from these records.
export const ratioResponse = [
  [0, 0],
  [0.05, 0.02],
  [0.1, 0.07],
  [0.15, 0.2],
  [0.2, 0.5],
  [0.25, 0.9],
  [0.26, 1],
  [0.3, 1.3],
  [0.35, 1.55],
  [0.4, 1.75],
  [0.45, 1.9],
  [0.5, 2],
] as const;
const history = [0.06, 0.12, 0.09, 0.18, 0.22, 0.26];
export const ratioLevels = [
  { label: "Low", from: 0, to: 0.15, range: "0–<15%", sentiment: "positive" },
  {
    label: "Elevated",
    from: 0.15,
    to: 0.35,
    range: "15–<35%",
    sentiment: "warning",
  },
  {
    label: "High",
    from: 0.35,
    to: 0.5,
    range: "35–50%",
    sentiment: "negative",
  },
] as const;
const percent = (value: number) => `${Math.round(value * 100)}%`;

const defaultColors = {
  line: "#113abf",
  surface: "#ffffff",
  guide: "#627891",
  positive: "#d9f4e8",
  warning: "#fff0c2",
  negative: "#ffe0e0",
};
type Colors = typeof defaultColors;

/** A copyable recipe using Chart's existing point, reference, and region options. */
export function scoreCurveOption(
  kind: "response" | "history",
  refreshed = false,
  colors: Colors = defaultColors,
): ChartOption {
  const current = refreshed ? 0 : 0.26;
  const score = refreshed ? 0 : 1;
  const points =
    kind === "response"
      ? ratioResponse.map(([x, y]) => [x, refreshed ? 0 : y])
      : history.map((y, i) => [
          i + 1,
          refreshed && i === history.length - 1 ? 0 : y,
        ]);
  const point =
    kind === "response" ? [current, score] : [history.length, current];
  return {
    grid: { left: 8, right: 32, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" },
    legend: { show: false },
    xAxis:
      kind === "response"
        ? {
            type: "value",
            min: 0,
            max: 0.5,
            interval: 0.25,
            axisLabel: { formatter: percent },
          }
        : { type: "value", min: 1, max: 6, interval: 1 },
    yAxis:
      kind === "response"
        ? { type: "value", min: 0, max: 2, interval: 1 }
        : {
            type: "value",
            min: 0,
            max: 0.5,
            interval: 0.25,
            axisLabel: { formatter: percent },
          },
    series: [
      {
        id: kind,
        name: kind === "response" ? "Contribution" : "Label ratio",
        type: "line",
        data: points,
        // Preserve supplied evaluations; do not fit or smooth a different curve.
        smooth: false,
        showSymbol: false,
        itemStyle: { color: colors.line },
        lineStyle: { width: 2.5 },
        markPoint: {
          silent: true,
          symbol: "circle",
          symbolSize: 12,
          label: { show: false },
          itemStyle: {
            color: colors.line,
            borderColor: colors.surface,
            borderWidth: 3,
          },
          data: [{ name: "Current observation", coord: point }],
        },
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: colors.guide, type: "dashed", width: 1 },
          data: [{ xAxis: point[0] }, { yAxis: point[1] }],
        },
        markArea: {
          silent: true,
          label: { show: false },
          data: ratioLevels.map((level) =>
            kind === "response"
              ? [
                  {
                    name: level.label,
                    xAxis: level.from,
                    itemStyle: { color: colors[level.sentiment] },
                  },
                  { xAxis: level.to },
                ]
              : [
                  {
                    name: level.label,
                    yAxis: level.from,
                    itemStyle: { color: colors[level.sentiment] },
                  },
                  { yAxis: level.to },
                ],
          ),
        },
      },
    ],
  };
}

/** Optional rich content; it is mounted only when the owning score title opens. */
export function ScoreChartDetails({
  kind,
  refreshed = false,
  typography,
}: {
  kind: "response" | "history";
  refreshed?: boolean;
  typography?: VisualizationTypography;
}) {
  const detailTypography = { label: 14, detail: 14, ...typography };
  const ref = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState(defaultColors);
  const theme = useTheme();
  const { resolvedColorScheme } = useColorScheme();
  useEffect(() => {
    if (!ref.current) return;
    const css = getComputedStyle(ref.current);
    const color = (name: string, fallback: string) =>
      css.getPropertyValue(`--ezui-color-${name}`).trim() || fallback;
    setColors({
      line: color("primary-600", defaultColors.line),
      surface: color("neutral-000", defaultColors.surface),
      guide: color("neutral-600", defaultColors.guide),
      positive: color("positive-100", defaultColors.positive),
      warning: color("warning-300", defaultColors.warning),
      negative: color("negative-100", defaultColors.negative),
    });
  }, [theme, resolvedColorScheme]);
  const option = scoreCurveOption(kind, refreshed, colors);
  const points = (option.series as { data: number[][] }[])[0].data;
  const current = refreshed ? "0%" : "26%";
  const score = refreshed ? "0.00" : "1.00";
  const level = refreshed ? "Low" : "Elevated";
  const name = kind === "response" ? "Ratio response" : "Recent label ratios";
  return (
    <div
      ref={ref}
      className={styles.details}
      style={visualizationTypographyStyle(detailTypography)}
      data-score-chart={kind}
    >
      <div className={styles.callout} data-score-chart-callout="">
        <span className={styles.observationDot} aria-hidden="true" />
        <span>
          {kind === "response"
            ? `${current} → ${score} points`
            : `Latest: ${current}`}
          <span className={styles.level}> · {level}</span>
        </span>
      </div>
      <div className={styles.axisTitle}>
        {kind === "response" ? "Contribution (points)" : "Label ratio (%)"}
      </div>
      <ChartSurface
        aria-label={name}
        height={200}
        option={option}
        typography={detailTypography}
      />
      <div className={styles.axisTitle}>
        {kind === "response"
          ? "Label ratio (%)"
          : "Observation window · oldest → latest"}
      </div>
      <ul
        className={styles.levels}
        aria-label="Application-defined ratio levels"
      >
        {ratioLevels.map((level) => (
          <li key={level.label}>
            <span
              className={styles.swatch}
              data-sentiment={level.sentiment}
              aria-hidden="true"
            />
            <span>
              {level.label} <span className={styles.range}>{level.range}</span>
            </span>
          </li>
        ))}
      </ul>
      <ChartDataView
        title={name}
        typography={detailTypography}
        disclosureLabel="View exact chart data"
        dataTable={{
          columns:
            kind === "response"
              ? ["Label ratio", "Points"]
              : ["Window", "Label ratio"],
          rows: points.map(([x, y]) => ({
            id: String(x),
            values:
              kind === "response"
                ? [percent(x), y.toFixed(2)]
                : [String(x), percent(y)],
          })),
        }}
      />
      <p className={styles.caption}>
        {kind === "response"
          ? `Synthetic evaluations with burst fixed at ${refreshed ? 0 : 3}. Lines join supplied points; shaded levels are application rules.`
          : "Six synthetic windows. Shading shows the same ratio levels used by the application."}
      </p>
    </div>
  );
}
