import { resolveMapControls } from "./controls";
import type {
  MapArea,
  MapCoordinate,
  MapFacility,
  MapSegment,
  MapSurfaceCell,
  NetworkMapControls,
  NetworkMapProps,
} from "./types";

const origin: MapFacility = {
  id: "origin",
  label: "Origin",
  kind: "warehouse",
  coordinates: [-83.18, 42.37],
  risk: {
    probability: 0.2,
    baseline: 0.1,
    event: "Delivery exception",
    horizonHours: 24,
    cohort: "Facility arrivals",
    asOf: "2026-09-20T12:00:00Z",
    status: "current",
  },
};
const destination: MapFacility = {
  id: "destination",
  label: "Destination",
  kind: "delivery",
  coordinates: [-83.215, 42.307],
};
const segment: MapSegment = {
  id: "leg",
  from: origin.id,
  to: destination.id,
  label: "Observed handoff",
  evidence: "transfer",
};
const area: MapArea = {
  id: "weather",
  label: "Rain forecast",
  coordinates: [
    [-83.2, 42.3],
    [-83.1, 42.3],
    [-83.1, 42.4],
  ],
  evidence: "forecast",
  validFrom: "2026-09-20T12:00:00Z",
  validUntil: "2026-09-21T12:00:00Z",
  source: "Test forecast",
};
const cell: MapSurfaceCell = {
  latMin: 42.3,
  latMax: 42.4,
  lonMin: -83.2,
  lonMax: -83.1,
  medianMinutes: 40,
  iqrMinutes: 12,
  n: 8,
};
const props: NetworkMapProps = {
  title: "Network",
  description: "Test cohort",
  mapStyle: { version: 8, sources: {}, layers: [] },
  workerUrl: "/map-worker.js",
  facilities: [origin, destination],
  segments: [segment],
  selectedSegmentId: segment.id,
  latestFacilityId: destination.id,
  areas: [area],
  surface: {
    cells: [cell],
    source: "Test estimates",
    asOf: "2026-09-20T12:00:00Z",
  },
};
const allEnabled: Required<NetworkMapControls> = {
  fitAll: true,
  selectedSegment: true,
  latestEvent: true,
  risk: true,
  weather: true,
  deliverySurface: true,
  navigation: true,
  scale: true,
};
const controlKeys = Object.keys(allEnabled) as (keyof NetworkMapControls)[];
const legacyKeys = [
  "fitAll",
  "selectedSegment",
  "latestEvent",
  "risk",
] as const;
const legacyDisabled = {
  ...allEnabled,
  fitAll: false,
  selectedSegment: false,
  latestEvent: false,
  risk: false,
};

it("shows applicable controls by default regardless of layer visibility", () => {
  expect(resolveMapControls(props)).toEqual(allEnabled);
  expect(
    resolveMapControls({
      ...props,
      layerVisibility: { risk: false, weather: false, deliverySurface: false },
    }),
  ).toEqual(allEnabled);
});

it.each(controlKeys)("hides only %s when its flag is false", (key) => {
  expect(resolveMapControls({ ...props, controls: { [key]: false } })).toEqual({
    ...allEnabled,
    [key]: false,
  });
});

it("hides all built-in controls with controls=false", () => {
  expect(resolveMapControls({ ...props, controls: false })).toEqual({
    fitAll: false,
    selectedSegment: false,
    latestEvent: false,
    risk: false,
    weather: false,
    deliverySurface: false,
    navigation: false,
    scale: false,
  });
});

it("limits the legacy group to its four controls", () => {
  expect(resolveMapControls({ ...props, networkControls: false })).toEqual(
    legacyDisabled,
  );
});

it.each(legacyKeys)(
  "restores only explicit %s over the legacy group",
  (key) => {
    expect(
      resolveMapControls({
        ...props,
        networkControls: false,
        controls: { [key]: true },
      }),
    ).toEqual({ ...legacyDisabled, [key]: true });
  },
);

it.each<{ name: string; data: Partial<NetworkMapProps> }>([
  {
    name: "empty",
    data: { facilities: [], segments: [], areas: [], surface: undefined },
  },
  {
    name: "invalid",
    data: {
      facilities: [
        { ...origin, coordinates: [NaN, 42] },
        { ...destination, coordinates: [-83, 90] },
      ],
      areas: [{ ...area, coordinates: [[0, 0]] }],
      surface: { ...props.surface!, cells: [{ ...cell, latMin: NaN }] },
    },
  },
])(
  "never restores inapplicable toolbar controls for $name data",
  ({ data }) => {
    expect(
      resolveMapControls({ ...props, ...data, controls: allEnabled }),
    ).toEqual({
      fitAll: false,
      selectedSegment: false,
      latestEvent: false,
      risk: false,
      weather: false,
      deliverySurface: false,
      navigation: true,
      scale: true,
    });
  },
);

it.each<MapSegment["evidence"]>([
  "transfer",
  "measured",
  "planned",
  "inferred",
])("allows a drawable selected %s segment", (evidence) => {
  expect(
    resolveMapControls({
      ...props,
      segments: [
        {
          ...segment,
          evidence,
          coordinates: [origin.coordinates, destination.coordinates],
        },
      ],
    }).selectedSegment,
  ).toBe(true);
});

it.each<{ name: string; data: Partial<NetworkMapProps> }>([
  { name: "no selection", data: { selectedSegmentId: undefined } },
  { name: "missing selection", data: { selectedSegmentId: "absent" } },
  {
    name: "missing endpoint",
    data: { segments: [{ ...segment, to: "absent" }] },
  },
  {
    name: "invalid endpoint despite valid supplied path",
    data: {
      facilities: [origin, { ...destination, coordinates: [NaN, 0] }],
      segments: [
        {
          ...segment,
          coordinates: [origin.coordinates, destination.coordinates],
        },
      ],
    },
  },
  {
    name: "unmeasured route",
    data: { segments: [{ ...segment, evidence: "measured" }] },
  },
  {
    name: "invalid measured route",
    data: {
      segments: [
        {
          ...segment,
          evidence: "measured",
          coordinates: [
            [0, 0],
            [NaN, 1],
          ],
        },
      ],
    },
  },
  {
    name: "single-point measured route",
    data: {
      segments: [{ ...segment, evidence: "measured", coordinates: [[0, 0]] }],
    },
  },
])("hides Selected leg for $name", ({ data }) => {
  expect(
    resolveMapControls({
      ...props,
      ...data,
      controls: { selectedSegment: true },
    }).selectedSegment,
  ).toBe(false);
});

it.each([undefined, "absent", origin.id])(
  "hides Latest events for unavailable location %s",
  (latestFacilityId) => {
    expect(
      resolveMapControls({
        ...props,
        latestFacilityId,
        facilities: [{ ...origin, coordinates: [Infinity, 42] }, destination],
        controls: { latestEvent: true },
      }).latestEvent,
    ).toBe(false);
  },
);

it.each([0, 0.2, 1])(
  "keeps risk probability %s applicable even when stale",
  (probability) => {
    expect(
      resolveMapControls({
        ...props,
        facilities: [
          {
            ...origin,
            risk: { ...origin.risk!, probability, status: "stale" },
          },
        ],
      }).risk,
    ).toBe(true);
  },
);

it.each([null, NaN, Infinity, -0.01, 1.01])(
  "hides risk for unusable probability %s",
  (probability) => {
    expect(
      resolveMapControls({
        ...props,
        facilities: [
          {
            ...origin,
            risk: { ...origin.risk!, probability, status: "unavailable" },
          },
          destination,
        ],
        controls: { risk: true },
      }).risk,
    ).toBe(false);
  },
);

it("requires risk data on a valid facility", () => {
  expect(
    resolveMapControls({
      ...props,
      facilities: [{ ...origin, coordinates: [NaN, 42] }, destination],
      controls: { risk: true },
    }).risk,
  ).toBe(false);
});

it.each<{ name: string; coordinates: readonly MapCoordinate[] }>([
  { name: "empty", coordinates: [] },
  {
    name: "two-point",
    coordinates: [
      [0, 0],
      [1, 1],
    ],
  },
  {
    name: "nonfinite",
    coordinates: [
      [0, 0],
      [1, 0],
      [NaN, 1],
    ],
  },
  {
    name: "outside map bounds",
    coordinates: [
      [0, 0],
      [1, 0],
      [1, 90],
    ],
  },
])("hides Weather for a $name polygon", ({ coordinates }) => {
  expect(
    resolveMapControls({
      ...props,
      areas: [{ ...area, coordinates }],
      controls: { weather: true },
    }).weather,
  ).toBe(false);
});

it.each([0, 40])(
  "allows delivery surface estimate %s minutes",
  (medianMinutes) => {
    expect(
      resolveMapControls({
        ...props,
        surface: { ...props.surface!, cells: [{ ...cell, medianMinutes }] },
      }).deliverySurface,
    ).toBe(true);
  },
);

it.each<Partial<MapSurfaceCell>>([
  { medianMinutes: null },
  { medianMinutes: NaN },
  { medianMinutes: Infinity },
  { medianMinutes: -1 },
  { latMin: NaN },
  { latMin: cell.latMax },
  { lonMin: cell.lonMax + 1 },
  { latMax: 90 },
])("hides Delivery time surface for invalid cell %j", (invalid) => {
  expect(
    resolveMapControls({
      ...props,
      surface: { ...props.surface!, cells: [{ ...cell, ...invalid }] },
      controls: { deliverySurface: true },
    }).deliverySurface,
  ).toBe(false);
});

it("shows a layer toggle when valid data follows an invalid record", () => {
  expect(
    resolveMapControls({
      ...props,
      facilities: [{ ...origin, coordinates: [NaN, 0] }, origin, destination],
      areas: [{ ...area, coordinates: [] }, area],
      surface: {
        ...props.surface!,
        cells: [{ ...cell, medianMinutes: null }, cell],
      },
    }),
  ).toEqual(allEnabled);
});
