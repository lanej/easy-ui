import React from "react";
import type { NetworkMapProps } from "./types";
import { NetworkMapProvider } from "./NetworkMapContext";
import { NetworkMapViewport } from "./NetworkMapViewport";
import {
  NetworkMapHeading,
  NetworkMapControlPanel,
  NetworkMapLegend,
  NetworkMapSelectionDetails,
  NetworkMapDataView,
} from "./NetworkMapCompanions";
import { visualizationTypographyStyle } from "../visualization/typography";
import styles from "./NetworkMap.module.scss";

/** Convenient composition of the geographic surface and optional, independently placeable companions. */
export function NetworkMap(props: NetworkMapProps) {
  return (
    <NetworkMapProvider {...props}>
      <div
        className={styles.root}
        data-fill-height={props.height === "fill" || undefined}
        data-has-insets={Boolean(props.zoomSections?.length) || undefined}
        style={visualizationTypographyStyle(props.typography)}
      >
        <NetworkMapHeading />
        <div className={styles.mapFrame} data-map-frame>
          <div
            className={
              props.controlPlacement === "map"
                ? styles.overMapControls
                : undefined
            }
            data-map-controls={props.controlPlacement === "map" || undefined}
          >
            <NetworkMapControlPanel />
          </div>
          <NetworkMapViewport />
        </div>
        {props.showSelectionDetails !== false && <NetworkMapSelectionDetails />}
        {props.showLegend !== false && <NetworkMapLegend />}
        {props.showDataTable !== false && <NetworkMapDataView />}
      </div>
    </NetworkMapProvider>
  );
}
