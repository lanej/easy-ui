import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Tabs } from "../Tabs";
import { Checkbox } from "../Checkbox";
import { InvestigationDetails } from "./InvestigationDetails";
import { Button } from "../Button";
import { Text } from "../Text";
import { EventTimeline, type EventTimelineProps } from "../EventTimeline";
import {
  NetworkMap,
  type NetworkMapProps,
  type MapOverlay,
  type MapOverlayHoverDetailsContext,
} from "../NetworkMap";
import { segmentData } from "../NetworkMap/geometry";
import {
  resolveSelection,
  selectEvent,
  type InvestigationDetailsContext,
  type InvestigationRecords,
  type InvestigationSelection,
  type InvestigationPath,
} from "./selection";
import styles from "./InvestigationWorkspace.module.scss";

type MapOptions = Omit<
  NetworkMapProps,
  | "facilities"
  | "segments"
  | "selectedFacilityId"
  | "selectedSegmentId"
  | "onFacilitySelect"
  | "showSelectionDetails"
  | "clusterFacilities"
>;

export type InvestigationWorkspaceProps = InvestigationRecords & {
  selection: InvestigationSelection;
  onSelectionChange: (selection: InvestigationSelection) => void;
  /** Existing map options, including basemap and worker. Selection is owned by the workspace. */
  map: MapOptions;
  /** Caller content below the persistent selection summary; may include charts and actions. */
  renderDetails?: (context: InvestigationDetailsContext) => ReactNode;
  /** Compact location-first ledger, quiet map, and a single joined inspection surface. */
  variant?: "default" | "ledger";
  /** Caller-owned candidate assessment; separate from the candidate selection button. */
  renderPathTrailing?: (path: InvestigationPath) => ReactNode;
  /** Reuse the timeline's optional content slots and density. */
  timeline?: Pick<
    EventTimelineProps,
    | "renderTrailing"
    | "renderMetrics"
    | "metricsPlacement"
    | "renderInterval"
    | "renderDetails"
    | "size"
    | "variant"
    | "emptyLabel"
  >;
  ariaLabel?: string;
  labels?: Partial<
    Record<
      | "timeline"
      | "map"
      | "details"
      | "paths"
      | "clear"
      | "previous"
      | "next"
      | "empty"
      | "allPaths"
      | "relatedOnly"
      | "mapTab"
      | "showDetails"
      | "hideDetails",
      string
    >
  >;
};

/** Linked, controlled inspection of supplied observations, candidate histories and locations. */
export function InvestigationWorkspace({
  events,
  locations = [],
  segments = [],
  paths = [],
  connections: eventConnections,
  selection,
  onSelectionChange,
  map,
  timeline,
  renderDetails,
  variant = "default",
  renderPathTrailing,
  ariaLabel = "Event investigation",
  labels,
}: InvestigationWorkspaceProps) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const [mapColors, setMapColors] = useState({
    primary: "#608cff",
    muted: "#6a7e9d",
  });
  // Read inherited CSS tokens, including system/inverted schemes and partial
  // custom themes. MapLibre paint cannot resolve CSS custom properties itself.
  useEffect(() => {
    const element = root.current;
    if (!element || variant !== "ledger") return;
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => {
      const css = getComputedStyle(element);
      const primary =
        css.getPropertyValue("--ezui-color-primary-600").trim() || "#608cff";
      const muted =
        css.getPropertyValue("--ezui-color-neutral-500").trim() || "#6a7e9d";
      setMapColors((previous) =>
        previous.primary === primary && previous.muted === muted
          ? previous
          : { primary, muted },
      );
    };
    update();
    // ThemeProvider can replace its style text without rerendering this child.
    // Observe only its style nodes, not map/marker mutations during interaction.
    const observer = new MutationObserver(update);
    document
      .querySelectorAll('style[id^="ezui-theme-style-level-"]')
      .forEach((style) => {
        observer.observe(style, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      });
    scheme?.addEventListener("change", update);
    return () => {
      observer.disconnect();
      scheme?.removeEventListener("change", update);
    };
  });
  const primary = variant === "ledger" ? mapColors.primary : "#608cff";
  const muted = mapColors.muted;
  const [isNarrow, setIsNarrow] = useState(false);
  const [view, setView] = useState<"events" | "map">("events");
  const [relatedOnly, setRelatedOnly] = useState(false);
  const narrowMode = useRef(false);
  const focusAfterResize = useRef<string | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const width = element.getBoundingClientRect().width;
      if (width <= 0) return;
      const narrow = width <= 740;
      if (narrow === narrowMode.current) return;
      // Capture focus before React hides a panel or removes the mobile tabs.
      focusAfterResize.current = null;
      const active = document.activeElement;
      if (active instanceof HTMLElement && element.contains(active)) {
        const panel = active.closest<HTMLElement>("[data-view-panel]");
        if (narrow && panel) {
          setView(panel.dataset.viewPanel as "events" | "map");
        } else if (!narrow && active.getAttribute("role") === "tab") {
          focusAfterResize.current = active.getAttribute("aria-controls");
        } else if (narrow) {
          const body = active.closest<HTMLElement>(
            "[data-investigation-details-body]",
          );
          focusAfterResize.current = body?.id ?? null;
        }
      }
      narrowMode.current = narrow;
      setIsNarrow(narrow);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const targetId = focusAfterResize.current;
    focusAfterResize.current = null;
    if (!targetId) return;
    const target = document.getElementById(targetId);
    const fallback = target?.hidden
      ? root.current?.querySelector<HTMLElement>(
          `button[aria-controls="${targetId}"]`,
        )
      : target?.hasAttribute("data-view-panel")
        ? target
        : null;
    fallback?.focus({ preventScroll: true });
  }, [isNarrow]);
  const overlayId = `${id}-investigation-connections`;
  const context = resolveSelection(
    { events, locations, segments, paths, connections: eventConnections },
    selection,
  );
  const { event, location, path, segment, isAvailable } = context;
  const scoped = Boolean(
    selection && selection.type !== "event" && isAvailable,
  );
  const visibleEvents = scoped && relatedOnly ? context.events : events;
  const relatedIds = scoped ? context.events.map((item) => item.id) : undefined;
  // Reveal receipt time when occurrence labels alone cannot distinguish records.
  const repeatedLabels = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const item of events) {
      const key = JSON.stringify([
        item.label,
        item.timeLabel,
        item.locationId,
        item.locationLabel,
      ]);
      groups.set(key, [...(groups.get(key) ?? []), item.id]);
    }
    return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
  }, [events]);
  useEffect(() => {
    if (isNarrow && view !== "events") return;
    const panel = root.current?.querySelector<HTMLElement>(
      "[data-timeline-scroll]",
    );
    const active = panel?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!panel || !active) return;
    const bounds = panel.getBoundingClientRect();
    const row = (active.closest("li") ?? active).getBoundingClientRect();
    // Reveal the whole compact record when it fits. An expanded evidence row
    // can exceed the viewport; preserve its selected headline in that case.
    const target =
      row.height <= bounds.height - 16 ? row : active.getBoundingClientRect();
    if (target.top < bounds.top) panel.scrollTop += target.top - bounds.top - 8;
    else if (target.bottom > bounds.bottom)
      panel.scrollTop += target.bottom - bounds.bottom + 8;
  }, [event?.id, isNarrow, view, relatedOnly]);
  const text = {
    timeline: "Events",
    map: "Locations and connections",
    details: "Selection details",
    paths: "Candidate paths",
    clear: "Clear selection",
    previous: "Previous event",
    next: "Next event",
    empty: "Select an event, location, or candidate path.",
    allPaths: "All paths",
    relatedOnly: "Related only",
    mapTab: "Map",
    showDetails: "Show details",
    hideDetails: "Hide details",
    ...labels,
  };
  const selectedSegments = new Set(
    segment
      ? [segment.id]
      : variant === "ledger" && eventConnections !== undefined && !path
        ? (context.connections ?? []).flatMap((item) =>
            selection && item.segmentId ? [item.segmentId] : [],
          )
        : context.paths.flatMap((item) => [...item.segmentIds]),
  );
  // Preserve explicit caller colors and label policies. Quiet defaults are presentation only.
  const mapLocations = useMemo(
    () =>
      variant === "ledger"
        ? locations.map((item) => ({
            ...item,
            labelMinZoom: item.labelMinZoom ?? 24,
          }))
        : locations,
    [locations, variant],
  );
  const mapSegments = useMemo(
    () =>
      variant === "ledger"
        ? segments.map((item) => ({ ...item, color: item.color ?? muted }))
        : segments,
    [segments, variant, muted],
  );
  // Membership is presentation only: do not infer geometry or remove conflicting records.
  const geometry = useMemo(
    () => segmentData(locations, segments),
    [locations, segments],
  );
  const connections: MapOverlay = {
    id: overlayId,
    label: "Investigation connections",
    data: {
      ...geometry,
      features: geometry.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          selected: selectedSegments.has(String(feature.id)),
          label: segments.find((item) => item.id === feature.id)?.label,
        },
      })),
    },
    layers: [
      {
        id: "selection",
        type: "line",
        filter:
          variant === "ledger"
            ? [
                "all",
                ["==", ["get", "selected"], true],
                [
                  "!",
                  [
                    "in",
                    ["get", "evidence"],
                    ["literal", ["planned", "inferred"]],
                  ],
                ],
              ]
            : ["==", ["get", "selected"], true],
        paint: {
          "line-color": primary,
          "line-width": variant === "ledger" ? 5 : 12,
          "line-opacity": variant === "ledger" ? 0.65 : 0.35,
        },
      },
      ...(variant === "ledger"
        ? ([
            {
              id: "candidate-selection",
              type: "line",
              filter: [
                "all",
                ["==", ["get", "selected"], true],
                [
                  "in",
                  ["get", "evidence"],
                  ["literal", ["planned", "inferred"]],
                ],
              ],
              paint: {
                "line-color": primary,
                "line-width": 4,
                "line-opacity": 0.8,
                "line-dasharray": [2, 2],
              },
            },
          ] satisfies MapOverlay["layers"])
        : []),
      {
        id: "hit-area",
        type: "line",
        paint: { "line-color": primary, "line-width": 18, "line-opacity": 0 },
      },
    ],
  };
  const chooseEvent = (eventId: string) =>
    onSelectionChange(selectEvent(context, eventId));
  const inspectConnections = (hover: MapOverlayHoverDetailsContext) => {
    const hits = hover.selections.filter(
      (item) => item.overlayId === overlayId,
    );
    const external = {
      ...hover,
      overlays: hover.overlays.filter((item) => item.id !== overlayId),
      selections: hover.selections.filter(
        (item) => item.overlayId !== overlayId,
      ),
    };
    return (
      <>
        {hits.map(({ feature }) => {
          const connection = segments.find((item) => item.id === feature.id);
          if (!connection) return null;
          const candidates = paths.filter((item) =>
            item.segmentIds.includes(connection.id),
          );
          return (
            <div className={styles.preview} key={connection.id}>
              <strong>{connection.label}</strong>
              <span>
                {candidates.map((item) => item.label).join(" · ") ||
                  "No candidate membership supplied"}
              </span>
              <Button
                size="sm"
                variant="text"
                onPress={() =>
                  onSelectionChange({
                    type: "segment",
                    segmentId: connection.id,
                  })
                }
              >
                Inspect connection
              </Button>
            </div>
          );
        })}
        {external.overlays.length > 0 &&
          (map.renderOverlayHoverDetails
            ? map.renderOverlayHoverDetails(external)
            : external.selections.map((item, index) => (
                <React.Fragment key={index}>
                  {map.renderOverlayDetails?.(item)}
                </React.Fragment>
              )))}
      </>
    );
  };
  return (
    <section
      ref={root}
      className={styles.root}
      aria-label={ariaLabel}
      data-narrow={isNarrow}
      data-variant={variant}
    >
      {paths.length > 0 && (
        <div className={styles.paths} role="group" aria-label={text.paths}>
          <Text as="span" variant="caption" color="subdued">
            {text.paths}
          </Text>
          <Button
            size="sm"
            variant={!path ? "filled" : "outlined"}
            aria-pressed={!path}
            onPress={() =>
              onSelectionChange(
                event ? { type: "event", eventId: event.id } : null,
              )
            }
          >
            {text.allPaths}
          </Button>
          {paths.map((item, index) => (
            <div className={styles.pathOption} key={item.id}>
              <Button
                size="sm"
                variant={path?.id === item.id ? "filled" : "outlined"}
                aria-pressed={path?.id === item.id}
                aria-describedby={
                  renderPathTrailing
                    ? `${id}-path-${index}-annotation`
                    : undefined
                }
                onPress={() =>
                  onSelectionChange({ type: "path", pathId: item.id })
                }
              >
                {item.label}
              </Button>
              {renderPathTrailing && (
                <div id={`${id}-path-${index}-annotation`}>
                  {renderPathTrailing(item)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className={styles.layout}>
        {isNarrow && (
          <div className={styles.views}>
            <Tabs
              containerComponent="div"
              containerProps={{}}
              listComponent="div"
              listProps={{
                role: "tablist",
                "aria-label": "Investigation views",
              }}
            >
              {(["events", "map"] as const).map((item) => (
                <Tabs.Item
                  key={item}
                  containerComponent="div"
                  tabComponent="button"
                  type="button"
                  role="tab"
                  id={`${id}-${item}-tab`}
                  aria-controls={`${id}-${item}-panel`}
                  aria-selected={view === item}
                  tabIndex={view === item ? 0 : -1}
                  isSelected={view === item}
                  onClick={() => setView(item)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    const next =
                      e.key === "Home"
                        ? "events"
                        : e.key === "End"
                          ? "map"
                          : ["ArrowLeft", "ArrowRight"].includes(e.key)
                            ? item === "events"
                              ? "map"
                              : "events"
                            : null;
                    if (next) {
                      e.preventDefault();
                      setView(next);
                      document.getElementById(`${id}-${next}-tab`)?.focus();
                    }
                  }}
                >
                  {item === "events" ? text.timeline : text.mapTab}
                </Tabs.Item>
              ))}
            </Tabs>
          </div>
        )}
        <section
          className={styles.timeline}
          id={`${id}-events-panel`}
          data-view-panel="events"
          role={isNarrow ? "tabpanel" : undefined}
          tabIndex={isNarrow ? 0 : -1}
          hidden={isNarrow && view !== "events"}
          aria-labelledby={isNarrow ? `${id}-events-tab` : `${id}-events`}
        >
          <div className={styles.timelineContent} data-timeline-scroll>
            <div className={styles.heading}>
              <Text as="h3" variant="heading5" id={`${id}-events`}>
                {text.timeline}
              </Text>
              <Text as="span" variant="caption" color="subdued">
                {scoped
                  ? `${context.events.length} of ${events.length}`
                  : `${events.length} events`}
              </Text>
            </div>
            {scoped && (
              <div className={styles.filter}>
                <Checkbox isSelected={relatedOnly} onChange={setRelatedOnly}>
                  {text.relatedOnly}
                </Checkbox>
                <span>
                  {segment
                    ? "Events in candidate paths"
                    : path
                      ? "Events in this path"
                      : "Events at this location"}
                </span>
              </div>
            )}
            <EventTimeline
              {...timeline}
              variant={
                timeline?.variant ??
                (variant === "ledger" ? "ledger" : "timeline")
              }
              size={
                timeline?.size ?? (variant === "ledger" ? "compact" : undefined)
              }
              connections={eventConnections}
              selectedConnectionIds={
                selection ? context.connections?.map((item) => item.id) : []
              }
              events={visibleEvents.map((item) =>
                repeatedLabels.has(item.id) &&
                item.receivedTimeLabel &&
                !item.detailLabel &&
                timeline?.size !== "detailed"
                  ? {
                      ...item,
                      detailLabel: `Received ${item.receivedTimeLabel}`,
                    }
                  : item,
              )}
              relatedIds={relatedIds}
              selectedId={event?.id ?? null}
              onSelectedIdChange={chooseEvent}
              ariaLabel={text.timeline}
            />
          </div>
        </section>
        <section
          className={styles.map}
          id={`${id}-map-panel`}
          data-view-panel="map"
          role={isNarrow ? "tabpanel" : undefined}
          tabIndex={isNarrow ? 0 : -1}
          hidden={isNarrow && view !== "map"}
          aria-label={isNarrow ? undefined : text.map}
          aria-labelledby={isNarrow ? `${id}-map-tab` : undefined}
        >
          <NetworkMap
            {...map}
            inspectionRevision={JSON.stringify([
              map.inspectionRevision,
              selection?.type,
              event?.id,
              location?.id,
              path?.id,
              segment?.id,
            ])}
            aria-label={map["aria-label"] ?? text.map}
            facilities={mapLocations}
            segments={mapSegments}
            selectedFacilityId={location?.id}
            selectedSegmentId={segment?.id}
            onFacilitySelect={(locationId) =>
              onSelectionChange({ type: "location", locationId })
            }
            overlays={[...(map.overlays ?? []), connections]}
            onOverlaySelect={(hit) => {
              if (hit.overlayId === overlayId)
                onSelectionChange({
                  type: "segment",
                  segmentId: String(hit.feature.id),
                });
              else map.onOverlaySelect?.(hit);
            }}
            renderFacilityDetails={
              map.renderFacilityDetails ??
              (({ facility }) => (
                <div className={styles.preview}>
                  <strong>{facility.label}</strong>
                  <span>
                    {
                      events.filter((item) => item.locationId === facility.id)
                        .length
                    }{" "}
                    associated events
                  </span>
                </div>
              ))
            }
            renderOverlayHoverDetails={inspectConnections}
            showSelectionDetails={false}
            showLegend={map.showLegend ?? false}
            showDataTable={map.showDataTable ?? false}
            height={map.height ?? (isNarrow ? 260 : "fill")}
            controlPlacement={map.controlPlacement ?? "map"}
          />
          <details className={styles.index}>
            <summary>Browse locations and connections</summary>
            <div className={styles.indexItems}>
              {locations.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="text"
                  aria-pressed={location?.id === item.id}
                  onPress={() =>
                    onSelectionChange({ type: "location", locationId: item.id })
                  }
                >
                  {item.label}
                </Button>
              ))}
              {segments.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="text"
                  aria-pressed={segment?.id === item.id}
                  onPress={() =>
                    onSelectionChange({ type: "segment", segmentId: item.id })
                  }
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </details>
        </section>
        <InvestigationDetails
          context={context}
          isNarrow={isNarrow}
          chooseEvent={chooseEvent}
          clear={() => onSelectionChange(null)}
          renderDetails={renderDetails}
          labels={text}
        />
      </div>
    </section>
  );
}
