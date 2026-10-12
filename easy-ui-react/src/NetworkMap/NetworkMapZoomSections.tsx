import React, { useMemo, useState } from "react";
import { NetworkMapProvider, useNetworkMap } from "./NetworkMapContext";
import {
  NetworkMapHeading,
  NetworkMapControlPanel,
} from "./NetworkMapCompanions";
import { NetworkMapSurface } from "./NetworkMapSurface";
import { validCoordinate } from "./geometry";
import type { NetworkMapZoomSection } from "./types";
import { visualizationTypographyStyle } from "../visualization/typography";
import mapStyles from "./NetworkMap.module.scss";
import styles from "./NetworkMapZoomSections.module.scss";

/** Independently placeable detail maps for one overview's caller-defined location groups. */
export function NetworkMapZoomSections() {
  const { props: options } = useNetworkMap();
  if (!options.zoomSections?.length) return null;
  return (
    <div className={styles.sections} data-map-zoom-sections>
      {options.zoomSections.map((section) => (
        <ZoomSection key={section.id} section={section} />
      ))}
    </div>
  );
}

function ZoomSection({ section }: { section: NetworkMapZoomSection }) {
  const { props: options, visibility, accessibleName } = useNetworkMap();
  const [requests, setRequests] = useState(0);
  const facilities = useMemo(() => {
    const ids = new Set(section.facilityIds);
    return options.facilities.filter(
      (facility) =>
        ids.has(facility.id) && validCoordinate(facility.coordinates),
    );
  }, [options.facilities, section.facilityIds]);
  const segments = useMemo(() => {
    const ids = new Set(facilities.map((facility) => facility.id));
    return options.segments.filter(
      (segment) => ids.has(segment.from) && ids.has(segment.to),
    );
  }, [options.segments, facilities]);
  const focus = useMemo(
    () => ({
      revision: JSON.stringify([section.focusRevision ?? section.id, requests]),
      facilityIds: section.facilityIds,
      maxZoom: section.maxZoom ?? 13,
    }),
    [
      section.focusRevision,
      section.id,
      section.facilityIds,
      section.maxZoom,
      requests,
    ],
  );
  return (
    <section data-map-zoom-section={section.id} className={styles.section}>
      {facilities.length ? (
        <NetworkMapProvider
          {...options}
          title={section.title}
          description={section.description}
          aria-label={`${accessibleName} · ${section.title}`}
          aria-labelledby={undefined}
          facilities={facilities}
          segments={segments}
          zoomSections={undefined}
          initialView={undefined}
          focus={focus}
          height={section.height ?? 280}
          primaryFacilityIds={section.facilityIds}
          clusterFacilities={undefined}
          layerVisibility={visibility}
          controlPlacement="toolbar"
          controls={
            options.controls === false
              ? false
              : {
                  navigation: options.controls?.navigation,
                  scale: options.controls?.scale,
                }
          }
          toolbarControls={[
            {
              id: "fit-section",
              type: "button",
              label: "Fit section",
              onPress: () => setRequests((value) => value + 1),
            },
          ]}
          showLegend={false}
          showSelectionDetails={false}
          showDataTable={false}
          onMapReady={section.onMapReady}
        >
          <div
            className={mapStyles.root}
            style={visualizationTypographyStyle(options.typography)}
          >
            <NetworkMapHeading />
            <NetworkMapControlPanel />
            <NetworkMapSurface />
          </div>
        </NetworkMapProvider>
      ) : (
        <div className={styles.empty}>
          <h3>{section.title}</h3>
          {section.description && <p>{section.description}</p>}
          <p>No mapped locations in this section.</p>
        </div>
      )}
    </section>
  );
}
