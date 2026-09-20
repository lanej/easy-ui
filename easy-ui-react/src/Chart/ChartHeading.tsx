import React, { ReactNode } from "react";
import {
  VisualizationTypography,
  visualizationTypographyStyle,
} from "../visualization/typography";
import styles from "./Chart.module.scss";

export type ChartHeadingProps = {
  title?: string | null;
  description?: string | null;
  actions?: ReactNode;
  titleId?: string;
  descriptionId?: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  typography?: VisualizationTypography;
};

/** Independently placeable presentation; empty headings and descriptions reserve no space. */
export function ChartHeading({
  title,
  description,
  actions,
  titleId,
  descriptionId,
  headingLevel = 2,
  typography,
}: ChartHeadingProps) {
  if (!title && !description && !actions) return null;
  const Heading = `h${headingLevel}` as "h2";
  return (
    <div style={visualizationTypographyStyle(typography)}>
      {(title || actions) && (
        <div className={styles.header}>
          {title && (
            <Heading id={titleId} className={styles.title}>
              {title}
            </Heading>
          )}
          {actions}
        </div>
      )}
      {description && (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      )}
    </div>
  );
}
