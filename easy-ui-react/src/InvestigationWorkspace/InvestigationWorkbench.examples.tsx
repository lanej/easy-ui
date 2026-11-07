import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import tokens from "@easypost/easy-ui-tokens/js/tokens";
import type { FeatureCollection } from "geojson";
import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { InvestigationWorkbench } from "./InvestigationWorkbench";
import type {
  InvestigationGraph,
  InvestigationPrediction,
  InvestigationDeviation,
  InvestigationAssessment,
} from "./workbenchModel";
import type { InvestigationMode } from "./workbenchState";
import type { InvestigationSelection } from "./selection";
import { ledgerRecords } from "./InvestigationLedger.fixtures";
import { ledgerPredictions } from "./InvestigationPredictions.examples";
import {
  DurationDistribution,
  type DurationHistogramBin,
} from "../DurationDistribution";
import { useColorScheme } from "../Theme";
import { Button } from "../Button";
import { Pill } from "../Pill";
import geography from "./InvestigationLedger.geography.json";
import styles from "./InvestigationWorkbench.examples.module.scss";

export const workbenchGraph: InvestigationGraph = {
  events: ledgerRecords.events.map(
    ({ pathIds: _membership, ...event }) => event,
  ),
  connections: ledgerRecords.connections.map(
    ({ pathIds: _membership, ...connection }) => connection,
  ),
  locations: ledgerRecords.locations,
  segments: ledgerRecords.segments,
  paths: ledgerRecords.paths.map((path, index) => ({
    id: path.id,
    label: `${path.label} · ${["Primary history", "Alternative", "Independent origin"][index]}`,
    description: path.description,
    kind: "candidate",
    color: ["#2563eb", "#7c3aed", "#087f8c"][index],
    connectionIds: ledgerRecords.connections
      .filter((connection) => connection.pathIds.includes(path.id))
      .map((connection) => connection.id),
  })),
};
/** Explicit evidence can connect observations without assigning them to a history. */
export const workbenchUnassignedGraph: InvestigationGraph = {
  ...workbenchGraph,
  events: workbenchGraph.events.flatMap((event) =>
    event.id === "unassigned-delivery"
      ? [
          {
            id: "unassigned-origin",
            label: "Accepted",
            locationId: "santa-rosa",
            locationLabel: "Santa Rosa, NM",
            timeLabel: "Oct 27 · 10:42 UTC",
            detailLabel: "Unassigned origin",
          },
          {
            ...event,
            description:
              "An explicit incoming relationship was supplied, without candidate history membership or a traveled-route claim.",
          },
        ]
      : [event],
  ),
  connections: [
    ...workbenchGraph.connections,
    {
      id: "unassigned-report-link",
      fromEventId: "unassigned-origin",
      toEventId: "unassigned-delivery",
      label: "Unassigned acceptance → delivery report",
    },
  ],
};
export const workbenchPredictions: readonly InvestigationPrediction[] =
  ledgerPredictions.map((prediction, index) => ({
    id: prediction.id,
    pathId: "a",
    label: prediction.label,
    color: index ? "#a02c91" : "#ad6200",
    source: "Illustrative forecast model",
    asOf: "Oct 22, 2026 · 04:04 UTC",
    lines: [prediction.coordinates.map(([lon, lat]) => [lon, lat] as const)],
    dash: prediction.dash,
  }));
export const workbenchDeviations: readonly InvestigationDeviation[] = [
  {
    id: "return-vs-south",
    predictionId: "forecast-a-south",
    eventId: "revisit",
    firstDivergenceEventId: "revisit",
    summary:
      "The supplied comparison flags a return to Avondale instead of progression toward El Cajon.",
    facts: [
      { label: "Observed interval", value: "7 h 05 m" },
      { label: "Forecast median", value: "4 h" },
      { label: "Difference", value: "+3 h 05 m" },
      {
        label: "Location comparison",
        value: "Return visit; no traveled distance inferred",
      },
    ],
    source: "Synthetic comparison fixture",
    asOf: "Oct 24, 2026 · 12:10 UTC",
  },
  {
    id: "return-vs-central",
    predictionId: "forecast-a-central",
    eventId: "revisit",
    firstDivergenceEventId: "a-transit",
    summary:
      "The supplied comparison first identifies a different corridor at the earlier Avondale observation.",
    facts: [
      { label: "Observed location", value: "Avondale, AZ" },
      { label: "Expected corridor", value: "Kansas City → Denver → Las Vegas" },
      { label: "Time difference", value: "Not supplied" },
    ],
    source: "Synthetic comparison fixture",
    asOf: "Oct 24, 2026 · 12:10 UTC",
  },
];
export const workbenchAssessments: readonly InvestigationAssessment[] = [
  {
    id: "return-finding",
    target: { type: "event", eventId: "revisit" },
    label: "Moderate",
    tone: "warning",
    summary:
      "The supplied assessment flags this repeated facility visit. The earlier observation remains a distinct event.",
    source: "Illustrative review policy",
    asOf: "Oct 24 · 12:10 UTC",
  },
  {
    id: "unassigned-finding",
    target: { type: "event", eventId: "unassigned-delivery" },
    label: "High risk",
    tone: "danger",
    summary:
      "This delivery report has no supplied candidate membership. The finding is caller-provided, not inferred by the UI.",
    source: "Illustrative review policy",
    asOf: "Oct 27 · 14:05 UTC",
  },
];

type Reference = {
  value: number;
  valueLabel: string;
  pair: string;
  domain: readonly [number, number];
  bins: readonly DurationHistogramBin[];
};
const bins = (counts: number[], width: number) =>
  counts.map((count, index) => ({
    from: index * width,
    to: (index + 1) * width,
    count,
  }));
const references: Record<string, Reference | undefined> = {
  "unassigned-report-link": {
    value: 3,
    valueLabel: "3 h",
    pair: "Santa Rosa reports",
    domain: [0, 24],
    bins: bins([8, 24, 30, 18, 10, 5, 3, 2], 3),
  },
  "a-transfer-link": {
    value: 1916 / 60,
    valueLabel: "31 h 56 m",
    pair: "Hammond → Avondale",
    domain: [0, 48],
    bins: bins([4, 9, 18, 30, 42, 45, 40, 29, 17, 10, 6, 2], 4),
  },
  "a-return-link": {
    value: 425 / 60,
    valueLabel: "7 h 05 m",
    pair: "Wellton → Avondale",
    domain: [0, 24],
    bins: bins([6, 18, 32, 44, 36, 24, 16, 10, 6, 4, 2, 2], 2),
  },
};
function ReferenceChart({
  reference,
  compact = false,
}: {
  reference: Reference;
  compact?: boolean;
}) {
  return (
    <div className={compact ? styles.compactReference : styles.reference}>
      {compact && (
        <div className={styles.metricLabel}>
          <span>Scan interval</span>
          <strong>{reference.valueLabel}</strong>
        </div>
      )}
      <DurationDistribution
        value={reference.value}
        unit="h"
        domain={reference.domain}
        bins={reference.bins}
        label={`${reference.pair} interval reference`}
        sampleCount={reference.bins.reduce(
          (count, bin) => count + bin.count,
          0,
        )}
        visualization="histogram"
        distributionStyle="binned"
        showScale={!compact}
        showCountAxis={!compact}
        showDataTable={!compact}
        showHealthBands={false}
        showPercentiles={false}
        stretch={!compact}
        formatValue={(value) =>
          Number.isInteger(value) ? String(value) : value.toFixed(2)
        }
        labels={{
          elapsed: "Observed scan interval",
          count: "Intervals",
          observations: "reported intervals",
        }}
      />
      {!compact && (
        <p>
          {reference.pair} · synthetic 49-day reference, Sep 3–Oct 21, 2026.
          Elapsed time between scans, not facility dwell.
        </p>
      )}
    </div>
  );
}
function mapStyle(scheme: "light" | "dark"): StyleSpecification {
  const color = (step: "000" | "100" | "300") =>
    tokens[`theme.${scheme}.color.neutral.${step}`];
  return {
    version: 8,
    sources: {
      states: {
        type: "geojson",
        data: geography as FeatureCollection,
        attribution: "US Census · us-atlas",
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
        id: "borders",
        type: "line",
        source: "states",
        paint: { "line-color": color("300"), "line-width": 0.7 },
      },
    ],
  };
}
const light = mapStyle("light"),
  dark = mapStyle("dark");

export function InvestigationWorkbenchExample({
  mode = "deviation",
  narrow = false,
  assessments = workbenchAssessments,
  initialSelection = { type: "event", eventId: "revisit" },
  withUnassignedEvidence = false,
  hideComparedPrediction = false,
}: {
  mode?: InvestigationMode;
  narrow?: boolean;
  assessments?: readonly InvestigationAssessment[];
  initialSelection?: InvestigationSelection;
  withUnassignedEvidence?: boolean;
  hideComparedPrediction?: boolean;
}) {
  const { resolvedColorScheme } = useColorScheme();
  const [showNotes, setShowNotes] = useState(false);
  const notesId = useId();
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(query?.matches ?? false);
    query?.addEventListener("change", update);
    update();
    return () => query?.removeEventListener("change", update);
  }, []);
  const scheme =
    resolvedColorScheme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : resolvedColorScheme === "inverted"
        ? systemDark
          ? "light"
          : "dark"
        : resolvedColorScheme;
  const initialStyle = useRef(scheme === "dark" ? dark : light);
  const map = useRef<MapInstance | null>(null);
  const updatePaint = useCallback(
    (instance: MapInstance) => {
      for (const [layer, property, token] of [
        ["background", "background-color", "000"],
        ["land", "fill-color", "100"],
        ["borders", "line-color", "300"],
      ] as const)
        instance.setPaintProperty(
          layer,
          property,
          tokens[`theme.${scheme}.color.neutral.${token}`],
        );
    },
    [scheme],
  );
  useEffect(() => {
    if (map.current) updatePaint(map.current);
  }, [updatePaint]);
  const themedGraph = useMemoGraph(scheme, withUnassignedEvidence);
  return (
    <div className={styles.example} style={{ maxWidth: narrow ? 390 : 1100 }}>
      <InvestigationWorkbench
        graph={themedGraph}
        title="Parcel investigation"
        summary={
          <Pill size="xs" tone="neutral">
            Illustrative
          </Pill>
        }
        actions={
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            aria-expanded={showNotes}
            aria-controls={notesId}
            onPress={() => setShowNotes((shown) => !shown)}
          >
            Data notes
          </Button>
        }
        predictions={workbenchPredictions}
        deviations={workbenchDeviations}
        assessments={
          withUnassignedEvidence
            ? [
                ...assessments,
                {
                  id: "unassigned-edge-finding",
                  target: {
                    type: "connection",
                    connectionId: "unassigned-report-link",
                  },
                  label: "Evidence review",
                  tone: "warning",
                  summary:
                    "This supplied finding belongs to the unassigned reports' explicit connection.",
                  source: "Illustrative review policy",
                  asOf: "Oct 27 · 14:05 UTC",
                },
              ]
            : assessments
        }
        defaultState={{
          mode,
          focusedPathId: mode === "overview" ? null : "a",
          selection: initialSelection,
          enabledPredictionIds: workbenchPredictions
            .filter(
              (prediction) =>
                !hideComparedPrediction || prediction.id !== "forecast-a-south",
            )
            .map((prediction) => prediction.id),
          comparisonPredictionId: "forecast-a-south",
        }}
        map={{
          mapStyle: initialStyle.current,
          workerUrl,
          title: "Reported locations",
          description: "City centers · candidate connections",
          onMapReady: (instance) => {
            map.current = instance;
            updatePaint(instance);
            (window as unknown as { workbenchMap: MapInstance }).workbenchMap =
              instance;
          },
        }}
        renderConnectionMetrics={({ connection }) => {
          const reference = references[connection.id];
          return reference ? (
            <ReferenceChart reference={reference} compact />
          ) : null;
        }}
        renderEvidence={({ event, connections }) => {
          const incoming =
            connections?.filter(
              (connection) =>
                connection.toEventId === event?.id && references[connection.id],
            ) ?? [];
          return incoming.length ? (
            <div className={styles.references}>
              {incoming.map((connection) => (
                <ReferenceChart
                  key={connection.id}
                  reference={references[connection.id]!}
                />
              ))}
            </div>
          ) : null;
        }}
        renderInspectorGraph={({ event }) => {
          const incoming = workbenchGraph.connections.find(
            (connection) =>
              connection.toEventId === event?.id && references[connection.id],
          );
          const reference = incoming && references[incoming.id];
          return reference ? (
            <div className={styles.references}>
              <h4>Reference distribution</h4>
              <p>Supplied incoming interval · reference distribution</p>
              <ReferenceChart reference={reference} />
            </div>
          ) : null;
        }}
        renderDeviationEvidence={(deviation) =>
          deviation.id === "return-vs-south" ? (
            <div className={styles.forecastReference}>
              <h4>Observed interval against forecast reference</h4>
              <DurationDistribution
                value={425 / 60}
                unit="h"
                domain={[0, 12]}
                bins={bins([12, 38, 26, 12, 8, 4], 2)}
                sampleCount={100}
                label="Illustrative forecast reference"
                visualization="histogram"
                showHealthBands={false}
                showPercentiles={false}
                showScale
                showCountAxis
                showDataTable
                stretch
                labels={{
                  elapsed: "Observed interval",
                  count: "Reference count",
                  observations: "synthetic reference intervals",
                }}
                formatValue={(value) =>
                  Number.isInteger(value) ? String(value) : value.toFixed(2)
                }
              />
              <p>
                Bars: supplied forecast reference. Marker: the 7 h 05 m observed
                interval. No risk threshold is inferred from the distribution.
              </p>
            </div>
          ) : null
        }
      />
      <p id={notesId} hidden={!showNotes} className={styles.caption}>
        Data notes: city centers are illustrative; connections and assessments
        are explicitly supplied. No traveled route or risk is inferred.
      </p>
      <p className={styles.caption}>
        Synthetic observations, candidate connections, reference distributions
        and supplied comparison findings. No live shipment or inferred route.
      </p>
    </div>
  );
}
function useMemoGraph(
  scheme: "light" | "dark",
  withUnassignedEvidence: boolean,
) {
  return React.useMemo(
    () => ({
      ...(withUnassignedEvidence ? workbenchUnassignedGraph : workbenchGraph),
      paths: workbenchGraph.paths.map((path, index) => ({
        ...path,
        color: (scheme === "dark"
          ? ["#83a8ff", "#c4a1ff", "#5fd3c6"]
          : ["#2563eb", "#7c3aed", "#087f8c"])[index],
      })),
    }),
    [scheme, withUnassignedEvidence],
  );
}
