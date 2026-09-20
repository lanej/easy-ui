import React, { ReactNode } from "react";
import { Card } from "../Card";
import { Text } from "../Text";
import { visualizationTypographyStyle } from "../visualization/typography";
import { ChartDataTable, ChartZoomTarget } from "./types";
import { ChartSurface, ChartSurfaceProps } from "./ChartSurface";
import { ChartProvider } from "./ChartProvider";
import { ChartHeading } from "./ChartHeading";
import { ChartDataView } from "./ChartDataView";
import { ChartZoomControls } from "./ChartZoomControls";
import styles from "./Chart.module.scss";

/** Convenient analytical composition. Use the individual companions for application-owned layouts. */
export type ChartProps = ChartSurfaceProps & {
  /** Independently optional visible heading. Use aria-label or aria-labelledby with an external heading. */
  title?: string | null;
  /** Independently optional visible description and default plot description. */
  description?: string | null;
  /** Exact data equivalent; use ChartSurface with an external ChartDataView for other layouts. */
  dataTable: ChartDataTable;
  notice?: string;
  actions?: ReactNode;
  onRowSelect?: (id: string) => void;
  dataTableLabel?: string;
  missingValueLabel?: string;
  selectRowLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  resetZoomLabel?: string;
  /** Target an explicit effective zoom component or linked group. Defaults to the first. */
  zoomTarget?: ChartZoomTarget;
  variant?: "card" | "bare";
};

/** Full Chart composes the same independently available surface, heading, controls, and data view. */
export function Chart({
  title,
  description,
  dataTable,
  status = dataTable.rows.length ? "ready" : "empty",
  notice,
  actions,
  onRowSelect,
  dataTableLabel = "View data table",
  missingValueLabel,
  selectRowLabel,
  zoomInLabel,
  zoomOutLabel,
  resetZoomLabel,
  zoomTarget,
  variant = "card",
  ...surface
}: ChartProps) {
  const name = surface["aria-label"] ?? title ?? description ?? "Chart";
  const aria = {
    "aria-label": surface["aria-labelledby"] ? undefined : name,
    "aria-labelledby": surface["aria-labelledby"],
    "aria-describedby": surface["aria-describedby"],
    "aria-busy": status === "loading",
  };
  const content = (
    <div
      className={styles.root}
      style={visualizationTypographyStyle(surface.typography)}
    >
      <ChartHeading
        title={title}
        description={description}
        actions={actions}
        typography={surface.typography}
      />
      <ChartSurface
        {...surface}
        status={status}
        aria-label={surface["aria-label"] ?? description ?? name}
      />
      <ChartZoomControls
        target={zoomTarget}
        zoomInLabel={zoomInLabel}
        zoomOutLabel={zoomOutLabel}
        resetZoomLabel={resetZoomLabel}
        typography={surface.typography}
      />
      {notice && (
        <Text variant="caption" color="neutral.700">
          {notice}
        </Text>
      )}
      {status === "ready" && (
        <ChartDataView
          dataTable={dataTable}
          title={title ?? name}
          disclosureLabel={dataTableLabel}
          missingValueLabel={missingValueLabel}
          selectRowLabel={selectRowLabel}
          onRowSelect={onRowSelect}
          typography={surface.typography}
        />
      )}
    </div>
  );
  return (
    <ChartProvider>
      {variant === "bare" ? (
        <section {...aria}>{content}</section>
      ) : (
        <Card
          as="section"
          background="primary"
          {...aria}
          padding={{ xs: "2", md: "3" }}
        >
          {content}
        </Card>
      )}
    </ChartProvider>
  );
}
