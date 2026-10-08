import React from "react";
import { RangePlot } from "../RangePlot";
import {
  visualizationTypographyStyle,
  type VisualizationTypography,
} from "../visualization/typography";
import type { MapSurfaceCellDetailsContext } from "./types";
import styles from "./NetworkMap.module.scss";

export type NetworkMapCellDetailsProps = MapSurfaceCellDetailsContext & {
  typography?: VisualizationTypography;
  /** Replace the default range plot while retaining the summary and provenance. null hides the plot. */
  children?: React.ReactNode;
};

const minutes = (value: number) => `${value} min`;
const summary = (value: number | null, unit = "") =>
  value == null
    ? "Unavailable"
    : Number.isFinite(value) && value >= 0
      ? `${value}${unit}`
      : "Invalid";

/** Engine-free cell details, reusable in a map card, exact data, or an application panel. */
export function NetworkMapCellDetails({
  cell,
  surface,
  metric,
  typography,
  children,
}: NetworkMapCellDetailsProps) {
  const distribution = cell.distribution;
  const bounds = distribution && [
    distribution.minMinutes,
    distribution.q1Minutes,
    distribution.q3Minutes,
    distribution.maxMinutes,
  ];
  const valid =
    bounds &&
    Number.isFinite(cell.n) &&
    cell.n > 0 &&
    bounds.every(
      (value, index) =>
        Number.isFinite(value) &&
        value >= 0 &&
        (index === 0 || value >= bounds[index - 1]),
    ) &&
    (cell.medianMinutes == null ||
      (Number.isFinite(cell.medianMinutes) &&
        cell.medianMinutes >= bounds[1] &&
        cell.medianMinutes <= bounds[2]));
  return (
    <div
      className={styles.cellDetails}
      style={visualizationTypographyStyle(typography)}
    >
      {metric && (
        <p>
          <strong>{metric.label}</strong>:{" "}
          {summary(cell[metric.field], metric.field === "n" ? "" : " min")}
        </p>
      )}
      <dl className={styles.cellSummary}>
        <div>
          <dt>Median</dt>
          <dd>{summary(cell.medianMinutes, " min")}</dd>
        </div>
        <div>
          <dt>IQR width</dt>
          <dd>{summary(cell.iqrMinutes, " min")}</dd>
        </div>
        <div>
          <dt>Observations</dt>
          <dd>{summary(cell.n)}</dd>
        </div>
      </dl>
      {children !== undefined ? (
        children
      ) : distribution && valid ? (
        <RangePlot
          label="Delivery time spread"
          description="The interval contains the middle 50% of observations."
          domain={
            distribution.minMinutes === distribution.maxMinutes
              ? [
                  Math.max(0, distribution.minMinutes - 1),
                  distribution.maxMinutes + 1,
                ]
              : [distribution.minMinutes, distribution.maxMinutes]
          }
          interval={{
            from: distribution.q1Minutes,
            to: distribution.q3Minutes,
            label: "Middle 50%",
          }}
          points={[
            { id: "min", label: "Minimum", value: distribution.minMinutes },
            { id: "median", label: "Median", value: cell.medianMinutes },
            { id: "max", label: "Maximum", value: distribution.maxMinutes },
          ]}
          formatValue={minutes}
          typography={typography}
        />
      ) : (
        <p>
          {distribution
            ? "Distribution unavailable: invalid bounds or observations."
            : "Distribution not supplied. IQR is a width, not the quartile endpoints."}
        </p>
      )}
      <p className={styles.cellProvenance}>
        Source: {surface.source} · As of: {surface.asOf}
      </p>
    </div>
  );
}
