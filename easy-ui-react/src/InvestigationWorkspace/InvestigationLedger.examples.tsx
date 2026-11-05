import React, { useState } from "react";
import tokens from "@easypost/easy-ui-tokens/js/tokens";
import type { FeatureCollection } from "geojson";
import type { StyleSpecification } from "maplibre-gl";
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
import geography from "./InvestigationLedger.geography.json";
import styles from "./InvestigationWorkspace.stories.module.scss";

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
                    ? "success"
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
            <Pill size="xs" tone={path.id === "b" ? "danger" : "neutral"}>
              {path.id === "b" ? "High risk" : "Unassessed"}
            </Pill>
          </div>
          <Text as="p" variant="body2" color="subdued">
            {path.id === "b"
              ? "The supplied assessment flags the return visit and delivery observation on History B. It does not establish History A as the confirmed journey."
              : "No assessment was supplied for this candidate history."}
          </Text>
          {path.id === "b" && (
            <Text as="p" variant="caption" color="subdued">
              Assessed Oct 23 · 13:10 UTC
            </Text>
          )}
        </section>
      )}
      {selection?.type === "path" && !event && (
        <Text as="p" variant="body2">
          Use the event list or next-event control to inspect the observations
          assigned to this candidate.
        </Text>
      )}
      {event && (
        <Text as="p" variant="caption" color="subdued">
          {paths.length
            ? `Candidate membership: ${paths.map((path) => path.label).join(", ")}.`
            : "No candidate history assigned."}{" "}
          No dwell or facility baseline supplied.
        </Text>
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
}: {
  narrow?: boolean;
  singleHistory?: boolean;
  unassigned?: boolean;
}) {
  const { resolvedColorScheme } = useColorScheme();
  const [selection, setSelection] = useState<InvestigationSelection>({
    type: "event",
    eventId: unassigned
      ? "unassigned-delivery"
      : singleHistory
        ? "a-transit"
        : "b-delivered",
  });
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
          ["ludington", "grand-rapids", "hammond", "kansas-city"].includes(
            location.id,
          ),
        ),
      }
    : ledgerRecords;
  return (
    <div
      className={styles.ledgerExample}
      style={{ maxWidth: narrow ? 390 : 1120 }}
    >
      <header className={styles.ledgerHeader}>
        <div>
          <Text as="h2" variant="heading3">
            Tracking investigation
          </Text>
          <Text as="p" variant="caption" color="subdued">
            Illustrative observations · Oct 22–23, 2026 · UTC
          </Text>
        </div>
        <div
          className={styles.investigationAssessment}
          aria-label="Investigation assessment"
        >
          <Text as="span" variant="caption" color="subdued">
            Investigation
          </Text>
          <Pill size="sm" tone="warning">
            Review needed
          </Pill>
        </div>
      </header>
      <InvestigationWorkspace
        {...records}
        variant="ledger"
        selection={selection}
        onSelectionChange={setSelection}
        labels={{
          timeline: "Observations",
          paths: "Candidate histories",
          allPaths: "All observations",
          map: "Reported locations",
        }}
        map={{
          title: "Reported locations",
          description: "Supplied connections · traveled route unconfirmed",
          mapStyle: resolvedColorScheme === "dark" ? darkStyle : lightStyle,
          workerUrl,
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
            (window as unknown as { ledgerMap: typeof map }).ledgerMap = map;
          },
        }}
        timeline={{
          renderTrailing: (event) => {
            const finding = eventFindings[event.id];
            return (
              <span
                aria-label={`Event assessment: ${finding?.label ?? "Unassessed"}`}
              >
                <Pill
                  size="xs"
                  tone={
                    finding?.level === "high"
                      ? "danger"
                      : finding
                        ? "success"
                        : "neutral"
                  }
                >
                  {finding?.label ?? "Unassessed"}
                </Pill>
              </span>
            );
          },
        }}
        renderPathTrailing={(path) =>
          path.id === "b" ? (
            <span aria-label="History B assessment: High risk">
              <Pill size="xs" tone="danger">
                High risk
              </Pill>
            </span>
          ) : null
        }
        renderDetails={LedgerDetails}
      />
      <Text as="p" variant="caption" color="subdued">
        Rows follow reported time. Lines connect supplied candidate
        observations; separate roots and delivery claims remain distinct.
      </Text>
    </div>
  );
}
