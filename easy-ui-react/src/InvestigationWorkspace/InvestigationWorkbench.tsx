import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Marker as MapMarker, Map as MapInstance } from "maplibre-gl";
import { Checkbox } from "../Checkbox";
import { Pill } from "../Pill";
import { EventDetails } from "../EventDetails";
import {
  EventTimeline,
  type EventTimelineConnectionContext,
  type EventTimelineEvent,
} from "../EventTimeline";
import { ConnectionGraph } from "../EventTimeline/ConnectionGraph";
import { getConnectionGraphLayout } from "../EventTimeline/connectionGraph";
import { NetworkMap, type NetworkMapProps } from "../NetworkMap";
import {
  resolveSelection,
  type InvestigationDetailsContext,
  type InvestigationRecords,
} from "./selection";
import {
  normalizeInvestigationGraph,
  validateInvestigationComparisons,
  type InvestigationGraph,
  type InvestigationPrediction,
  type InvestigationDeviation,
  type InvestigationAssessment,
} from "./workbenchModel";
import {
  initialInvestigationWorkbenchState,
  reduceInvestigationWorkbench,
  type InvestigationWorkbenchState,
  type InvestigationWorkbenchAction,
  type InvestigationMode,
} from "./workbenchState";
import { workbenchMapData } from "./workbenchMap";
import styles from "./InvestigationWorkbench.module.scss";

type WorkbenchMapOptions = Omit<
  NetworkMapProps,
  | "facilities"
  | "segments"
  | "selectedFacilityId"
  | "selectedSegmentId"
  | "onFacilitySelect"
  | "showSelectionDetails"
  | "clusterFacilities"
>;
export type InvestigationWorkbenchProps = {
  graph: InvestigationGraph;
  map: WorkbenchMapOptions;
  title?: string;
  /** Optional investigation-level assessment; never inferred from event annotations. */
  summary?: ReactNode;
  /** Caller-owned header actions remain available at every width. */
  actions?: ReactNode;
  predictions?: readonly InvestigationPrediction[];
  deviations?: readonly InvestigationDeviation[];
  assessments?: readonly InvestigationAssessment[];
  state?: InvestigationWorkbenchState;
  defaultState?: Partial<InvestigationWorkbenchState>;
  onStateChange?: (state: InvestigationWorkbenchState) => void;
  renderConnectionMetrics?: (
    context: EventTimelineConnectionContext,
  ) => ReactNode;
  renderEvent?: (context: InvestigationDetailsContext) => ReactNode;
  renderEvidence?: (context: InvestigationDetailsContext) => ReactNode;
  renderDeviationEvidence?: (
    deviation: InvestigationDeviation,
    context: InvestigationDetailsContext,
  ) => ReactNode;
};
const modes: readonly { id: InvestigationMode; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "focused", label: "Focused history" },
  { id: "deviation", label: "Deviation analysis" },
];
const noPredictions: readonly InvestigationPrediction[] = [];
const noDeviations: readonly InvestigationDeviation[] = [];
const noAssessments: readonly InvestigationAssessment[] = [];

function Swatch({ color, dash }: { color: string; dash?: readonly number[] }) {
  return (
    <svg
      width="24"
      height="12"
      viewBox="0 0 24 12"
      aria-hidden="true"
      focusable="false"
      className={styles.swatch}
    >
      <path
        d="M2 6H22"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={dash?.join(" ")}
      />
    </svg>
  );
}

function BranchList({
  events,
  connections,
  colors,
  selectedId,
  onSelect,
}: {
  events: readonly EventTimelineEvent[];
  connections: Required<InvestigationRecords>["connections"];
  colors: Readonly<Record<string, string>>;
  selectedId?: string;
  onSelect: (event: EventTimelineEvent) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const layout = useMemo(
    () => getConnectionGraphLayout(events, connections),
    [events, connections],
  );
  return (
    <div ref={root} className={styles.branchList}>
      <ol style={{ paddingInlineStart: layout.width }}>
        {events.map((event, index) => (
          <li key={event.id}>
            <button
              type="button"
              ref={(node) => {
                if (node) buttons.current.set(event.id, node);
                else buttons.current.delete(event.id);
              }}
              aria-current={event.id === selectedId ? "true" : undefined}
              title={`${event.label} · ${event.locationLabel ?? "Location unknown"} · ${event.timeLabel ?? "Time unknown"}`}
              onClick={() => onSelect(event)}
            >
              <span className={styles.eventCode}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.branchName}>
                {event.locationLabel ?? event.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <ConnectionGraph
        events={events}
        connections={connections}
        pathColors={colors}
        rowElements={buttons.current}
        rootRef={root}
      />
    </div>
  );
}

function DivergenceCallout({
  map,
  coordinate,
  time,
  onSelect,
}: {
  map: MapInstance | null;
  coordinate?: readonly [number, number];
  time?: string;
  onSelect: () => void;
}) {
  const [element] = useState(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );
  const [unavailable, setUnavailable] = useState(false);
  const lon = coordinate?.[0];
  const lat = coordinate?.[1];
  useEffect(() => {
    if (!map || !element || lon === undefined || lat === undefined) return;
    let cancelled = false;
    let marker: MapMarker | undefined;
    setUnavailable(false);
    // MapLibre is ESM-only. Loading inside the effect keeps the public entry
    // importable by CommonJS and server-rendered consumers without a DOM.
    void import("maplibre-gl")
      .then(({ Marker }) => {
        if (cancelled) return;
        marker = new Marker({ element, anchor: "bottom", offset: [0, -16] })
          .setLngLat([lon, lat])
          .addTo(map);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
      marker?.remove();
    };
  }, [map, element, lon, lat]);
  if (unavailable && coordinate)
    return (
      <p role="status" className={styles.muted}>
        Map callout unavailable. Inspect the supplied divergence below.
      </p>
    );
  return element && coordinate
    ? createPortal(
        <button
          type="button"
          className={styles.divergenceCallout}
          onClick={onSelect}
        >
          <strong>First divergence</strong>
          <span>{time ?? "Time not supplied"}</span>
        </button>,
        element,
      )
    : null;
}

/** Three coordinated views over one validated graph; forecasts never become scan records. */
export function InvestigationWorkbench({
  graph,
  map,
  title = "Investigation",
  summary,
  actions,
  predictions = noPredictions,
  deviations = noDeviations,
  assessments = noAssessments,
  state: controlledState,
  defaultState,
  onStateChange,
  renderConnectionMetrics,
  renderEvent,
  renderEvidence,
  renderDeviationEvidence,
}: InvestigationWorkbenchProps) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const [internalState, setInternalState] =
    useState<InvestigationWorkbenchState>(() => ({
      ...initialInvestigationWorkbenchState,
      ...defaultState,
    }));
  const state = controlledState ?? internalState;
  const normalized = useMemo(() => normalizeInvestigationGraph(graph), [graph]);
  const records = normalized.records;
  const comparisonIssues = useMemo(
    () =>
      validateInvestigationComparisons(
        records,
        predictions,
        deviations,
        assessments,
      ),
    [records, predictions, deviations, assessments],
  );
  const issues = [...normalized.issues, ...comparisonIssues];
  const dispatch = (action: InvestigationWorkbenchAction) => {
    const next = reduceInvestigationWorkbench(
      state,
      action,
      records,
      predictions,
    );
    // Repeated analysis commands must reveal their inspector even when the
    // mode is already active. A rejected command must not navigate the tabs;
    // controlled mode changes still wait for the owner to accept the state.
    if (
      next !== state &&
      state.mode === "deviation" &&
      next.mode === "deviation" &&
      (action.type === "compare" ||
        (action.type === "mode" && action.mode === "deviation"))
    )
      setTab("deviation");
    if (controlledState === undefined) setInternalState(next);
    onStateChange?.(next);
  };
  const [narrow, setNarrow] = useState(false);
  const narrowMode = useRef(false);
  const focusAfterResize = useRef<"events" | "map" | "sidebar" | null>(null);
  const [mobileView, setMobileView] = useState<"events" | "map">("events");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
  const [tab, setTab] = useState<"event" | "deviation" | "evidence">("event");
  const tabsId = `${id}-inspector`;
  useEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const width = element.getBoundingClientRect().width;
      if (width <= 0) return;
      const next = width <= 760;
      if (next === narrowMode.current) return;
      focusAfterResize.current = null;
      const active = document.activeElement;
      if (active instanceof HTMLElement && element.contains(active)) {
        if (next) {
          if (active.closest("[data-workbench-sidebar]"))
            setSidebarExpanded(true);
          if (active.closest("[data-workbench-map]")) setMobileView("map");
          if (active.closest("[data-workbench-events]"))
            setMobileView("events");
        } else if (active.dataset.workbenchView) {
          focusAfterResize.current = active.dataset.workbenchView as
            "events" | "map";
        } else if (active.matches("[data-workbench-sidebar] > summary")) {
          focusAfterResize.current = "sidebar";
        }
      }
      narrowMode.current = next;
      setNarrow(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const target = focusAfterResize.current;
    focusAfterResize.current = null;
    if (target)
      root.current
        ?.querySelector<HTMLElement>(`[data-workbench-${target}]`)
        ?.focus({ preventScroll: true });
  }, [narrow]);
  useEffect(() => {
    setTab(state.mode === "deviation" ? "deviation" : "event");
  }, [state.mode]);
  const focused =
    state.mode === "overview"
      ? undefined
      : records.paths.find((path) => path.id === state.focusedPathId);
  const availablePredictions = predictions.filter(
    (prediction) => prediction.pathId === focused?.id,
  );
  const visiblePredictions = availablePredictions.filter((prediction) =>
    state.enabledPredictionIds.includes(prediction.id),
  );
  const comparedPrediction = visiblePredictions.find(
    (prediction) => prediction.id === state.comparisonPredictionId,
  );
  const context = resolveSelection(records, state.selection);
  const event = context.event;
  const disconnected = useMemo(
    () => records.events.filter((item) => !item.pathIds?.length),
    [records.events],
  );
  const disconnectedConnections = useMemo(() => {
    const ids = new Set(disconnected.map((item) => item.id));
    return records.connections.filter(
      (connection) =>
        ids.has(connection.fromEventId) && ids.has(connection.toEventId),
    );
  }, [records.connections, disconnected]);
  const visibleEvents = useMemo(
    () =>
      records.events.filter((item) =>
        focused
          ? item.pathIds?.includes(focused.id)
          : state.showDisconnected || item.pathIds?.length,
      ),
    [records.events, focused, state.showDisconnected],
  );
  const visibleConnections = useMemo(() => {
    const ids = new Set(visibleEvents.map((item) => item.id));
    return records.connections.filter(
      (connection) =>
        ids.has(connection.fromEventId) &&
        ids.has(connection.toEventId) &&
        (!focused || connection.pathIds?.includes(focused.id)),
    );
  }, [records.connections, visibleEvents, focused]);
  const palette = useMemo(
    () =>
      Object.fromEntries(records.paths.map((path) => [path.id, path.color!])),
    [records.paths],
  );
  const { mode, focusedPathId, enabledPredictionIds, comparisonPredictionId } =
    state;
  const mapData = useMemo(
    () =>
      workbenchMapData(
        records,
        { mode, focusedPathId, enabledPredictionIds, comparisonPredictionId },
        predictions,
        id,
      ),
    [
      records,
      mode,
      focusedPathId,
      enabledPredictionIds,
      comparisonPredictionId,
      predictions,
      id,
    ],
  );
  const overlays = useMemo(
    () => [...(map.overlays ?? []), ...mapData.overlays],
    [map.overlays, mapData.overlays],
  );
  const applicableDeviations = deviations.filter(
    (deviation) => deviation.predictionId === comparedPrediction?.id,
  );
  const selectedDeviation = applicableDeviations.find(
    (deviation) => deviation.eventId === event?.id,
  );
  // There is no cross-prediction "first" inferred from chronology. Each comparison supplies its own claim.
  const firstIds = [
    ...new Set(
      applicableDeviations.flatMap((deviation) =>
        deviation.firstDivergenceEventId
          ? [deviation.firstDivergenceEventId]
          : [],
      ),
    ),
  ];
  const divergenceEvent =
    firstIds.length === 1
      ? records.events.find((item) => item.id === firstIds[0])
      : undefined;
  const divergenceLocation = records.locations.find(
    (location) => location.id === divergenceEvent?.locationId,
  );
  const selectedAssessments = assessments.filter((assessment) =>
    assessment.target.type === "event"
      ? assessment.target.eventId === event?.id
      : assessment.target.type === "connection"
        ? context.connections?.some(
            (connection) =>
              connection.id ===
              (assessment.target as { connectionId: string }).connectionId,
          )
        : assessment.target.pathId === focused?.id,
  );
  const selectEvent = (item: EventTimelineEvent) =>
    dispatch({
      type: "select",
      selection: { type: "event", eventId: item.id },
    });
  const showEventRisks = (item: EventTimelineEvent) => {
    if (!state.showRisks) return null;
    const flags = assessments.filter(
      (assessment) =>
        assessment.target.type === "event" &&
        assessment.target.eventId === item.id,
    );
    if (!flags.length) return null;
    return (
      <span className={styles.riskFlags}>
        {flags.map((flag) => (
          <Pill key={flag.id} size="xs" tone={flag.tone}>
            {flag.label}
          </Pill>
        ))}
      </span>
    );
  };
  const connectionEvidence = (
    connectionContext: EventTimelineConnectionContext,
  ) => {
    const flags = state.showRisks
      ? assessments.filter(
          (assessment) =>
            assessment.target.type === "connection" &&
            assessment.target.connectionId === connectionContext.connection.id,
        )
      : [];
    const metrics = renderConnectionMetrics?.(connectionContext);
    if (!flags.length) return metrics;
    return (
      <>
        <span className={styles.riskFlags}>
          {flags.map((flag) => (
            <Pill key={flag.id} size="xs" tone={flag.tone}>
              {flag.label}
            </Pill>
          ))}
        </span>
        {metrics}
      </>
    );
  };
  const selectedConnectionIds = state.selection
    ? context.connections?.map((connection) => connection.id)
    : [];
  const selectedIndex = visibleEvents.findIndex(
    (item) => item.id === event?.id,
  );
  useEffect(() => {
    if (narrow && mobileView !== "events") return;
    const panel = root.current?.querySelector<HTMLElement>(
      "[data-workbench-events] > [data-workbench-scroll]",
    );
    const selected = panel?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!panel || !selected) return;
    // A map/location selection may target a row inside the closed unassigned
    // disclosure. Reveal it before measuring without moving keyboard focus.
    let disclosure = selected.closest("details");
    while (disclosure && panel.contains(disclosure)) {
      disclosure.open = true;
      disclosure = disclosure.parentElement?.closest("details") ?? null;
    }
    const bounds = panel.getBoundingClientRect();
    const row = selected.getBoundingClientRect();
    if (row.top < bounds.top) panel.scrollTop += row.top - bounds.top - 8;
    else if (row.bottom > bounds.bottom)
      panel.scrollTop += row.bottom - bounds.bottom + 8;
  }, [
    event?.id,
    records.events,
    state.showDisconnected,
    narrow,
    mobileView,
    focused?.id,
  ]);
  const currentTab = tab;
  const inspectorTabs = ["event", "deviation", "evidence"] as const;
  const changeTab = (next: typeof tab) => {
    setTab(next);
    root.current
      ?.querySelector<HTMLButtonElement>(`[id="${tabsId}-${next}-tab"]`)
      ?.focus();
  };
  const overlaySelection: NetworkMapProps["onOverlaySelect"] = (hit) => {
    const segmentId = hit.feature.properties?.segmentId;
    const predictionId = hit.feature.properties?.predictionId;
    if (
      hit.overlayId.startsWith(`${id}-history-`) &&
      typeof segmentId === "string"
    )
      dispatch({ type: "select", selection: { type: "segment", segmentId } });
    else if (
      hit.overlayId.startsWith(`${id}-forecast-`) &&
      typeof predictionId === "string"
    )
      dispatch({ type: "compare", id: predictionId });
    else map.onOverlaySelect?.(hit);
  };
  if (issues.length)
    return (
      <section ref={root} className={styles.root} aria-label={title}>
        <div role="alert" className={styles.modelError}>
          <h2>Investigation data needs attention</h2>
          <p>
            No relationships are drawn until the supplied graph is consistent.
          </p>
          <ul>
            {issues.map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  return (
    <section
      ref={root}
      className={styles.root}
      aria-label={title}
      data-mode={state.mode}
      data-narrow={narrow}
    >
      <header className={styles.header}>
        <div className={styles.title}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />
          </svg>
          <h2>{title}</h2>
          {summary}
        </div>
        <div
          className={styles.modeSwitch}
          role="group"
          aria-label="Investigation mode"
        >
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={state.mode === mode.id}
              disabled={mode.id !== "overview" && !records.paths.length}
              onClick={() => dispatch({ type: "mode", mode: mode.id })}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.headerCounts}>
            {records.events.length} observations · {records.paths.length}{" "}
            histories
          </span>
          {actions}
        </div>
      </header>
      <div className={styles.body}>
        <details
          className={styles.sidebar}
          data-workbench-sidebar
          tabIndex={-1}
          open={!narrow || sidebarExpanded}
          onToggle={(e) => {
            if (narrow) setSidebarExpanded(e.currentTarget.open);
          }}
        >
          <summary>Histories &amp; comparisons</summary>
          <div className={styles.sidebarContent}>
            <section aria-label="Histories">
              <h3>Histories</h3>
              <p className={styles.muted}>Select a history to focus</p>
              <div className={styles.historyList}>
                {records.paths.map((path) => {
                  const members = records.events.filter((item) =>
                    item.pathIds?.includes(path.id),
                  );
                  const pathLinks = records.connections.filter((connection) =>
                    connection.pathIds?.includes(path.id),
                  );
                  const isFocused = focused?.id === path.id;
                  return (
                    <div
                      key={path.id}
                      className={styles.history}
                      data-active={isFocused || undefined}
                    >
                      <button
                        type="button"
                        className={styles.historyButton}
                        aria-pressed={isFocused}
                        onClick={() =>
                          dispatch({ type: "focus", pathId: path.id })
                        }
                      >
                        <Swatch color={path.color!} />
                        <span>
                          <strong className={styles.historyName}>
                            {path.label}
                          </strong>
                          <small>
                            {members.length} observations ·{" "}
                            {graph.paths.find((item) => item.id === path.id)
                              ?.kind ?? "candidate"}
                          </small>
                        </span>
                      </button>
                      <details
                        className={styles.branchDisclosure}
                        open={isFocused || undefined}
                      >
                        <summary>Branches &amp; observations</summary>
                        <BranchList
                          events={members}
                          connections={pathLinks}
                          colors={palette}
                          selectedId={event?.id}
                          onSelect={selectEvent}
                        />
                      </details>
                    </div>
                  );
                })}
                {!records.paths.length && (
                  <p className={styles.muted}>
                    No candidate histories supplied.
                  </p>
                )}
              </div>
            </section>
            <section
              aria-label="Forecast comparison"
              className={styles.forecastControls}
            >
              <h3>Compare predictions</h3>
              {!focused ? (
                <p className={styles.muted}>
                  Focus a history to reveal its forecasts.
                </p>
              ) : !availablePredictions.length ? (
                <p className={styles.muted}>
                  No forecasts supplied for {focused.label}.
                </p>
              ) : (
                availablePredictions.map((prediction) => (
                  <div className={styles.forecastOption} key={prediction.id}>
                    <Checkbox
                      isSelected={state.enabledPredictionIds.includes(
                        prediction.id,
                      )}
                      onChange={(enabled) =>
                        dispatch({
                          type: "prediction",
                          id: prediction.id,
                          enabled,
                        })
                      }
                    >
                      <span>
                        <Swatch
                          color={prediction.color}
                          dash={prediction.dash ?? [6, 3]}
                        />
                        {prediction.label}
                      </span>
                    </Checkbox>
                    {prediction.confidence && (
                      <span
                        className={styles.muted}
                        title={prediction.confidence.description}
                      >
                        {prediction.confidence.valueLabel}
                      </span>
                    )}
                    <button
                      type="button"
                      className={styles.textButton}
                      aria-label={`Compare ${prediction.label}`}
                      onClick={() =>
                        dispatch({ type: "compare", id: prediction.id })
                      }
                    >
                      Analyze deviation
                    </button>
                  </div>
                ))
              )}
            </section>
            <section
              className={styles.showOptions}
              aria-label="Display options"
            >
              <h3>Show</h3>
              <Checkbox
                isSelected={state.showDisconnected}
                onChange={(show) => dispatch({ type: "disconnected", show })}
              >
                Unassigned observations ({disconnected.length})
              </Checkbox>
              <Checkbox
                isSelected={state.showRisks}
                onChange={(show) => dispatch({ type: "risks", show })}
              >
                Risk indicators ({assessments.length})
              </Checkbox>
            </section>
          </div>
        </details>
        {narrow && (
          <div
            className={styles.mobileViews}
            role="group"
            aria-label="Investigation views"
          >
            <button
              type="button"
              data-workbench-view="events"
              aria-controls={`${id}-events`}
              aria-pressed={mobileView === "events"}
              onClick={() => setMobileView("events")}
            >
              Events
            </button>
            <button
              type="button"
              data-workbench-view="map"
              aria-controls={`${id}-map`}
              aria-pressed={mobileView === "map"}
              onClick={() => setMobileView("map")}
            >
              Map
            </button>
          </div>
        )}
        <section
          className={styles.timelinePanel}
          data-workbench-events
          id={`${id}-events`}
          tabIndex={-1}
          hidden={narrow && mobileView !== "events"}
          aria-label="Observation ledger"
        >
          <header className={styles.panelHeading}>
            <div>
              <h3>
                {focused ? (
                  <>
                    <Swatch color={focused.color!} />
                    {focused.label}
                  </>
                ) : (
                  "All reported observations"
                )}
              </h3>
              <span className={styles.panelMeta}>
                {visibleEvents.length} observations · caller-supplied order
              </span>
            </div>
          </header>
          <div className={styles.columnLabels} aria-hidden="true">
            <span>Time</span>
            <span>Event</span>
            <span>Incoming evidence</span>
          </div>
          <div className={styles.timelineScroll} data-workbench-scroll>
            <EventTimeline
              events={visibleEvents}
              connections={visibleConnections}
              pathColors={palette}
              variant="ledger"
              size="compact"
              ledgerColumns
              metricsPlacement="inline"
              selectedId={event?.id ?? null}
              selectedConnectionIds={selectedConnectionIds}
              onSelectedIdChange={(eventId) =>
                dispatch({
                  type: "select",
                  selection: { type: "event", eventId },
                })
              }
              renderTrailing={showEventRisks}
              renderConnectionMetrics={connectionEvidence}
            />
            {focused && state.showDisconnected && disconnected.length > 0 && (
              <details className={styles.disconnected}>
                <summary>
                  Unassigned observations ({disconnected.length})
                </summary>
                <EventTimeline
                  events={disconnected}
                  connections={disconnectedConnections}
                  pathColors={palette}
                  variant="ledger"
                  size="compact"
                  ledgerColumns
                  metricsPlacement="inline"
                  selectedConnectionIds={selectedConnectionIds}
                  renderConnectionMetrics={connectionEvidence}
                  selectedId={event?.id ?? null}
                  renderTrailing={showEventRisks}
                  onSelectedIdChange={(eventId) =>
                    dispatch({
                      type: "select",
                      selection: { type: "event", eventId },
                    })
                  }
                />
              </details>
            )}
          </div>
          <footer className={styles.timelineFootnote}>
            Connections are supplied relationships, not proof of a traveled
            route.
          </footer>
        </section>
        <section
          className={styles.mapPanel}
          data-workbench-map
          id={`${id}-map`}
          tabIndex={-1}
          hidden={narrow && mobileView !== "map"}
          aria-label="History map"
        >
          <NetworkMap
            {...map}
            facilities={mapData.facilities}
            segments={mapData.segments}
            selectedFacilityId={context.location?.id}
            selectedSegmentId={context.segment?.id}
            onFacilitySelect={(locationId) =>
              dispatch({
                type: "select",
                selection: { type: "location", locationId },
              })
            }
            overlays={overlays}
            onOverlaySelect={overlaySelection}
            onMapReady={(instance) => {
              setMapInstance(instance);
              map.onMapReady?.(instance);
            }}
            title={map.title ?? "Reported locations"}
            description={
              map.description ??
              (focused
                ? `${focused.label} · ${visiblePredictions.length} forecasts visible`
                : "Candidate histories · no predictions in overview")
            }
            controls={
              map.controls === false
                ? false
                : {
                    fitAll: true,
                    latestEvent: false,
                    selectedSegment: false,
                    risk: false,
                    weather: false,
                    deliverySurface: false,
                    navigation: true,
                    scale: true,
                    ...map.controls,
                  }
            }
            controlLabels={{ fitAll: "Fit", ...map.controlLabels }}
            height={map.height ?? (narrow ? 280 : 350)}
            controlPlacement={map.controlPlacement ?? "map"}
            connectionStyle="subtle"
            showLegend={false}
            showDataTable={false}
            showViewScale={false}
            showSelectionDetails={false}
            renderOverlayHoverDetails={(hover) => {
              const external = {
                ...hover,
                selections: hover.selections.filter(
                  (hit) => !hit.overlayId.startsWith(`${id}-`),
                ),
                overlays: hover.overlays.filter(
                  (overlay) => !overlay.id.startsWith(`${id}-`),
                ),
              };
              return (
                <div className={styles.overlayDetails}>
                  {hover.selections
                    .filter((hit) => hit.overlayId.startsWith(`${id}-`))
                    .map((hit) => (
                      <div key={`${hit.overlayId}-${hit.feature.id}`}>
                        <strong>
                          {String(
                            hit.feature.properties?.label ??
                              "Candidate connection",
                          )}
                        </strong>
                        {hit.feature.properties?.predictionId ? (
                          <span>
                            Forecast · {String(hit.feature.properties.source)} ·{" "}
                            {String(hit.feature.properties.asOf)}
                          </span>
                        ) : (
                          <span>Supplied candidate relationship</span>
                        )}
                      </div>
                    ))}
                  {external.overlays.length > 0 &&
                    (map.renderOverlayHoverDetails
                      ? map.renderOverlayHoverDetails(external)
                      : external.selections.map((hit, index) => (
                          <React.Fragment key={index}>
                            {map.renderOverlayDetails?.(hit)}
                          </React.Fragment>
                        )))}
                </div>
              );
            }}
          />
          <DivergenceCallout
            map={mapInstance}
            coordinate={
              state.mode === "deviation"
                ? divergenceLocation?.coordinates
                : undefined
            }
            time={divergenceEvent?.timeLabel}
            onSelect={() => {
              if (divergenceEvent) selectEvent(divergenceEvent);
            }}
          />
          <div className={styles.legend} aria-label="Map legend">
            {(focused ? [focused] : records.paths).map((path) => (
              <span key={path.id}>
                <Swatch
                  color={path.color!}
                  dash={
                    records.segments.some(
                      (segment) =>
                        path.segmentIds.includes(segment.id) &&
                        ["inferred", "planned"].includes(segment.evidence),
                    )
                      ? [2, 2]
                      : undefined
                  }
                />
                {path.label} · history
              </span>
            ))}
            {visiblePredictions.map((prediction) => (
              <span key={prediction.id}>
                <Swatch
                  color={prediction.color}
                  dash={prediction.dash ?? [6, 3]}
                />
                {prediction.label} · forecast
              </span>
            ))}
          </div>
        </section>
        <section
          className={styles.inspector}
          aria-label="Investigation inspector"
        >
          <div className={styles.inspectorHeader}>
            <div>
              <span className={styles.muted}>
                {event
                  ? event.label
                  : context.path
                    ? "History"
                    : context.location
                      ? "Location"
                      : context.segment
                        ? "Connection"
                        : "Selection"}
              </span>
              <h3>
                {event?.locationLabel ??
                  event?.label ??
                  context.location?.label ??
                  context.path?.label ??
                  context.segment?.label ??
                  "Select an observation"}
              </h3>
            </div>
            <div
              className={styles.eventNavigation}
              role="group"
              aria-label="Event navigation"
            >
              <button
                type="button"
                aria-label="Previous event"
                disabled={selectedIndex <= 0}
                onClick={() => selectEvent(visibleEvents[selectedIndex - 1])}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next event"
                disabled={
                  !visibleEvents.length ||
                  selectedIndex === visibleEvents.length - 1
                }
                onClick={() => selectEvent(visibleEvents[selectedIndex + 1])}
              >
                →
              </button>
            </div>
          </div>
          <div
            className={styles.inspectorTabs}
            role="tablist"
            aria-label="Inspector sections"
          >
            {inspectorTabs.map((item, index) => (
              <button
                key={item}
                type="button"
                role="tab"
                id={`${tabsId}-${item}-tab`}
                aria-controls={`${tabsId}-${item}-panel`}
                aria-selected={currentTab === item}
                tabIndex={currentTab === item ? 0 : -1}
                onClick={() => setTab(item)}
                onKeyDown={(e) => {
                  const next =
                    e.key === "ArrowRight"
                      ? inspectorTabs[(index + 1) % 3]
                      : e.key === "ArrowLeft"
                        ? inspectorTabs[(index + 2) % 3]
                        : e.key === "Home"
                          ? "event"
                          : e.key === "End"
                            ? "evidence"
                            : null;
                  if (next) {
                    e.preventDefault();
                    changeTab(next);
                  }
                }}
              >
                {item === "event"
                  ? "Event"
                  : item === "deviation"
                    ? "Deviation"
                    : "Evidence"}
              </button>
            ))}
          </div>
          <div role="status" className={styles.srOnly}>
            {event
              ? `Selected ${event.label}, ${event.locationLabel ?? "location unknown"}, ${event.timeLabel ?? "time unknown"}`
              : "Selection updated"}
          </div>
          <div className={styles.inspectorBody}>
            <div
              role="tabpanel"
              id={`${tabsId}-event-panel`}
              aria-labelledby={`${tabsId}-event-tab`}
              hidden={currentTab !== "event"}
            >
              {!context.isAvailable ? (
                <p>The selected record is no longer available.</p>
              ) : event ? (
                <>
                  {focused && !event.pathIds?.includes(focused.id) && (
                    <p className={styles.notice}>
                      This observation is outside {focused.label}.
                    </p>
                  )}
                  <EventDetails
                    event={event}
                    showEventId
                    showLocation={false}
                  />
                  {!selectedAssessments.length && (
                    <p className={styles.muted}>
                      No assessment supplied for this observation.
                    </p>
                  )}
                  {renderEvent?.(context)}
                </>
              ) : (
                <>
                  {state.selection?.type === "location" && (
                    <>
                      <p>
                        {context.events.length} observations at this location.
                        Repeated visits remain separate.
                      </p>
                      <div className={styles.locationVisits}>
                        {context.events.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => selectEvent(item)}
                          >
                            {item.label} · {item.timeLabel ?? "Time unknown"}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {state.selection?.type === "path" && (
                    <p>
                      {context.path?.description ??
                        "Select an observation to inspect its evidence."}
                    </p>
                  )}
                  {state.selection?.type === "segment" && (
                    <>
                      <p>{context.segment?.label}</p>
                      <p className={styles.muted}>
                        {context.connections?.length ?? 0} explicit event
                        relationships reference this connection.
                      </p>
                    </>
                  )}
                  {!state.selection && (
                    <p className={styles.muted}>
                      Select an event, location, or history. Selecting a
                      location does not choose an arbitrary visit.
                    </p>
                  )}
                </>
              )}
              {state.selection && context.isAvailable && (
                <>
                  {selectedAssessments.map((assessment) => (
                    <div key={assessment.id} className={styles.assessment}>
                      <Pill size="xs" tone={assessment.tone}>
                        {assessment.label}
                      </Pill>
                      <p>{assessment.summary}</p>
                      <small>
                        {assessment.source} · {assessment.asOf}
                      </small>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div
              role="tabpanel"
              id={`${tabsId}-deviation-panel`}
              aria-labelledby={`${tabsId}-deviation-tab`}
              hidden={currentTab !== "deviation"}
            >
              {!focused ? (
                <p className={styles.muted}>
                  Focus a history and choose a forecast to compare.
                </p>
              ) : (
                <>
                  <label className={styles.comparisonSelect}>
                    Compare with{" "}
                    <select
                      aria-label="Comparison forecast"
                      value={comparedPrediction?.id ?? ""}
                      onChange={(e) => {
                        if (e.target.value)
                          dispatch({ type: "compare", id: e.target.value });
                      }}
                    >
                      <option value="">Select a forecast</option>
                      {availablePredictions.map((prediction) => (
                        <option key={prediction.id} value={prediction.id}>
                          {prediction.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {comparedPrediction && (
                    <>
                      <p className={styles.provenance}>
                        Forecast: {comparedPrediction.source} · issued{" "}
                        {comparedPrediction.asOf}
                      </p>
                      {divergenceEvent && (
                        <button
                          type="button"
                          className={styles.divergenceLink}
                          onClick={() => selectEvent(divergenceEvent)}
                        >
                          <span>First supplied divergence</span>
                          <strong>
                            {divergenceEvent.locationLabel ??
                              divergenceEvent.label}
                          </strong>
                          <span>{divergenceEvent.timeLabel}</span>
                        </button>
                      )}
                      {firstIds.length > 1 && (
                        <p className={styles.notice}>
                          Supplied assessments disagree on the first divergence.
                          No single map callout is shown.
                        </p>
                      )}
                      {selectedDeviation ? (
                        <>
                          <p>{selectedDeviation.summary}</p>
                          <dl className={styles.facts}>
                            {selectedDeviation.facts.map((fact, index) => (
                              <div key={index}>
                                <dt>{fact.label}</dt>
                                <dd>{fact.value}</dd>
                              </div>
                            ))}
                          </dl>
                          {renderDeviationEvidence?.(
                            selectedDeviation,
                            context,
                          )}
                          <p className={styles.provenance}>
                            Assessment: {selectedDeviation.source} ·{" "}
                            {selectedDeviation.asOf}
                          </p>
                        </>
                      ) : (
                        <p className={styles.muted}>
                          No deviation assessment supplied for the selected
                          observation. Line separation alone is not a measured
                          deviation.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <div
              role="tabpanel"
              id={`${tabsId}-evidence-panel`}
              aria-labelledby={`${tabsId}-evidence-tab`}
              hidden={currentTab !== "evidence"}
            >
              {event ? (
                (renderEvidence?.(context) ?? (
                  <p className={styles.muted}>
                    No additional evidence supplied for this observation.
                  </p>
                ))
              ) : (
                <p className={styles.muted}>
                  Select an observation to inspect its references.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
