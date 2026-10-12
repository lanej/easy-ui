import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useId } from "react-aria";
import { Button } from "../Button";
import { NetworkMapProvider, useNetworkMap } from "./NetworkMapContext";
import { NetworkMapSurface } from "./NetworkMapSurface";
import { validCoordinate } from "./geometry";
import type { NetworkMapZoomSection } from "./types";
import { visualizationTypographyStyle } from "../visualization/typography";
import styles from "./NetworkMapZoomSections.module.scss";

type Placement = {
  left: number;
  top: number;
  narrow: boolean;
  x: number;
  y: number;
  endX: number;
  endY: number;
};

/** One requested close-up for a crowded node, without changing the overview camera. */
export function NetworkMapZoomSections() {
  const { props: options, mapRef, insets } = useNetworkMap();
  const { setDock, close } = insets;
  const card = useRef<HTMLElement>(null);
  const [placement, setPlacement] = useState<Placement>({
    left: 12,
    top: 12,
    narrow: false,
    x: 0,
    y: 0,
    endX: 0,
    endY: 0,
  });
  const active = insets.active;
  const section = options.zoomSections?.find(
    (item) => item.id === active?.sectionId,
  );
  const activeSection = useMemo(
    () =>
      section && active
        ? { ...section, facilityIds: active.facilityIds }
        : undefined,
    [section, active],
  );
  useLayoutEffect(() => {
    const element = card.current;
    const frame = element?.closest<HTMLElement>("[data-map-geography]");
    const map = mapRef.current;
    if (!element || !frame || !map || !active) return;
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const base = frame.getBoundingClientRect();
      const canvas = map.getContainer().getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      const anchor = options.facilities.find(
        (facility) => facility.id === active.anchorId,
      );
      if (!anchor || !validCoordinate(anchor.coordinates)) return;
      const project = (coordinates: readonly [number, number]) => {
        const longitude =
          coordinates[0] +
          Math.round((map.getCenter().lng - coordinates[0]) / 360) * 360;
        const point = map.project([longitude, coordinates[1]]);
        return {
          x: point.x + canvas.left - base.left,
          y: point.y + canvas.top - base.top,
        };
      };
      const source = project(anchor.coordinates);
      const points = options.facilities
        .filter((facility) => validCoordinate(facility.coordinates))
        .map((facility) => project(facility.coordinates));
      const attribution = map
        .getContainer()
        .querySelector(".maplibregl-ctrl-attrib")
        ?.getBoundingClientRect();
      const bottom = Math.max(
        44,
        attribution && attribution.height > 0
          ? base.bottom - attribution.top + 12
          : 44,
      );
      const candidates = [
        { left: 12, top: Math.max(12, base.height - bottom - bounds.height) },
        {
          left: Math.max(12, base.width - bounds.width - 12),
          top: Math.max(12, base.height - bottom - bounds.height),
        },
        { left: 12, top: 12 },
        { left: Math.max(12, base.width - bounds.width - 12), top: 12 },
      ];
      const inside = (
        point: { x: number; y: number },
        position: { left: number; top: number },
        margin = 0,
      ) =>
        point.x >= position.left - margin &&
        point.x <= position.left + bounds.width + margin &&
        point.y >= position.top - margin &&
        point.y <= position.top + bounds.height + margin;
      const score = (position: { left: number; top: number }) =>
        (inside(source, position, 16) ? 10000 : 0) +
        points.filter((point) => inside(point, position, 16)).length;
      const position = candidates.reduce((best, next) =>
        score(next) < score(best) ? next : best,
      );
      const endX = Math.min(
        position.left + bounds.width,
        Math.max(position.left, source.x),
      );
      const endY = Math.min(
        position.top + bounds.height,
        Math.max(position.top, source.y),
      );
      setPlacement({
        ...position,
        narrow: frame.clientWidth <= 700,
        ...source,
        endX,
        endY,
      });
      setDock(position.top === 12 ? "top" : "bottom");
    };
    update();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        close(true);
      }
    };
    frame.addEventListener("keydown", onEscape);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(frame);
    observer?.observe(element);
    map.on("resize", update);
    return () => {
      disposed = true;
      observer?.disconnect();
      map.off("resize", update);
      frame.removeEventListener("keydown", onEscape);
    };
  }, [active, options.facilities, mapRef, setDock, close]);
  const ids = new Set<string>();
  for (const item of options.zoomSections ?? []) {
    if (!item.id || ids.has(item.id))
      throw new Error("Map zoom section IDs must be nonempty and unique");
    ids.add(item.id);
  }
  if (!activeSection || !active) return null;
  const dx = placement.endX - placement.x;
  const dy = placement.endY - placement.y;
  const length = Math.hypot(dx, dy);
  return (
    <div
      className={styles.sections}
      data-map-zoom-sections
      style={visualizationTypographyStyle(options.typography)}
    >
      {length > 14 && (
        <svg
          className={styles.leaders}
          data-map-inset-leaders
          aria-hidden="true"
        >
          <g data-map-inset-leader={active.sectionId}>
            <line
              x1={placement.x + (dx / length) * 14}
              y1={placement.y + (dy / length) * 14}
              x2={placement.endX}
              y2={placement.endY}
            />
            <circle cx={placement.x} cy={placement.y} r={14} />
          </g>
        </svg>
      )}
      <ZoomSection
        key={active.key}
        section={activeSection}
        element={card}
        narrow={placement.narrow}
        position={{ left: placement.left, top: placement.top }}
        onClose={() => insets.close(true)}
      />
    </div>
  );
}

function ZoomSection({
  section,
  narrow,
  element,
  position,
  onClose,
}: {
  section: NetworkMapZoomSection;
  narrow: boolean;
  element: React.RefObject<HTMLElement | null>;
  position: { left: number; top: number };
  onClose: () => void;
}) {
  const { props: options, visibility, accessibleName } = useNetworkMap();
  const [requests, setRequests] = useState(0);
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
      style={position}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
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
          height={
            section.height ??
            (narrow && (options.typography?.label ?? 12) <= 14 ? 240 : 260)
          }
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
            onClose={onClose}
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
  onClose,
}: {
  heading: React.ReactNode;
  onFit: () => void;
  onClose: () => void;
}) {
  const { props: options, state } = useNetworkMap();
  return (
    <header className={styles.header}>
      <div className={styles.metadata} tabIndex={0}>
        {heading}
        {options.description && <p>{options.description}</p>}
      </div>
      <div className={styles.actions}>
        {options.controls !== false && (
          <Button
            size="sm"
            variant="text"
            type="button"
            isDisabled={state !== "ready"}
            onPress={onFit}
          >
            <span className={styles.controlLabel}>Fit</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="text"
          type="button"
          aria-label="Close close-up"
          onPress={onClose}
        >
          <span className={styles.closeIcon} aria-hidden="true">
            ×
          </span>
        </Button>
      </div>
    </header>
  );
}
