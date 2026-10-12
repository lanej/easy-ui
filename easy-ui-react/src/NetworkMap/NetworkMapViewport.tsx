import React from "react";
import { useNetworkMap } from "./NetworkMapContext";
import { NetworkMapSurface } from "./NetworkMapSurface";
import { NetworkMapZoomSections } from "./NetworkMapZoomSections";
import styles from "./NetworkMap.module.scss";

/** One geographic frame containing the journey overview and its embedded close-up insets. */
export function NetworkMapViewport() {
  const { props: options } = useNetworkMap();
  return (
    <div
      className={styles.geography}
      data-map-geography
      data-has-insets={Boolean(options.zoomSections?.length) || undefined}
    >
      <NetworkMapSurface />
      <NetworkMapZoomSections />
    </div>
  );
}
