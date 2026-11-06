import React from "react";
import type { FeatureCollection, LineString } from "geojson";
import { Checkbox } from "../Checkbox";
import type { MapOverlay } from "../NetworkMap";
import { Text } from "../Text";
import styles from "./InvestigationPredictions.examples.module.scss";

type Prediction = {
  id: string;
  label: string;
  dash: number[];
  coordinates: number[][];
};

// Entirely synthetic alternatives supplied before later observations. These
// geometries are comparison layers, never additional recorded scan events.
export const ledgerPredictions: readonly Prediction[] = [
  {
    id: "forecast-a-south",
    label: "Via Santa Rosa",
    dash: [6, 3],
    coordinates: [
      [-86.443, 43.957],
      [-87.491, 41.617],
      [-97.516, 35.468],
      [-104.677, 34.936],
      [-112.323, 33.388],
      [-116.96, 32.802],
    ],
  },
  {
    id: "forecast-a-central",
    label: "Via Kansas City",
    dash: [1, 3],
    coordinates: [
      [-86.443, 43.957],
      [-87.491, 41.617],
      [-94.744, 39.124],
      [-104.99, 39.739],
      [-115.14, 36.17],
      [-116.96, 32.802],
    ],
  },
];

export function predictionOverlays(
  pathId: string | undefined,
  color: string,
  enabled: readonly string[],
): MapOverlay[] {
  if (pathId !== "a") return [];
  return ledgerPredictions.map((prediction) => {
    const data: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: prediction.id,
          properties: {
            label: `Predicted path · ${prediction.label}`,
            candidateId: pathId,
            kind: "prediction",
            asOf: "2026-10-22T04:04:00Z",
            source: "Illustrative forecast",
          },
          geometry: { type: "LineString", coordinates: prediction.coordinates },
        },
      ],
    };
    return {
      id: prediction.id,
      label: `Predicted path · ${prediction.label}`,
      visible: enabled.includes(prediction.id),
      data,
      layers: [
        {
          id: "forecast",
          type: "line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": color,
            "line-width": 2,
            "line-opacity": 0.55,
            "line-dasharray": prediction.dash,
          },
        },
      ],
    };
  });
}

/** Optional focused-path legend and controls; every forecast is independently visible. */
export function PredictionComparison({
  color,
  enabled,
  onChange,
}: {
  color: string;
  enabled: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <section
      className={styles.comparison}
      aria-label="Predicted path comparison"
    >
      <div className={styles.heading}>
        <Text as="h4" variant="subtitle2">
          Predicted paths
        </Text>
        <Text as="span" variant="caption" color="subdued">
          History A
        </Text>
      </div>
      <div className={styles.options}>
        {ledgerPredictions.map((prediction) => (
          <Checkbox
            key={prediction.id}
            isSelected={enabled.includes(prediction.id)}
            onChange={(checked) =>
              onChange(
                checked
                  ? [...enabled, prediction.id]
                  : enabled.filter((id) => id !== prediction.id),
              )
            }
          >
            <span className={styles.option}>
              <svg width="26" height="8" aria-hidden="true" focusable="false">
                <path
                  d="M0 4H26"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray={prediction.dash
                    .map((value) => value * 2)
                    .join(" ")}
                />
              </svg>
              {prediction.label}
            </span>
          </Checkbox>
        ))}
      </div>
      <Text as="p" variant="caption" color="subdued">
        Illustrative forecasts as of Oct 22 · 04:04 UTC. Compare their faint
        patterned lines with the recorded connections.
      </Text>
    </section>
  );
}
