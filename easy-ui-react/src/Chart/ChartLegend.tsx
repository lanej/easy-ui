import React from "react";
import {
  VisualizationTypography,
  visualizationTypographyStyle,
} from "../visualization/typography";
import styles from "./Chart.module.scss";

export type ChartLegendItem = {
  /** Series identity and visible label. */
  name: string;
  color: string;
  selected?: boolean;
  symbol?: "bar" | "line" | "circle";
};

export type ChartLegendProps = {
  items: readonly ChartLegendItem[];
  /** Omit for a static key. Selection remains owned by the caller. */
  onItemToggle?: (name: string) => void;
  "aria-label"?: string;
  typography?: VisualizationTypography;
};

/** A wrapping, keyboard-accessible series key outside the plot's coordinate space. */
export function ChartLegend({
  items,
  onItemToggle,
  "aria-label": label = "Chart series",
  typography,
}: ChartLegendProps) {
  if (!items.length) return null;
  return (
    <ul
      className={styles.legend}
      aria-label={label}
      style={visualizationTypographyStyle(typography)}
    >
      {items.map(({ name, color, selected = true, symbol = "bar" }) => {
        const content = (
          <>
            <span
              className={styles.legendSwatch}
              data-symbol={symbol}
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span>{name}</span>
          </>
        );
        return (
          <li key={name}>
            {onItemToggle ? (
              <button
                type="button"
                className={styles.legendItem}
                aria-pressed={selected}
                onClick={() => onItemToggle(name)}
              >
                {content}
              </button>
            ) : (
              <span className={styles.legendItem}>{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
