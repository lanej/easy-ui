import React from "react";
import type { NetworkMapProps } from "./types";
import { NetworkMapProvider } from "./NetworkMapContext";
import { NetworkMapSurface } from "./NetworkMapSurface";
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
        style={visualizationTypographyStyle(props.typography)}
      >
        <NetworkMapHeading />
        {props.controlPlacement === "map" ? (
          <div className={styles.mapFrame} data-map-frame>
            <div className={styles.overMapControls} data-map-controls>
              <NetworkMapControlPanel />
            </div>
            <NetworkMapSurface />
          </div>
        ) : (
          <>
            <NetworkMapControlPanel />
            <NetworkMapSurface />
          </>
        )}
        {props.showSelectionDetails !== false && <NetworkMapSelectionDetails />}
        {props.showLegend !== false && <NetworkMapLegend />}
        {props.showDataTable !== false && <NetworkMapDataView />}
      </div>
    </NetworkMapProvider>
  );
}
