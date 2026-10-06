import tokens from "@easypost/easy-ui-tokens/js/tokens";
import type { MapOverlay } from "../NetworkMap";

export function investigationOverlays(scheme: "light" | "dark"): MapOverlay[] {
  const primary = tokens[`theme.${scheme}.color.primary.600`];
  return [
    {
      id: "service-area",
      label: "Service area",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "chicago-area",
            properties: {
              label: "Chicago service area",
              dailyParcels: [420, 460, 445, 510, 530, 495, 560],
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-88.4, 41.3],
                  [-87.1, 41.3],
                  [-87.1, 42.3],
                  [-88.4, 42.3],
                  [-88.4, 41.3],
                ],
              ],
            },
          },
        ],
      },
      layers: [
        {
          id: "fill",
          type: "fill",
          paint: { "fill-color": primary, "fill-opacity": 0.18 },
        },
        {
          id: "outline",
          type: "line",
          paint: { "line-color": primary, "line-width": 2 },
        },
      ],
    },
    {
      id: "route",
      label: "Route",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "route-1",
            properties: {
              label: "Supplied route",
              dailyParcels: [180, 210, 195, 240, 255, 230, 280],
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [-87.63, 41.88],
                [-86.16, 41.7],
                [-84.7, 42.1],
                [-83.18, 42.37],
              ],
            },
          },
        ],
      },
      layers: [
        {
          id: "line",
          type: "line",
          paint: {
            "line-color": primary,
            "line-width": 3,
            "line-dasharray": [2, 1],
          },
        },
      ],
    },
    {
      id: "observations",
      label: "Observations",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "observation-1",
            properties: {
              label: "Chicago scan",
              count: 2,
              dailyParcels: [32, 40, 38, 52, 60, 56, 72],
            },
            geometry: { type: "Point", coordinates: [-87.63, 41.88] },
          },
          {
            type: "Feature",
            id: "observation-2",
            properties: {
              label: "South Bend scan",
              count: 4,
              dailyParcels: [55, 62, 58, 72, 84, 80, 96],
            },
            geometry: { type: "Point", coordinates: [-86.16, 41.7] },
          },
          {
            type: "Feature",
            id: "observation-3",
            properties: {
              label: "Regional scans",
              count: 3,
              dailyParcels: [70, 78, 75, 90, 96, 92, 104],
            },
            geometry: {
              type: "MultiPoint",
              coordinates: [
                [-84.7, 42.1],
                [-83.18, 42.37],
              ],
            },
          },
        ],
      },
      layers: [
        {
          id: "points",
          type: "circle",
          paint: {
            "circle-color": primary,
            "circle-radius": ["+", 4, ["get", "count"]],
            "circle-stroke-color": tokens[`theme.${scheme}.color.neutral.000`],
            "circle-stroke-width": 2,
          },
        },
      ],
    },
  ];
}
