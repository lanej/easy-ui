import {
  areaData,
  facilityPointData,
  geographicBounds,
  placeLabels,
  segmentData,
  surfaceData,
} from "./geometry";
import type { MapArea, MapFacility, MapSegment, MapSurfaceCell } from "./types";
import { networkSegments, facilityMetrics } from "./NetworkMap.fixtures";

it("fits dateline and ordinary journeys using the shortest longitude interval", () => {
  expect(
    geographicBounds([
      [179, 10],
      [-179, 20],
    ]),
  ).toEqual([
    [179, 10],
    [181, 20],
  ]);
  expect(
    geographicBounds([
      [-122, 38],
      [-74, 41],
    ]),
  ).toEqual([
    [-122, 38],
    [-74, 41],
  ]);
  expect(
    geographicBounds([
      [NaN, 20],
      [0, 90],
    ]),
  ).toBeNull();
});
it("prioritizes selection, avoids overlapping labels and drops offscreen locations", () => {
  const result = placeLabels(
    [
      { id: "other", x: 200, y: 100, width: 120, priority: 1 },
      { id: "selected", x: 200, y: 100, width: 120, priority: 1000 },
      { id: "offscreen", x: -100, y: 100, width: 120, priority: 1 },
    ],
    400,
    240,
  );
  expect(result.get("selected")).toEqual({ left: 16, top: -13 });
  expect(result.get("other")).not.toEqual(result.get("selected"));
  expect(result.has("offscreen")).toBe(false);
});
it("does not invent measured routes or draw invalid geographic records", () => {
  const facilities: MapFacility[] = [
    { id: "a", label: "A", kind: "hub", coordinates: [0, 0] },
    { id: "b", label: "B", kind: "hub", coordinates: [1, 1] },
  ];
  const base: MapSegment = {
    id: "one",
    from: "a",
    to: "b",
    label: "A to B",
    evidence: "transfer",
  };
  const data = segmentData(facilities, [
    base,
    { ...base, id: "missing", to: "absent" },
    { ...base, id: "unmeasured", evidence: "measured" },
    {
      ...base,
      id: "invalid",
      coordinates: [
        [0, 0],
        [NaN, 2],
      ],
    },
  ]);
  expect(data.features.map((f) => f.id)).toEqual(["one"]);
  expect(data.features[0].geometry).toEqual({
    type: "LineString",
    coordinates: [
      [0, 0],
      [1, 1],
    ],
  });
  expect(data.features[0].properties?.color).toBeUndefined();
});
it("passes a caller-supplied color through as a feature property, omitting it when absent", () => {
  const facilities: MapFacility[] = [
    { id: "a", label: "A", kind: "hub", coordinates: [0, 0] },
    { id: "b", label: "B", kind: "hub", coordinates: [1, 1] },
  ];
  const base: MapSegment = {
    id: "one",
    from: "a",
    to: "b",
    label: "A to B",
    evidence: "transfer",
  };
  const data = segmentData(facilities, [
    { ...base, id: "colored", color: "#ff0000" },
    { ...base, id: "uncolored" },
  ]);
  const byId = new Map(data.features.map((f) => [f.properties?.id, f]));
  expect(byId.get("colored")?.properties?.color).toBe("#ff0000");
  expect(byId.get("uncolored")?.properties?.color).toBeUndefined();
});
it("closes weather rings without inventing geometry for invalid areas", () => {
  const area: MapArea = {
    id: "rain",
    label: "Rain",
    coordinates: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    evidence: "forecast",
    validFrom: "2026-09-13T14:00:00Z",
    validUntil: "2026-09-13T20:00:00Z",
    source: "Synthetic",
  };
  expect(areaData([area]).features[0].geometry).toEqual({
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [0, 0],
      ],
    ],
  });
  expect(
    areaData([
      {
        ...area,
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
    ]).features,
  ).toHaveLength(0);
});
it("builds one clustering-ready GeoJSON point per valid facility, carrying only its id", () => {
  const facilities: MapFacility[] = [
    { id: "a", label: "A", kind: "hub", coordinates: [-122, 38] },
    { id: "b", label: "B", kind: "hub", coordinates: [NaN, 2] },
  ];
  const data = facilityPointData(facilities);
  expect(data.features).toHaveLength(1);
  expect(data.features[0]).toEqual({
    type: "Feature",
    properties: { id: "a" },
    geometry: { type: "Point", coordinates: [-122, 38] },
  });
});
it("converts a grid cell into a closed Polygon feature with its estimate and relative sample count", () => {
  const cells: MapSurfaceCell[] = [
    {
      latMin: 29.8,
      latMax: 29.801,
      lonMin: -95.6,
      lonMax: -95.599,
      medianMinutes: 42,
      iqrMinutes: 15,
      n: 8,
    },
  ];
  const data = surfaceData(cells);
  expect(data.features).toHaveLength(1);
  expect(data.features[0].geometry).toEqual({
    type: "Polygon",
    coordinates: [
      [
        [-95.6, 29.8],
        [-95.599, 29.8],
        [-95.599, 29.801],
        [-95.6, 29.801],
        [-95.6, 29.8],
      ],
    ],
  });
  expect(data.features[0].properties?.medianMinutes).toBe(42);
  expect(data.features[0].properties).toMatchObject({
    n: 8,
    hasSupportedEstimate: true,
    relativeSampleCount: 1,
  });
});

it("retains null estimates without allowing unsupported or invalid cells to dilute valid sample counts", () => {
  const cell: MapSurfaceCell = {
    latMin: 29.8,
    latMax: 29.801,
    lonMin: -95.6,
    lonMax: -95.599,
    medianMinutes: 42,
    iqrMinutes: 15,
    n: 8,
  };
  const missing = { ...cell, medianMinutes: null, n: 10000 };
  const cells = [
    { ...cell, n: 4 },
    cell,
    missing,
    { ...cell, n: 0 },
    { ...cell, latMax: cell.latMin, n: 100000 },
  ];
  const data = surfaceData(cells);
  expect(data.features).toHaveLength(4);
  expect(
    data.features.map((feature) => feature.properties?.relativeSampleCount),
  ).toEqual([0.5, 1, 0, 0]);
  expect(
    data.features.map((feature) => feature.properties?.hasSupportedEstimate),
  ).toEqual([true, true, false, false]);
  expect(data.features[2].properties).toMatchObject({
    medianMinutes: null,
    n: 10000,
  });
  expect(missing.medianMinutes).toBeNull();
  expect(missing.n).toBe(10000);
});

it("returns zero relative sample counts when every valid cell is unsupported", () => {
  const cell: MapSurfaceCell = {
    latMin: 29.8,
    latMax: 29.801,
    lonMin: -95.6,
    lonMax: -95.599,
    medianMinutes: null,
    iqrMinutes: null,
    n: 0,
  };
  const data = surfaceData([cell, { ...cell, medianMinutes: 12 }]);
  expect(data.features).toHaveLength(2);
  for (const feature of data.features) {
    expect(feature.properties?.relativeSampleCount).toBe(0);
    expect(feature.properties?.hasSupportedEstimate).toBe(false);
  }
  expect(surfaceData([]).features).toEqual([]);
});
it("drops surface cells with invalid or missing bounds", () => {
  const valid: MapSurfaceCell = {
    latMin: 29.8,
    latMax: 29.801,
    lonMin: -95.6,
    lonMax: -95.599,
    medianMinutes: 42,
    iqrMinutes: 15,
    n: 8,
  };
  const data = surfaceData([
    valid,
    { ...valid, latMin: NaN },
    { ...valid, latMin: valid.latMax, latMax: valid.latMin },
    { ...valid, lonMin: 200 },
  ]);
  expect(data.features).toHaveLength(1);
});
it("network examples conserve flow at the hubs and reconcile to carrier throughput", () => {
  for (const id of ["slc", "chi", "dtw"]) {
    const incoming = networkSegments
      .filter((s) => s.to === id)
      .reduce((n, s) => n + (s.volume ?? 0), 0);
    const outgoing = networkSegments
      .filter((s) => s.from === id)
      .reduce((n, s) => n + (s.volume ?? 0), 0);
    expect(incoming).toBe(outgoing);
  }
  for (const s of networkSegments.filter((s) => s.from === "dtw"))
    expect(facilityMetrics[s.to].volume).toBe((s.volume ?? 0) * 10);
});
