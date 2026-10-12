import React, { useEffect, useMemo, useRef, useState } from "react";
import { useId } from "react-aria";
import { Button } from "../Button";
import { NetworkMapProvider, useNetworkMap } from "./NetworkMapContext";
import { NetworkMapSurface } from "./NetworkMapSurface";
import { geographicBounds, validCoordinate } from "./geometry";
import type { NetworkMapZoomSection } from "./types";
import { visualizationTypographyStyle } from "../visualization/typography";
import styles from "./NetworkMapZoomSections.module.scss";

type Leader = { id: string; x: number; y: number; endX: number; endY: number };

/** Close-up insets inside NetworkMapViewport, sharing its journey selection and layers. */
export function NetworkMapZoomSections() {
  const { props: options, mapRef, state, accessibleName } = useNetworkMap();
  const root = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(
    () =>
      options.zoomSections?.find((section) =>
        section.facilityIds.includes(options.selectedFacilityId ?? ""),
      )?.id ?? options.zoomSections?.[0]?.id,
  );
  const [narrow, setNarrow] = useState(false);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const sections = options.zoomSections;
  const active =
    sections?.find((section) => section.id === activeId) ?? sections?.[0];
  useEffect(() => {
    const element = root.current;
    const frame = element?.closest<HTMLElement>("[data-map-geography]");
    if (!element || !frame) return;
    const map = mapRef.current;
    const update = () => {
      const isNarrow = frame.clientWidth <= 700;
      setNarrow(isNarrow);
      if (!map) return;
      const base = frame.getBoundingClientRect();
      const canvas = map.getContainer().getBoundingClientRect();
      const insetTop = element.getBoundingClientRect().top;
      const next: Leader[] = [];
      for (const section of sections ?? []) {
        if (isNarrow && section.id !== active?.id) continue;
        const bounds = geographicBounds(
          options.facilities
            .filter((facility) => section.facilityIds.includes(facility.id))
            .map((facility) => facility.coordinates),
        );
        const card = [
          ...element.querySelectorAll<HTMLElement>("[data-map-zoom-section]"),
        ].find((node) => node.dataset.mapZoomSection === section.id);
        if (!bounds || !card) continue;
        const centerLongitude = (bounds[0][0] + bounds[1][0]) / 2;
        const longitude =
          centerLongitude +
          Math.round((map.getCenter().lng - centerLongitude) / 360) * 360;
        const point = map.project([
          longitude,
          (bounds[0][1] + bounds[1][1]) / 2,
        ]);
        const x = point.x + canvas.left - base.left;
        const y = point.y + canvas.top - base.top;
        if (
          x < 14 ||
          x > base.width - 14 ||
          y < 14 ||
          y + base.top + 14 >= insetTop
        )
          continue;
        const target = card.getBoundingClientRect();
        next.push({
          id: section.id,
          x,
          y,
          endX: target.left + target.width / 2 - base.left,
          endY: target.top - base.top,
        });
      }
      setLeaders(next);
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(frame);
    observer?.observe(element);
    map?.on("move", update);
    map?.on("resize", update);
    return () => {
      observer?.disconnect();
      map?.off("move", update);
      map?.off("resize", update);
    };
  }, [sections, options.facilities, active?.id, state, mapRef]);
  if (!sections?.length) return null;
  const ids = new Set<string>();
  for (const section of sections) {
    if (!section.id || ids.has(section.id))
      throw new Error("Map zoom section IDs must be nonempty and unique");
    ids.add(section.id);
  }
  return (
    <>
      <svg className={styles.leaders} data-map-inset-leaders aria-hidden="true">
        {leaders.map((leader) => (
          <g key={leader.id} data-map-inset-leader={leader.id}>
            <polyline
              points={`${leader.x},${leader.y + 14} ${leader.x},${(leader.y + leader.endY) / 2} ${leader.endX},${leader.endY}`}
            />
            <circle cx={leader.x} cy={leader.y} r={14} />
          </g>
        ))}
      </svg>
      <div
        ref={root}
        className={styles.sections}
        data-map-zoom-sections
        style={visualizationTypographyStyle(options.typography)}
      >
        {options.controls !== false && sections.length > 1 && (
          <div
            className={styles.switcher}
            role="group"
            aria-label={`${accessibleName} close-up insets`}
          >
            {sections.map((section) => (
              <Button
                key={section.id}
                size="sm"
                variant={active?.id === section.id ? "filled" : "outlined"}
                type="button"
                aria-pressed={active?.id === section.id}
                onPress={() => setActiveId(section.id)}
              >
                <span className={styles.controlLabel}>{section.title}</span>
              </Button>
            ))}
          </div>
        )}
        <div className={styles.panels}>
          {sections.map((section) => (
            <ZoomSection
              key={section.id}
              section={section}
              active={active?.id === section.id}
              hidden={narrow && active?.id !== section.id}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ZoomSection({
  section,
  active,
  hidden,
}: {
  section: NetworkMapZoomSection;
  active: boolean;
  hidden: boolean;
}) {
  const { props: options, visibility, accessibleName } = useNetworkMap();
  const [requests, setRequests] = useState(0);
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (element.current) element.current.inert = hidden;
  }, [hidden]);
  const headingId = useId();
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
  const heading = <h3 id={headingId}>{section.title}</h3>;
  return (
    <section
      ref={element}
      className={styles.section}
      data-map-zoom-section={section.id}
      data-active={active}
      aria-hidden={hidden || undefined}
      aria-labelledby={headingId}
    >
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
          height={section.height ?? 260}
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
          toolbarControls={undefined}
          showLegend={false}
          showSelectionDetails={false}
          showDataTable={false}
          onMapReady={section.onMapReady}
        >
          <InsetHeader
            heading={heading}
            onFit={() => setRequests((value) => value + 1)}
          />
          <NetworkMapSurface />
        </NetworkMapProvider>
      ) : (
        <>
          <header className={styles.header}>{heading}</header>
          <div className={styles.empty}>
            <p>No mapped locations in this section.</p>
          </div>
        </>
      )}
    </section>
  );
}

function InsetHeader({
  heading,
  onFit,
}: {
  heading: React.ReactNode;
  onFit: () => void;
}) {
  const { props: options, state } = useNetworkMap();
  return (
    <header className={styles.header}>
      <div>
        {heading}
        {options.description && <p>{options.description}</p>}
      </div>
      {options.controls !== false && (
        <Button
          size="sm"
          variant="text"
          type="button"
          isDisabled={state !== "ready"}
          onPress={onFit}
        >
          <span className={styles.controlLabel}>Fit section</span>
        </Button>
      )}
    </header>
  );
}
