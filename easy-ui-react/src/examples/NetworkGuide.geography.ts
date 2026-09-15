import type { StyleSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import region from "./NetworkGuide.geography.json";

// Natural Earth 1:50m, public domain. Pinned source/filter method in the example README.
// Object stays stable across selection changes; no remote tiles, glyphs, or sprites.
export const basemap: StyleSpecification = {
  version: 8,
  sources: {
    geography: {
      type: "geojson",
      data: region as FeatureCollection,
      attribution:
        'Made with <a href="https://www.naturalearthdata.com/">Natural Earth</a> · 1:50m generalized geography',
    },
  },
  layers: [
    {
      id: "land",
      type: "background",
      paint: { "background-color": "#f4f3ed" },
    },
    {
      id: "boundaries",
      type: "line",
      source: "geography",
      filter: ["==", ["get", "layer"], "boundaries"],
      paint: {
        "line-color": "#c3c3b8",
        "line-width": 1,
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "water",
      type: "fill",
      source: "geography",
      filter: ["==", ["get", "layer"], "lakes"],
      paint: { "fill-color": "#c4dce8" },
    },
    {
      id: "shore",
      type: "line",
      source: "geography",
      filter: ["==", ["get", "layer"], "lakes"],
      paint: { "line-color": "#9bbdcd", "line-width": 1 },
    },
  ],
};
