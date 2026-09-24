import React from "react";
import { dispatchZoom, selectedZooms, useChartContext } from "./ChartProvider";
import type { ChartZoomTarget } from "./types";
import {
  VisualizationTypography,
  visualizationTypographyStyle,
} from "../visualization/typography";
import styles from "./Chart.module.scss";

export type ChartZoomControlsProps = {
  /** Omit to target the first effective zoom component; ECharts retains linked-axis behavior. */
  target?: ChartZoomTarget;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  resetZoomLabel?: string;
  "aria-label"?: string;
  typography?: VisualizationTypography;
};

/** Place anywhere inside the same ChartProvider as its ChartSurface. Inapplicable controls are omitted. */
export function ChartZoomControls({
  target,
  zoomInLabel = "Zoom in",
  zoomOutLabel = "Zoom out",
  resetZoomLabel = "Reset zoom",
  "aria-label": label,
  typography,
}: ChartZoomControlsProps) {
  const connection = useChartContext();
  if (!connection?.snapshot.ready) return null;
  const ranges = selectedZooms(connection.snapshot.zoom, target);
  if (!ranges.length) return null;
  const labels = [zoomInLabel, zoomOutLabel, resetZoomLabel];
  return (
    <div
      className={styles.controls}
      style={visualizationTypographyStyle(typography)}
      role="group"
      aria-label={label ?? labels.join(" / ")}
    >
      {[0.5, 2, 0].map((factor, index) => (
        <button
          type="button"
          className={styles.control}
          key={factor}
          onClick={() => {
            if (connection.instance.current)
              dispatchZoom(
                connection.instance.current,
                selectedZooms(connection.snapshotRef.current.zoom, target),
                factor,
              );
          }}
        >
          {labels[index]}
        </button>
      ))}
    </div>
  );
}
