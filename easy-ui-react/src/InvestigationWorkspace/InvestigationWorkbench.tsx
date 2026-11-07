import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Map as MapInstance } from "maplibre-gl";
import { Checkbox } from "../Checkbox";
import { Pill } from "../Pill";
import {
  WorkspaceTabs,
  useWorkspaceTabIds,
  type WorkspaceTab,
} from "../WorkspaceTabs";
import {
  EventTimeline,
  type EventTimelineConnectionContext,
  type EventTimelineEvent,
} from "../EventTimeline";
import { NetworkMap, type NetworkMapProps } from "../NetworkMap";
import {
  resolveSelection,
  type InvestigationDetailsContext,
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
} from "./workbenchState";
import { workbenchMapData, selectedObservationOverlays } from "./workbenchMap";
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
export type InvestigationAnalysisContext = InvestigationDetailsContext & {
  selectedEventIds: readonly string[];
  focusedPathId: string | null;
  comparisonPredictionId: string | null;
};
export type InvestigationAnalysisView = Pick<
  WorkspaceTab,
  "id" | "label" | "count" | "isDisabled"
> & {
  /** Render caller-owned statistics or charts for the shared investigation selection. */
  render: (context: InvestigationAnalysisContext) => ReactNode;
};
export type InvestigationWorkbenchProps = {
  graph: InvestigationGraph;
  map: WorkbenchMapOptions;
  /** Additional analysis tabs. The built-in Map tab reserves the ID "map". */
  analysisViews?: readonly InvestigationAnalysisView[];
  /** Controlled presentation; independent from the investigation's record selection. */
  activeAnalysisViewId?: string;
  defaultAnalysisViewId?: string;
  onAnalysisViewChange?: (id: string) => void;
  title?: string;
  /** Optional investigation-level assessment; never inferred from event annotations. */
  summary?: ReactNode;
  /** Caller-owned header actions remain available at every width. */
  actions?: ReactNode;
  /** Show full descriptive history names; default is compact color + short identity. */
  showHistoryLabels?: boolean;
  /** Optional chart or analysis inside the active vertical drawer; supplied by the caller. */
  renderInspectorGraph?: (
    context: InvestigationDetailsContext & {
      selectedEventIds: readonly string[];
      focusedPathId: string | null;
    },
  ) => ReactNode;
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
const noPredictions: readonly InvestigationPrediction[] = [];
const noDeviations: readonly InvestigationDeviation[] = [];
const noAssessments: readonly InvestigationAssessment[] = [];
const noAnalysisViews: readonly InvestigationAnalysisView[] = [];

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

/** A stable chronology and shared analysis views with vertical evidence drawers. */
export function InvestigationWorkbench({
  graph,
  map,
  analysisViews = noAnalysisViews,
  activeAnalysisViewId,
  defaultAnalysisViewId = "map",
  onAnalysisViewChange,
  title = "Investigation",
  summary,
  actions,
  showHistoryLabels = false,
  renderInspectorGraph,
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
  const analysisIds = useWorkspaceTabIds();
  const analysisRoot = useRef<HTMLElement>(null);
  const focusedAnalysisContent = useRef<{
    id: string;
    element: HTMLElement;
  } | null>(null);
  const focusedDrawerControl = useRef<HTMLElement | null>(null);
  const [internalAnalysisId, setInternalAnalysisId] = useState(
    defaultAnalysisViewId,
  );
  const requestedAnalysisId = activeAnalysisViewId ?? internalAnalysisId;
  const analysisTabs = useMemo<readonly WorkspaceTab[]>(
    () => [
      { id: "map", label: "Map" },
      ...analysisViews.map(({ id: viewId, label, count, isDisabled }) => ({
        id: viewId,
        label,
        count,
        isDisabled,
      })),
    ],
    [analysisViews],
  );
  const analysisId = analysisTabs.some(
    (item) => item.id === requestedAnalysisId && !item.isDisabled,
  )
    ? requestedAnalysisId
    : "map";
  const duplicateAnalysisIds = analysisTabs.filter(
    (item, index) =>
      analysisTabs.findIndex((other) => other.id === item.id) !== index,
  );
  useEffect(() => {
    if (
      activeAnalysisViewId === undefined &&
      requestedAnalysisId !== analysisId
    )
      setInternalAnalysisId(analysisId);
  }, [activeAnalysisViewId, requestedAnalysisId, analysisId]);
  useLayoutEffect(() => {
    const previous = focusedAnalysisContent.current;
    if (
      !previous ||
      (previous.id === analysisId && previous.element.isConnected)
    )
      return;
    if (
      document.activeElement === previous.element ||
      document.activeElement === document.body
    ) {
      document
        .getElementById(analysisIds.tabId(analysisId))
        ?.focus({ preventScroll: true });
    }
    focusedAnalysisContent.current = null;
  }, [analysisId, analysisIds, analysisViews]);
  const chooseAnalysis = (viewId: string) => {
    if (activeAnalysisViewId === undefined) setInternalAnalysisId(viewId);
    onAnalysisViewChange?.(viewId);
  };
  const normalized = useMemo(() => normalizeInvestigationGraph(graph), [graph]);
  const records = normalized.records;
  const [internalState, setInternalState] =
    useState<InvestigationWorkbenchState>(() => {
      const initial = {
        ...initialInvestigationWorkbenchState,
        ...defaultState,
      };
      return defaultState?.selection &&
        defaultState.selectedEventIds === undefined
        ? reduceInvestigationWorkbench(
            initial,
            { type: "select", selection: defaultState.selection },
            records,
            predictions,
          )
        : initial;
    });
  const state = controlledState ?? internalState;
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
    ) {
      setTab("deviation");
      setDrawerOpen(true);
    }
    if (
      action.type === "focus" &&
      state.selection?.type === "path" &&
      state.selection.pathId === action.pathId
    )
      setDrawerOpen(true);
    if (controlledState === undefined) setInternalState(next);
    onStateChange?.(next);
  };
  const [narrow, setNarrow] = useState(false);
  const narrowMode = useRef(false);
  const focusAfterResize = useRef<"events" | "analysis" | "drawer" | null>(
    null,
  );
  const focusAfterDrawerId = useRef<string | null>(null);
  const [mobileView, setMobileView] = useState<"events" | "analysis">("events");
  const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
  const [tab, setTab] = useState<"event" | "deviation" | "evidence">("event");
  const [multiSelect, setMultiSelect] = useState(false);
  const hasSelection = Boolean(state.selection);
  const selectionKey = JSON.stringify([
    state.selection?.type,
    state.selection?.eventId,
    state.selection?.type === "path" ? state.selection.pathId : null,
    state.selection?.type === "location" ? state.selection.locationId : null,
    state.selection?.type === "segment" ? state.selection.segmentId : null,
  ]);
  const [drawerOpen, setDrawerOpen] = useState(
    hasSelection || state.mode === "deviation",
  );
  useEffect(() => {
    setDrawerOpen(hasSelection || state.mode === "deviation");
  }, [selectionKey, hasSelection, state.mode, state.comparisonPredictionId]);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const anchorId = useRef<string | null>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const expandedPanel = analysisRoot;
  useEffect(() => {
    if (!analysisExpanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAnalysisExpanded(false);
        expandButton.current?.focus({ preventScroll: true });
      }
    };
    const closeOnNativeExit = () => {
      if (!document.fullscreenElement) {
        setAnalysisExpanded(false);
        expandButton.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("fullscreenchange", closeOnNativeExit);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("fullscreenchange", closeOnNativeExit);
    };
  }, [analysisExpanded]);
  useEffect(() => {
    if (!mapInstance || analysisId !== "map") return;
    const frame = requestAnimationFrame(() => mapInstance.resize());
    return () => cancelAnimationFrame(frame);
  }, [mapInstance, analysisExpanded, narrow, mobileView, analysisId]);
  const tabsId = `${id}-inspector`;
  const selectionHelpId = `${id}-selection-help`;
  useEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const width = element.getBoundingClientRect().width;
      if (width <= 0) return;
      const next = width <= 760;
      if (next === narrowMode.current) return;
      focusAfterResize.current = null;
      focusAfterDrawerId.current = null;
      const active = document.activeElement;
      if (active instanceof HTMLElement && element.contains(active)) {
        if (active.closest("[data-workbench-drawer]")) {
          focusAfterResize.current = "drawer";
          focusAfterDrawerId.current = active.id || null;
        }
        if (next) {
          if (active.closest("[data-workbench-analysis]"))
            setMobileView("analysis");
          if (active.closest("[data-workbench-events]"))
            setMobileView("events");
        } else if (active.dataset.workbenchView) {
          focusAfterResize.current = active.dataset.workbenchView as
            "events" | "analysis";
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
    if (target === "drawer") {
      const previous = focusAfterDrawerId.current
        ? document.getElementById(focusAfterDrawerId.current)
        : null;
      const next =
        previous && root.current?.contains(previous)
          ? previous
          : root.current?.querySelector<HTMLElement>(
              '[data-workbench-drawer] [role="tab"][aria-selected="true"]',
            );
      next?.focus({ preventScroll: true });
      focusAfterDrawerId.current = null;
    } else if (target) {
      root.current
        ?.querySelector<HTMLElement>(`[data-workbench-${target}]`)
        ?.focus({ preventScroll: true });
    }
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
  const comparedPrediction =
    state.mode === "deviation"
      ? availablePredictions.find(
          (prediction) => prediction.id === state.comparisonPredictionId,
        )
      : undefined;
  const context = resolveSelection(records, state.selection);
  const selectedEventIds = useMemo(
    () =>
      (state.selectedEventIds ?? []).filter((eventId) =>
        records.events.some((event) => event.id === eventId),
      ),
    [state.selectedEventIds, records.events],
  );
  const event = context.event;
  useLayoutEffect(() => {
    const previous = focusedDrawerControl.current;
    if (
      !previous ||
      (previous.isConnected &&
        !previous.matches(":disabled") &&
        !previous.closest("[hidden]"))
    )
      return;
    focusedDrawerControl.current = null;
    if (
      document.activeElement !== previous &&
      document.activeElement !== document.body
    )
      return;
    const drawer = root.current?.querySelector<HTMLElement>(
      "[data-workbench-drawer]",
    );
    if (!drawer || drawer.closest("[hidden]")) return;
    const replacement = previous.id
      ? document.getElementById(previous.id)
      : null;
    const target =
      replacement &&
      drawer.contains(replacement) &&
      !replacement.matches(":disabled") &&
      !replacement.closest("[hidden]")
        ? replacement
        : drawer.querySelector<HTMLElement>(
            '[role="tab"][aria-selected="true"]',
          );
    target?.focus({ preventScroll: true });
  });
  const disconnected = useMemo(
    () => records.events.filter((item) => !item.pathIds?.length),
    [records.events],
  );
  // Focus is emphasis, not a filter: keep forks, rejoins and disjoint histories
  // in one chronology. Only the explicit unassigned toggle removes any rows.
  const visibleEvents = useMemo(
    () =>
      records.events.filter(
        (item) => state.showDisconnected || item.pathIds?.length,
      ),
    [records.events, state.showDisconnected],
  );
  const visibleConnections = useMemo(() => {
    const ids = new Set(visibleEvents.map((item) => item.id));
    return records.connections.filter(
      (connection) =>
        ids.has(connection.fromEventId) && ids.has(connection.toEventId),
    );
  }, [records.connections, visibleEvents]);
  const relatedIds = useMemo(
    () =>
      focused
        ? visibleEvents
            .filter((item) => item.pathIds?.includes(focused.id))
            .map((item) => item.id)
        : undefined,
    [visibleEvents, focused],
  );
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
  const selectionOverlays = useMemo(
    () => selectedObservationOverlays(records, selectedEventIds, id),
    [records, selectedEventIds, id],
  );
  const overlays = useMemo(
    () => [...(map.overlays ?? []), ...mapData.overlays, ...selectionOverlays],
    [map.overlays, mapData.overlays, selectionOverlays],
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
  // Reuse the map's collision-aware facility labels instead of stacking a second marker.
  const facilities = useMemo(
    () =>
      state.mode === "deviation" && divergenceLocation
        ? mapData.facilities.map((facility) =>
            facility.id === divergenceLocation.id
              ? {
                  ...facility,
                  label: `${facility.label}\nFirst divergence`,
                  priority: Math.max(facility.priority ?? 0, 10),
                  labelMinZoom: 0,
                }
              : facility,
          )
        : mapData.facilities,
    [mapData.facilities, state.mode, divergenceLocation],
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
  const selectEvent = (item: EventTimelineEvent) => {
    anchorId.current = item.id;
    dispatch({
      type: "select",
      selection: { type: "event", eventId: item.id },
    });
  };
  const activateEvent = (
    eventId: string,
    modifiers?: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => {
    if (eventId === event?.id) setDrawerOpen(true);
    const ids = visibleEvents.map((item) => item.id);
    const anchor = anchorId.current;
    let selected: string[];
    if (modifiers?.shiftKey && anchor && ids.includes(anchor)) {
      const a = ids.indexOf(anchor),
        b = ids.indexOf(eventId);
      selected = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
    } else if (multiSelect || modifiers?.metaKey || modifiers?.ctrlKey) {
      const current = new Set(selectedEventIds);
      if (current.has(eventId)) current.delete(eventId);
      else current.add(eventId);
      selected = ids.filter((id) => current.has(id));
      anchorId.current = eventId;
    } else {
      selected = [eventId];
      anchorId.current = eventId;
    }
    dispatch({
      type: "selectEvents",
      ids: selected,
      selection: selected.length ? { type: "event", eventId } : null,
    });
  };
  const selectLocation = (locationId: string) => {
    if (!multiSelect) {
      dispatch({ type: "select", selection: { type: "location", locationId } });
      return;
    }
    const atLocation = records.events
      .filter((item) => item.locationId === locationId)
      .map((item) => item.id);
    const current = new Set(selectedEventIds);
    const remove = atLocation.every((eventId) => current.has(eventId));
    for (const eventId of atLocation) {
      if (remove) current.delete(eventId);
      else current.add(eventId);
    }
    dispatch({
      type: "selectEvents",
      ids: records.events
        .filter((item) => current.has(item.id))
        .map((item) => item.id),
      selection: { type: "location", locationId },
    });
  };
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
  const analysisContext: InvestigationAnalysisContext = {
    ...context,
    selectedEventIds,
    focusedPathId: focused?.id ?? null,
    comparisonPredictionId: comparedPrediction?.id ?? null,
  };
  const inspectorGraph = renderInspectorGraph?.(analysisContext);
  const selectedIndex = visibleEvents.findIndex(
    (item) => item.id === event?.id,
  );
  useEffect(() => {
    if (narrow && mobileView !== "events") return;
    const panel = root.current?.querySelector<HTMLElement>(
      "[data-workbench-events] > [data-workbench-scroll]",
    );
    const selected = panel?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!panel) return;
    if (!selected) {
      if (drawerOpen && panel.querySelector("[data-workbench-drawer]"))
        panel.scrollTop = 0;
      return;
    }
    const bounds = panel.getBoundingClientRect();
    const row = selected.getBoundingClientRect();
    const entry = drawerOpen
      ? selected.closest("li")?.getBoundingClientRect()
      : undefined;
    if (entry && entry.height > bounds.height - 16) {
      panel.scrollTop += row.top - bounds.top - 8;
    } else if (row.top < bounds.top + 8) {
      panel.scrollTop += row.top - bounds.top - 8;
    } else if ((entry?.bottom ?? row.bottom) > bounds.bottom - 8) {
      panel.scrollTop += (entry?.bottom ?? row.bottom) - bounds.bottom + 8;
    }
  }, [
    event?.id,
    selectionKey,
    drawerOpen,
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
    const locationId = hit.feature.properties?.locationId;
    const predictionId = hit.feature.properties?.predictionId;
    if (
      hit.overlayId === `${id}-selected-points` &&
      typeof locationId === "string"
    )
      selectLocation(locationId);
    else if (
      (hit.overlayId.startsWith(`${id}-history-`) ||
        hit.overlayId.startsWith(`${id}-selected-history-`) ||
        hit.overlayId === `${id}-selected-unassigned`) &&
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
  const closeDrawer = () => {
    const rowButton = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        "[data-workbench-row-toggle]",
      ) ?? [],
    ).find((button) => button.dataset.workbenchRowToggle === event?.id);
    const target =
      narrow && mobileView === "analysis"
        ? root.current?.querySelector<HTMLElement>("[data-workbench-analysis]")
        : (rowButton ??
          root.current?.querySelector<HTMLButtonElement>(
            "[data-workbench-context-toggle]",
          ));
    target?.focus({ preventScroll: true });
    setDrawerOpen(false);
  };
  const inlineEvent =
    event && visibleEvents.find((item) => item.id === event.id);
  const inlineDrawer =
    Boolean(inlineEvent) && !(narrow && mobileView === "analysis");
  const inspector = (
    <section
      className={styles.inspector}
      aria-label="Investigation inspector"
      id={`${id}-drawer`}
      data-workbench-drawer
      onFocusCapture={(e) => {
        focusedDrawerControl.current = e.target as HTMLElement;
      }}
      onBlurCapture={(e) => {
        const target = e.target as HTMLElement;
        if (
          !target.isConnected ||
          target.matches(":disabled") ||
          target.closest("[hidden]")
        )
          return;
        if (
          !(e.relatedTarget instanceof Node) ||
          !e.currentTarget.contains(e.relatedTarget)
        )
          focusedDrawerControl.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.stopPropagation();
          closeDrawer();
        }
      }}
    >
      {!inlineDrawer && (
        <header className={styles.inspectorHeader}>
          {event && (
            <span className={styles.muted}>
              {event.label} · {event.timeLabel ?? "Time unknown"}
            </span>
          )}
          <h3>
            {event?.locationLabel ??
              event?.label ??
              context.path?.label ??
              context.location?.label ??
              context.segment?.label ??
              "Investigation details"}
          </h3>
        </header>
      )}
      <div className={styles.drawerToolbar}>
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
                ? "Details"
                : item === "deviation"
                  ? "Comparison"
                  : "Evidence"}
            </button>
          ))}
        </div>
        <div
          className={styles.eventNavigation}
          role="group"
          aria-label="Event navigation"
        >
          <button
            type="button"
            aria-label="Previous event"
            id={`${tabsId}-previous`}
            disabled={selectedIndex <= 0}
            onClick={() => selectEvent(visibleEvents[selectedIndex - 1])}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next event"
            id={`${tabsId}-next`}
            disabled={
              !visibleEvents.length ||
              selectedIndex === visibleEvents.length - 1
            }
            onClick={() => selectEvent(visibleEvents[selectedIndex + 1])}
          >
            →
          </button>
          <button
            type="button"
            aria-label="Close investigation details"
            onClick={closeDrawer}
          >
            ×
          </button>
        </div>
      </div>
      <div role="status" className={styles.srOnly}>
        {event
          ? `Selected ${event.label}, ${event.locationLabel ?? "location unknown"}, ${event.timeLabel ?? "time unknown"}`
          : "Selection updated"}
      </div>
      <div
        className={styles.inspectorBody}
        role="region"
        aria-label="Inspector content"
        tabIndex={0}
      >
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
              <dl className={styles.facts}>
                {event.receivedTimeLabel &&
                  (!inlineDrawer || event.timeLabel) && (
                    <div>
                      <dt>Received</dt>
                      <dd>{event.receivedTimeLabel}</dd>
                    </div>
                  )}
                <div>
                  <dt>Event ID</dt>
                  <dd>{event.id}</dd>
                </div>
              </dl>
              {event.description && <p>{event.description}</p>}
              {selectedEventIds.length > 1 && (
                <p className={styles.notice}>
                  {selectedEventIds.length} observations selected. Map links are
                  highlighted only for explicit supplied connections.
                </p>
              )}
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
                  <p className={styles.muted}>
                    {context.connections?.length ?? 0} explicit event
                    relationships reference this connection.
                  </p>
                </>
              )}
              {!state.selection && (
                <p className={styles.muted}>
                  Select an event, location, or history. Selecting a location
                  does not choose an arbitrary visit.
                </p>
              )}
            </>
          )}
          {state.selection && context.isAvailable && (
            <>
              {selectedAssessments.map((assessment) => (
                <div key={assessment.id} className={styles.assessment}>
                  {(!inlineDrawer ||
                    !state.showRisks ||
                    assessment.target.type === "path") && (
                    <Pill size="xs" tone={assessment.tone}>
                      {assessment.label}
                    </Pill>
                  )}
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
              {comparedPrediction ? (
                <>
                  <p className={styles.comparisonContext}>
                    <Swatch
                      color={comparedPrediction.color}
                      dash={comparedPrediction.dash ?? [6, 3]}
                    />
                    <strong>Comparing with {comparedPrediction.label}</strong>
                    {!visiblePredictions.some(
                      (prediction) => prediction.id === comparedPrediction.id,
                    ) && <span className={styles.muted}>Hidden on map</span>}
                  </p>
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
                    </>
                  ) : (
                    <p className={styles.muted}>
                      No deviation assessment supplied for the selected
                      observation. Line separation alone is not a measured
                      deviation.
                    </p>
                  )}
                  {divergenceEvent?.id === event?.id && inlineDrawer ? (
                    <p className={styles.muted}>
                      First divergence in this comparison.
                    </p>
                  ) : (
                    divergenceEvent && (
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
                    )
                  )}
                  {firstIds.length > 1 && (
                    <p className={styles.notice}>
                      Supplied assessments disagree on the first divergence. No
                      single map callout is shown.
                    </p>
                  )}
                  <details className={styles.analysisDisclosure}>
                    <summary>Comparison evidence and sources</summary>
                    <div>
                      {selectedDeviation &&
                        renderDeviationEvidence?.(selectedDeviation, context)}
                      <p className={styles.provenance}>
                        Forecast: {comparedPrediction.source} · issued{" "}
                        {comparedPrediction.asOf}
                      </p>
                      {selectedDeviation && (
                        <p className={styles.provenance}>
                          Assessment: {selectedDeviation.source} ·{" "}
                          {selectedDeviation.asOf}
                        </p>
                      )}
                    </div>
                  </details>
                </>
              ) : (
                <p className={styles.muted}>
                  Choose a forecast above the analysis tabs to compare its
                  findings.
                </p>
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
          {records.connections.some((connection) => connection.segmentId) && (
            <details className={styles.relationshipPicker}>
              <summary>Mapped connections</summary>
              <div className={styles.relationshipPickerItems}>
                {records.connections
                  .filter((connection) => connection.segmentId)
                  .map((connection) => (
                    <button
                      className={styles.relationshipPickerButton}
                      key={connection.id}
                      type="button"
                      aria-label={`Inspect connection ${connection.label ?? connection.id}`}
                      onClick={() =>
                        dispatch({
                          type: "select",
                          selection: {
                            type: "segment",
                            segmentId: connection.segmentId!,
                          },
                        })
                      }
                    >
                      {connection.label ?? connection.id}
                    </button>
                  ))}
              </div>
            </details>
          )}
        </div>
      </div>
      {inspectorGraph != null && (
        <details className={styles.inspectorGraph}>
          <summary>Additional analysis</summary>
          <div role="region" aria-label="Supplemental investigation graph">
            {inspectorGraph}
          </div>
        </details>
      )}
    </section>
  );
  const rowDetails = (item: EventTimelineEvent) =>
    item.id === inlineEvent?.id &&
    drawerOpen &&
    !(narrow && mobileView === "analysis")
      ? inspector
      : null;
  const eventTrailing = (item: EventTimelineEvent) => (
    <span className={styles.rowActions}>
      {showEventRisks(item)}
      <button
        type="button"
        className={styles.rowToggle}
        data-workbench-row-toggle={item.id}
        aria-label={`${drawerOpen && event?.id === item.id ? "Collapse" : "Expand"} observation details`}
        aria-description={`${item.label}, ${item.locationLabel ?? "Location unknown"}, ${item.timeLabel ?? "Time unknown"}`}
        aria-expanded={drawerOpen && event?.id === item.id}
        aria-controls={
          drawerOpen && event?.id === item.id ? `${id}-drawer` : undefined
        }
        onClick={() => {
          if (event?.id === item.id) {
            setDrawerOpen((open) => !open);
          } else {
            dispatch({
              type: "selectEvents",
              ids: selectedEventIds.includes(item.id)
                ? selectedEventIds
                : multiSelect
                  ? records.events
                      .filter(
                        (candidate) =>
                          candidate.id === item.id ||
                          selectedEventIds.includes(candidate.id),
                      )
                      .map((candidate) => candidate.id)
                  : [item.id],
              selection: { type: "event", eventId: item.id },
            });
          }
        }}
      >
        <span aria-hidden="true">
          {drawerOpen && event?.id === item.id ? "▾" : "▸"}
        </span>
      </button>
    </span>
  );
  const fillMap =
    analysisExpanded || map.height === undefined || map.height === "fill";
  if (duplicateAnalysisIds.length)
    return (
      <section ref={root} className={styles.root} aria-label={title}>
        <div role="alert" className={styles.modelError}>
          <h2>Analysis views need distinct IDs</h2>
          <p>
            The Map view reserves <code>map</code>; each supplied analysis view
            needs a unique ID.
          </p>
        </div>
      </section>
    );
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
      data-analysis-expanded={analysisExpanded || undefined}
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
        <div className={styles.headerMeta}>
          <span className={styles.headerCounts}>
            {records.events.length} observations · {records.paths.length}{" "}
            histories
          </span>
          {actions}
        </div>
      </header>
      <div className={styles.body}>
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
              data-workbench-view="analysis"
              aria-controls={`${id}-analysis`}
              aria-pressed={mobileView === "analysis"}
              onClick={() => setMobileView("analysis")}
            >
              Analysis
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
              <h3>All reported observations</h3>
              <span className={styles.panelMeta}>
                {visibleEvents.length} of {records.events.length} observations
                {focused && showHistoryLabels
                  ? ` · ${focused.label} emphasized`
                  : ""}
              </span>
            </div>
          </header>
          <div className={styles.timelineControls} data-workbench-controls>
            <div
              className={styles.historyList}
              role="group"
              aria-label="Candidate histories"
            >
              <button
                type="button"
                className={styles.historyButton}
                aria-pressed={!focused}
                aria-label="All histories"
                onClick={() => dispatch({ type: "mode", mode: "overview" })}
              >
                All
              </button>
              {records.paths.map((path) => {
                const short =
                  path.label.match(/\b[A-Z]\b/)?.[0] ?? path.id.slice(0, 3);
                return (
                  <button
                    key={path.id}
                    type="button"
                    className={styles.historyButton}
                    aria-label={`${path.label} · ${records.events.filter((item) => item.pathIds?.includes(path.id)).length} observations · select history`}
                    title={path.label}
                    aria-pressed={focused?.id === path.id}
                    onClick={() => dispatch({ type: "focus", pathId: path.id })}
                  >
                    <Swatch color={path.color!} />
                    <strong>{showHistoryLabels ? path.label : short}</strong>
                  </button>
                );
              })}
            </div>
            <div className={styles.timelineActions}>
              <button
                type="button"
                className={styles.smallControl}
                aria-pressed={multiSelect}
                aria-describedby={selectionHelpId}
                onClick={() => setMultiSelect((value) => !value)}
              >
                {multiSelect ? "Done" : "Multi-select"}
              </button>
              <span className={styles.selectionCount} role="status">
                {selectedEventIds.length} selected
              </span>
              {selectedEventIds.length > 0 && (
                <button
                  type="button"
                  className={styles.smallControl}
                  aria-label={`Clear ${selectedEventIds.length} selected observations`}
                  onClick={() => {
                    anchorId.current = null;
                    dispatch({
                      type: "selectEvents",
                      ids: [],
                      selection: null,
                    });
                  }}
                >
                  Clear
                </button>
              )}
              <details className={styles.displayMenu}>
                <summary>Display</summary>
                <div className={styles.displayOptions}>
                  <Checkbox
                    isSelected={state.showDisconnected}
                    onChange={(show) =>
                      dispatch({ type: "disconnected", show })
                    }
                  >
                    Unassigned ({disconnected.length})
                  </Checkbox>
                  <Checkbox
                    isSelected={state.showRisks}
                    onChange={(show) => dispatch({ type: "risks", show })}
                  >
                    Risk indicators ({assessments.length})
                  </Checkbox>
                </div>
              </details>
            </div>
          </div>
          <div className={styles.columnLabels} aria-hidden="true">
            <span>Time</span>
            <span>Event</span>
            <span>Incoming evidence</span>
          </div>
          <div className={styles.timelineScroll} data-workbench-scroll>
            {!inlineEvent && !(narrow && mobileView === "analysis") && (
              <div className={styles.contextDrawer}>
                <button
                  type="button"
                  className={styles.contextToggle}
                  data-workbench-context-toggle
                  aria-expanded={drawerOpen}
                  aria-controls={drawerOpen ? `${id}-drawer` : undefined}
                  onClick={() => setDrawerOpen((open) => !open)}
                >
                  {drawerOpen ? "Hide" : "Show"}{" "}
                  {state.selection?.type === "path"
                    ? "history"
                    : state.selection?.type === "event"
                      ? "observation"
                      : state.selection?.type === "location"
                        ? "location"
                        : state.selection?.type === "segment"
                          ? "connection"
                          : "investigation"}{" "}
                  details
                </button>
                {drawerOpen && inspector}
              </div>
            )}
            <EventTimeline
              events={visibleEvents}
              connections={visibleConnections}
              pathColors={palette}
              variant="ledger"
              size="compact"
              ledgerColumns
              metricsPlacement="inline"
              selectedId={event?.id ?? null}
              selectedIds={selectedEventIds}
              multiSelectable={multiSelect}
              selectedConnectionIds={selectedConnectionIds}
              relatedIds={relatedIds}
              onSelectedIdChange={activateEvent}
              renderTrailing={eventTrailing}
              renderDetails={rowDetails}
              renderConnectionMetrics={connectionEvidence}
            />
          </div>
          <footer className={styles.timelineFootnote}>
            <details className={styles.selectionHelp}>
              <summary>Selection help</summary>
              <p id={selectionHelpId}>
                Click an observation to select it. Shift-click selects a range;
                Ctrl/Cmd-click adds or removes observations. Multi-select
                enables additive selection for observations and map locations.
                Done keeps the selection and returns to single selection.
              </p>
            </details>
            <span>
              Connections show reported relationships, not proof of travel.
            </span>
          </footer>
        </section>
        <section
          className={styles.analysisPanel}
          ref={analysisRoot}
          data-workbench-analysis
          data-expanded={analysisExpanded || undefined}
          id={`${id}-analysis`}
          tabIndex={-1}
          aria-label="Investigation analysis"
          hidden={narrow && mobileView !== "analysis" && !analysisExpanded}
          onFocusCapture={(e) => {
            const element = e.target as HTMLElement;
            const panel = element.closest<HTMLElement>("[data-analysis-view]");
            focusedAnalysisContent.current = panel
              ? { id: panel.dataset.analysisView!, element }
              : null;
          }}
          onBlurCapture={(e) => {
            const element = e.target as HTMLElement;
            const panel = element.closest<HTMLElement>("[data-analysis-view]");
            if (panel?.hidden || !element.isConnected) return;
            if (
              !(e.relatedTarget instanceof Node) ||
              !analysisRoot.current?.contains(e.relatedTarget)
            )
              focusedAnalysisContent.current = null;
          }}
        >
          {focused && (
            <section
              aria-label="Forecast comparison"
              className={styles.comparisonControls}
            >
              <h3>Compare forecast</h3>
              {!availablePredictions.length ? (
                <p className={styles.muted}>
                  No forecasts supplied for {focused.label}.
                </p>
              ) : (
                <div className={styles.comparisonOptions}>
                  {availablePredictions.map((prediction) => {
                    const comparing = comparedPrediction?.id === prediction.id;
                    return (
                      <button
                        key={prediction.id}
                        type="button"
                        className={styles.smallControl}
                        aria-pressed={comparing}
                        onClick={() =>
                          dispatch({ type: "compare", id: prediction.id })
                        }
                      >
                        <Swatch
                          color={prediction.color}
                          dash={prediction.dash ?? [6, 3]}
                        />
                        <span>
                          {comparing ? "Comparing" : "Compare"}{" "}
                          {prediction.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          <WorkspaceTabs
            aria-label="Analysis views"
            ids={analysisIds}
            pinnedTabs={analysisTabs}
            selectedKey={analysisId}
            onSelectionChange={chooseAnalysis}
            trailing={
              <button
                ref={expandButton}
                type="button"
                className={styles.smallControl}
                aria-expanded={analysisExpanded}
                aria-label={
                  analysisExpanded
                    ? "Restore analysis to workspace"
                    : "Expand analysis to full screen"
                }
                onClick={() => {
                  if (analysisExpanded) {
                    if (document.fullscreenElement === expandedPanel.current)
                      void document.exitFullscreen?.();
                    setAnalysisExpanded(false);
                  } else {
                    if (narrow) setMobileView("analysis");
                    setAnalysisExpanded(true);
                    // Expand the same analysis window, retaining the active tab and mounted views.
                    // CSS expansion remains the fallback when native fullscreen is unavailable.
                    void expandedPanel.current
                      ?.requestFullscreen?.()
                      .catch(() => {});
                  }
                }}
              >
                {analysisExpanded ? "Restore" : "Expand"}
              </button>
            }
          />
          <div className={styles.analysisPanels}>
            <section
              role="tabpanel"
              id={analysisIds.panelId("map")}
              aria-labelledby={analysisIds.tabId("map")}
              hidden={analysisId !== "map"}
              tabIndex={0}
              className={styles.mapViewPanel}
              data-analysis-view="map"
            >
              <section
                className={styles.mapPanel}
                data-workbench-map
                style={
                  {
                    alignSelf: fillMap ? "stretch" : "start",
                    blockSize: fillMap ? undefined : "auto",
                    "--workbench-map-flex": fillMap ? "1 1 auto" : "0 0 auto",
                  } as React.CSSProperties
                }
                id={`${id}-map`}
                tabIndex={-1}
                aria-label="History map"
              >
                <NetworkMap
                  {...map}
                  facilities={facilities}
                  segments={mapData.segments}
                  selectedFacilityId={context.location?.id}
                  selectedSegmentId={context.segment?.id}
                  onFacilitySelect={selectLocation}
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
                  height={analysisExpanded ? "fill" : (map.height ?? "fill")}
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
                    const owned = hover.selections.filter((hit) =>
                      hit.overlayId.startsWith(`${id}-`),
                    );
                    const externalContent = external.overlays.length
                      ? map.renderOverlayHoverDetails
                        ? map.renderOverlayHoverDetails(external)
                        : hover.pinned && external.selections[0]
                          ? map.renderOverlayDetails?.(external.selections[0])
                          : null
                      : null;
                    if (
                      !owned.length &&
                      (externalContent == null || externalContent === false)
                    )
                      return null;
                    return (
                      <div className={styles.overlayDetails}>
                        {owned.map((hit) => (
                          <div key={`${hit.overlayId}-${hit.feature.id}`}>
                            <strong>
                              {String(
                                hit.feature.properties?.label ??
                                  "Candidate connection",
                              )}
                            </strong>
                            {hit.overlayId === `${id}-selected-points` ? (
                              <span>Selected observation location</span>
                            ) : hit.feature.properties?.predictionId ? (
                              <span>
                                Forecast ·{" "}
                                {String(hit.feature.properties.source)} ·{" "}
                                {String(hit.feature.properties.asOf)}
                              </span>
                            ) : (
                              <span>Supplied candidate relationship</span>
                            )}
                          </div>
                        ))}
                        {externalContent}
                      </div>
                    );
                  }}
                />
                {focused && (
                  <section
                    aria-label="Forecast visibility"
                    className={styles.forecastControls}
                  >
                    <h3>Show on map</h3>
                    {!availablePredictions.length ? (
                      <p className={styles.muted}>
                        No forecasts supplied for {focused.label}.
                      </p>
                    ) : (
                      availablePredictions.map((prediction) => (
                        <div
                          className={styles.forecastOption}
                          key={prediction.id}
                          data-prediction-id={prediction.id}
                        >
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
                            <span className={styles.forecastLabel}>
                              <Swatch
                                color={prediction.color}
                                dash={prediction.dash ?? [6, 3]}
                              />
                              {prediction.label}
                            </span>
                          </Checkbox>
                          {prediction.confidence && (
                            <span
                              className={styles.forecastConfidence}
                              title={prediction.confidence.description}
                            >
                              {prediction.confidence.valueLabel}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </section>
                )}
              </section>
            </section>
            {analysisViews.map((view) => (
              <section
                key={view.id}
                role="tabpanel"
                id={analysisIds.panelId(view.id)}
                aria-labelledby={analysisIds.tabId(view.id)}
                hidden={view.id !== analysisId}
                tabIndex={0}
                className={styles.analysisViewPanel}
                data-analysis-view={view.id}
              >
                {view.render(analysisContext)}
              </section>
            ))}
          </div>
        </section>
        {narrow && mobileView === "analysis" && (
          <div className={styles.mobileInspector}>
            <button
              type="button"
              className={styles.contextToggle}
              aria-expanded={drawerOpen}
              aria-controls={drawerOpen ? `${id}-drawer` : undefined}
              onClick={() => setDrawerOpen((open) => !open)}
            >
              {drawerOpen ? "Hide" : "Show"} investigation details
            </button>
            {drawerOpen && inspector}
          </div>
        )}
      </div>
    </section>
  );
}
