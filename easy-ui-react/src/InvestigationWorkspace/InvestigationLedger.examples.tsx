import React, { useEffect, useMemo, useRef, useState } from "react";
import tokens from "@easypost/easy-ui-tokens/js/tokens";
import type { FeatureCollection } from "geojson";
import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { InvestigationWorkspace } from "./InvestigationWorkspace";
import {
  type InvestigationDetailsContext,
  type InvestigationSelection,
} from "./selection";
import { useColorScheme } from "../Theme";
import { Pill } from "../Pill";
import { Text } from "../Text";
import { ledgerRecords, eventFindings } from "./InvestigationLedger.fixtures";
import {
  LedgerRowEvidence,
  LedgerSelectedEvidence,
  hasLedgerEvidence,
} from "./InvestigationLedgerEvidence.examples";
import geography from "./InvestigationLedger.geography.json";
import styles from "./InvestigationWorkspace.stories.module.scss";
import {
  PredictionComparison,
  ledgerPredictions,
  predictionOverlays,
} from "./InvestigationPredictions.examples";

// Published US Census geometry from https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json.
// Converted with topojson-client 3.1.0, continental states only, rounded to 0.001 degrees.
// City centers are Census BAS25 representative coordinates; observations are entirely synthetic.
function mapStyle(scheme: "light" | "dark"): StyleSpecification {
  const color = (name: "000" | "100" | "300") =>
    tokens[`theme.${scheme}.color.neutral.${name}`];
  return {
    version: 8,
    sources: {
      states: {
        type: "geojson",
        data: geography as FeatureCollection,
        attribution:
          'US Census · <a href="https://github.com/topojson/us-atlas">us-atlas</a>',
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": color("000") },
      },
      {
        id: "land",
        type: "fill",
        source: "states",
        paint: { "fill-color": color("100") },
      },
      {
        id: "state-borders",
        type: "line",
        source: "states",
        paint: { "line-color": color("300"), "line-width": 0.6 },
      },
    ],
  };
}
const lightStyle = mapStyle("light");
const darkStyle = mapStyle("dark");
const pathPalettes = {
  light: { a: "#2563eb", b: "#7c3aed", c: "#087f8c" },
  dark: { a: "#83a8ff", b: "#c4a1ff", c: "#5fd3c6" },
} as const;

function updateBasemapColors(map: MapInstance, scheme: "light" | "dark") {
  for (const [layer, property, token] of [
    ["background", "background-color", "000"],
    ["land", "fill-color", "100"],
    ["state-borders", "line-color", "300"],
  ] as const) {
    map.setPaintProperty(
      layer,
      property,
      tokens[`theme.${scheme}.color.neutral.${token}`],
    );
  }
}

function LedgerDetails({
  event,
  path,
  paths,
  connections = [],
  selection,
}: InvestigationDetailsContext) {
  const finding = event && eventFindings[event.id];
  return (
    <div className={styles.ledgerDetails}>
      {event && (
        <section aria-label="Event assessment" className={styles.assessment}>
          <div className={styles.assessmentHeading}>
            <Text as="span" variant="subtitle2">
              Event assessment
            </Text>
            <Pill
              size="xs"
              tone={
                finding?.level === "high"
                  ? "danger"
                  : finding
                    ? "warning"
                    : "neutral"
              }
            >
              {finding?.label ?? "Unassessed"}
            </Pill>
          </div>
          <Text as="p" variant="body2" color="subdued">
            {finding?.detail ??
              "No assessment was supplied for this observation."}
          </Text>
          {finding && (
            <Text as="p" variant="caption" color="subdued">
              Assessed {finding.assessedAt}
            </Text>
          )}
        </section>
      )}
      {path && !event && (
        <section
          aria-label="Candidate history assessment"
          className={styles.assessment}
        >
          <div className={styles.assessmentHeading}>
            <Text as="span" variant="subtitle2">
              Candidate history assessment
            </Text>
            <Pill size="xs" tone="neutral">
              Unassessed
            </Pill>
          </div>
          <Text as="p" variant="body2" color="subdued">
            No assessment was supplied for this candidate history. Its
            connections do not establish a confirmed journey.
          </Text>
        </section>
      )}
      {selection?.type === "path" && !event && (
        <Text as="p" variant="body2">
          Use the event list or next-event control to inspect the observations
          assigned to this candidate.
        </Text>
      )}
      {event && (
        <>
          <LedgerSelectedEvidence event={event} />
          <Text as="p" variant="caption" color="subdued">
            {paths.length
              ? `Candidate membership: ${paths.map((path) => path.label).join(", ")}.`
              : "No candidate history assigned."}
          </Text>
        </>
      )}
      {connections.length > 0 && (
        <details className={styles.relationshipDisclosure}>
          <summary>
            {connections.length} supplied candidate relationship
            {connections.length === 1 ? "" : "s"}
          </summary>
          <ul>
            {connections.map((connection) => (
              <li key={connection.id}>
                {connection.label ??
                  `${connection.fromEventId} → ${connection.toEventId}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function InvestigationLedgerExample({
  narrow = false,
  singleHistory = false,
  unassigned = false,
  withPredictions = false,
}: {
  narrow?: boolean;
  singleHistory?: boolean;
  unassigned?: boolean;
  /** Demo preset: start focused on A with both forecasts visible. Other examples offer them on focus, initially off. */
  withPredictions?: boolean;
}) {
  const { resolvedColorScheme } = useColorScheme();
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    if (
      resolvedColorScheme !== "system" &&
      resolvedColorScheme !== "inverted"
    ) {
      return;
    }
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media?.matches ?? false);
    update();
    media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, [resolvedColorScheme]);
  // ThemeProvider resolves nesting but leaves system preference to CSS.
  const colorScheme =
    resolvedColorScheme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : resolvedColorScheme === "inverted"
        ? systemDark
          ? "light"
          : "dark"
        : resolvedColorScheme;
  // Replacing mapStyle recreates the engine. Paint updates retain its camera,
  // loaded overlays, and interaction state across all theme changes.
  const initialStyle = useRef(colorScheme === "dark" ? darkStyle : lightStyle);
  const mapInstance = useRef<MapInstance | null>(null);
  useEffect(() => {
    if (mapInstance.current) {
      updateBasemapColors(mapInstance.current, colorScheme);
    }
  }, [colorScheme]);
  const [selection, setSelection] = useState<InvestigationSelection>(
    withPredictions
      ? { type: "path", pathId: "a", eventId: "revisit" }
      : {
          type: "event",
          eventId: unassigned
            ? "unassigned-delivery"
            : singleHistory
              ? "a-transit"
              : "revisit",
        },
  );
  const [enabledPredictions, setEnabledPredictions] = useState<string[]>(() =>
    withPredictions ? ledgerPredictions.map((prediction) => prediction.id) : [],
  );
  const pathColors = pathPalettes[colorScheme];
  const focusedPathId =
    selection?.type === "path" ? selection.pathId : undefined;
  const forecasts = useMemo(
    () => predictionOverlays(focusedPathId, pathColors.a, enabledPredictions),
    [focusedPathId, pathColors.a, enabledPredictions],
  );
  const records = singleHistory
    ? {
        ...ledgerRecords,
        events: ledgerRecords.events.filter(
          (event) => "pathIds" in event && event.pathIds?.includes("a"),
        ),
        paths: ledgerRecords.paths.filter((path) => path.id === "a"),
        connections: ledgerRecords.connections.filter((connection) =>
          connection.pathIds.includes("a"),
        ),
        segments: ledgerRecords.segments.filter((segment) =>
          ledgerRecords.paths[0].segmentIds.includes(segment.id),
        ),
        locations: ledgerRecords.locations.filter((location) =>
          ["ludington", "hammond", "avondale", "wellton", "el-cajon"].includes(
            location.id,
          ),
        ),
      }
    : ledgerRecords;
  const coloredPaths = useMemo(
    () =>
      records.paths.map((path) => ({
        ...path,
        color: pathColors[path.id as keyof typeof pathColors],
      })),
    [records.paths, pathColors],
  );
  return (
    <div
      className={styles.ledgerExample}
      style={{ maxWidth: narrow ? 390 : 960 }}
    >
      <InvestigationWorkspace
        {...records}
        paths={coloredPaths}
        variant="ledger"
        header={
          <header className={styles.ledgerHeader}>
            <div className={styles.ledgerTitle}>
              <Text as="h2" variant="subtitle1">
                Parcel history
              </Text>
              <div
                className={styles.investigationAssessment}
                aria-label="Investigation assessment"
              >
                <Text as="span" variant="caption" color="subdued">
                  Parcel risk
                </Text>
                <Pill size="xs" tone="warning">
                  Elevated
                </Pill>
              </div>
            </div>
            <Text as="p" variant="caption" color="subdued">
              Illustrative · {singleHistory ? "Oct 22–24" : "Oct 22–27"}, 2026 ·{" "}
              {records.events.length} observations ·{" "}
              {singleHistory
                ? "1 origin · 1 delivery"
                : "2 origins · 3 deliveries"}{" "}
              · UTC
            </Text>
          </header>
        }
        selection={selection}
        onSelectionChange={setSelection}
        labels={{
          timeline: "Event history",
          paths: "Histories",
          allPaths: "All",
          map: "Reported locations",
        }}
        map={{
          title: "Reported locations",
          description: "City centers",
          showViewScale: false,
          typography: { title: 12, description: 11, control: 12, label: 12 },
          controlLabels: { fitAll: "Fit" },
          mapStyle: initialStyle.current,
          workerUrl,
          overlays: forecasts,
          renderOverlayDetails: ({ feature }) => (
            <div className={styles.ledgerDetails}>
              <strong>{feature.properties?.label}</strong>
              <span>Illustrative forecast · Oct 22, 04:04 UTC</span>
              <span>
                Prediction for History A; not a recorded scan or measured route.
              </span>
            </div>
          ),
          controls: {
            fitAll: true,
            latestEvent: false,
            selectedSegment: false,
            risk: false,
            weather: false,
            deliverySurface: false,
            navigation: true,
            scale: true,
          },
          onMapReady: (map) => {
            mapInstance.current = map;
            map.once("remove", () => {
              if (mapInstance.current === map) mapInstance.current = null;
            });
            updateBasemapColors(map, colorScheme);
            (window as unknown as { ledgerMap: typeof map }).ledgerMap = map;
          },
        }}
        timeline={{
          metricsPlacement: "inline",
          renderMetrics: (event) =>
            hasLedgerEvidence(event.id) ? (
              <LedgerRowEvidence event={event} />
            ) : null,
          renderTrailing: (event) => {
            const finding = eventFindings[event.id];
            if (!finding) return null;
            return (
              <span aria-label={`Event assessment: ${finding.label}`}>
                <Pill
                  size="xs"
                  tone={finding.level === "high" ? "danger" : "warning"}
                >
                  {finding.label}
                </Pill>
              </span>
            );
          },
        }}
        renderDetails={LedgerDetails}
        renderPathComparison={({ path }) =>
          path?.id === "a" ? (
            <PredictionComparison
              color={pathColors.a}
              enabled={enabledPredictions}
              onChange={setEnabledPredictions}
            />
          ) : null
        }
      />
      <Text as="p" variant="caption" color="subdued">
        Rows follow reported time. Lines connect supplied candidate
        observations; separate roots and delivery claims remain distinct.
      </Text>
    </div>
  );
}
