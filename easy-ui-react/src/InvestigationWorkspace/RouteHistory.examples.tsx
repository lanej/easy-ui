import React, { useState } from "react";
import type { FeatureCollection } from "geojson";
import type { StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Select } from "../Select";
import { useColorScheme } from "../Theme";
import { RouteHistory } from "./RouteHistory";
import {
  disjointRouteHistory,
  forkedRouteHistory,
  routeHistoryAnnotations,
} from "./RouteHistory.fixtures";
import states from "./InvestigationLedger.geography.json";
import metro from "./RouteHistory.geography.json";

// Local regional cartography keeps both the primary map and the national inset
// available offline. County coastlines: 2022 Census 1:500k cartographic boundaries
// (citysdk fc5d788). Roads: Natural Earth 1:10m, north_america (ca96624).
// Clipped to [-74.5, 40.34, -73.1, 41.09], simplified to 0.00055°/0.0005°
// respectively and rounded to four decimals. Marker coordinates are city references.
const attribution =
  'US Census Bureau · <a href="https://www.naturalearthdata.com">Natural Earth</a>';

function createMapStyle(dark: boolean): StyleSpecification {
  const water = dark ? "#101e2a" : "#d9e9ee";
  const land = dark ? "#253441" : "#f1f0eb";
  const border = dark ? "#435564" : "#c7c6bd";
  return {
    version: 8,
    sources: {
      states: {
        type: "geojson",
        data: states as FeatureCollection,
        attribution: "US Census · us-atlas",
      },
      metro: { type: "geojson", data: metro as FeatureCollection, attribution },
    },
    layers: [
      { id: "water", type: "background", paint: { "background-color": water } },
      {
        id: "states",
        type: "fill",
        source: "states",
        paint: { "fill-color": land, "fill-outline-color": border },
      },
      {
        id: "regional-water",
        type: "fill",
        source: "metro",
        minzoom: 7,
        filter: ["==", ["get", "kind"], "frame"],
        paint: { "fill-color": water },
      },
      {
        id: "counties",
        type: "fill",
        source: "metro",
        minzoom: 7,
        filter: ["==", ["get", "kind"], "county"],
        paint: { "fill-color": land, "fill-outline-color": border },
      },
      {
        id: "roads",
        type: "line",
        source: "metro",
        minzoom: 7,
        filter: ["==", ["get", "kind"], "road"],
        paint: {
          "line-color": dark ? "#3c4d5d" : "#d3d1c8",
          "line-width": 0.75,
        },
      },
    ],
  };
}

const baseStyles = { dark: createMapStyle(true), light: createMapStyle(false) };
const examples = {
  fork: {
    graph: forkedRouteHistory,
    eventId: "2",
    label: "Illustrative two-route case",
    summary: "October 27, 2026 · 2 candidate routes",
  },
  excerpt: {
    graph: disjointRouteHistory,
    eventId: "9",
    label: "Katy / New York excerpt",
    summary: "October 26–27, 2026 · Label destination unavailable",
  },
};

export function RouteHistoryExample({
  initialCase = "fork",
}: {
  initialCase?: keyof typeof examples;
}) {
  const { resolvedColorScheme } = useColorScheme();
  const systemDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const scheme =
    resolvedColorScheme === "dark" ||
    (resolvedColorScheme === "system" && systemDark) ||
    (resolvedColorScheme === "inverted" && !systemDark)
      ? "dark"
      : "light";
  const [example, setExample] = useState(initialCase);
  const { graph, eventId, summary } = examples[example];
  const annotations = routeHistoryAnnotations(graph);
  const themedGraph =
    scheme === "dark"
      ? graph
      : {
          ...graph,
          paths: graph.paths.map((path) => ({
            ...path,
            color: path.id === "a" ? "#15669c" : "#7046aa",
          })),
        };
  return (
    <RouteHistory
      key={example}
      title="Route history"
      summary={summary}
      graph={themedGraph}
      defaultSelection={{ type: "event", eventId }}
      timeZoneLabel="UTC"
      eventAnnotations={annotations}
      map={{
        mapStyle: baseStyles[scheme],
        description:
          example === "excerpt" ? "Texas and New York" : "New York metro",
        workerUrl,
        controls: false,
        ...(example === "excerpt" && {
          showOverviewInset: true,
          initialView: { center: [-73.74, 40.72], zoom: 9 },
        }),
      }}
      actions={
        <Select
          aria-label="Example scan history"
          size="sm"
          selectedKey={example}
          onSelectionChange={setExample}
        >
          <Select.Option key="fork">{examples.fork.label}</Select.Option>
          <Select.Option key="excerpt">{examples.excerpt.label}</Select.Option>
        </Select>
      }
    />
  );
}
