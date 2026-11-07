import {
  normalizeInvestigationGraph,
  validateInvestigationComparisons,
  type InvestigationGraph,
  type InvestigationPrediction,
} from "./workbenchModel";
import {
  initialInvestigationWorkbenchState as initial,
  reduceInvestigationWorkbench as reduce,
} from "./workbenchState";
import { workbenchMapData } from "./workbenchMap";

const graph: InvestigationGraph = {
  events: [
    { id: "origin", label: "Accepted", locationId: "x" },
    { id: "other", label: "Unrelated", locationId: "z" },
    { id: "visit", label: "Arrived", locationId: "y" },
    { id: "return", label: "Returned", locationId: "x" },
    { id: "delivery", label: "Delivered", locationId: "y" },
    { id: "alone", label: "Delivered", locationId: "z" },
  ],
  connections: [
    { id: "out", fromEventId: "origin", toEventId: "visit", segmentId: "xy" },
    { id: "back", fromEventId: "visit", toEventId: "return", segmentId: "yx" },
    {
      id: "end",
      fromEventId: "return",
      toEventId: "delivery",
      segmentId: "xy",
    },
    { id: "direct", fromEventId: "visit", toEventId: "delivery" },
  ],
  paths: [
    {
      id: "a",
      label: "A",
      color: "#2563eb",
      connectionIds: ["out", "back", "end"],
    },
    { id: "b", label: "B", color: "#7c3aed", connectionIds: ["out", "direct"] },
    {
      id: "c",
      label: "C",
      color: "#087f8c",
      connectionIds: [],
      isolatedEventIds: ["other"],
    },
  ],
  locations: [
    { id: "x", label: "X", coordinates: [-100, 40], kind: "hub" },
    { id: "y", label: "Y", coordinates: [-95, 40], kind: "delivery" },
    { id: "z", label: "Z", coordinates: [-97, 43], kind: "hub" },
  ],
  segments: [
    { id: "xy", from: "x", to: "y", evidence: "inferred", label: "X to Y" },
    { id: "yx", from: "y", to: "x", evidence: "transfer", label: "Y to X" },
  ],
};
const records = normalizeInvestigationGraph(graph).records;
const predictions: InvestigationPrediction[] = [
  {
    id: "p",
    pathId: "a",
    label: "Southern forecast",
    color: "#aa6600",
    source: "Test model",
    asOf: "2026-10-20T00:00:00Z",
    lines: [
      [
        [-100, 40],
        [-95, 40],
      ],
    ],
    dash: [6, 3],
  },
  {
    id: "q",
    pathId: "a",
    label: "Northern forecast",
    color: "#993399",
    source: "Test model",
    asOf: "2026-10-20T00:00:00Z",
    lines: [
      [
        [-100, 40],
        [-97, 43],
      ],
      [
        [-96, 43],
        [-95, 40],
      ],
    ],
  },
];

describe("canonical investigation graph", () => {
  it("derives event, connection and segment membership from explicit history connection IDs", () => {
    const original = structuredClone(graph);
    const result = normalizeInvestigationGraph(graph);
    expect(result.issues).toEqual([]);
    expect(
      result.records.events.find((e) => e.id === "origin")?.pathIds,
    ).toEqual(["a", "b"]);
    expect(
      result.records.events.find((e) => e.id === "return")?.pathIds,
    ).toEqual(["a"]);
    expect(
      result.records.events.find((e) => e.id === "other")?.pathIds,
    ).toEqual(["c"]);
    expect(
      result.records.events.find((e) => e.id === "alone")?.pathIds,
    ).toEqual([]);
    expect(result.records.paths[0].segmentIds).toEqual(["xy", "yx"]);
    expect(result.records.connections[0].pathIds).toEqual(["a", "b"]);
    expect(result.records.events.map((e) => e.id)).toEqual(
      graph.events.map((e) => e.id),
    );
    expect(graph).toEqual(original);
  });
  it("retains revisits, disconnected records, forks and rejoins without adding links", () => {
    expect(records.events.filter((e) => e.locationId === "x")).toHaveLength(2);
    expect(records.connections).toHaveLength(4);
    expect(
      records.connections.some(
        (e) => e.fromEventId === "other" || e.toEventId === "alone",
      ),
    ).toBe(false);
    expect(records.events.find((e) => e.id === "delivery")?.pathIds).toEqual([
      "a",
      "b",
    ]);
  });
  it.each([
    [{ ...graph, events: [...graph.events, graph.events[0]] }, "duplicate-id"],
    [
      {
        ...graph,
        connections: [
          { id: "bad", fromEventId: "missing", toEventId: "visit" },
        ],
      },
      "missing-reference",
    ],
    [
      { ...graph, paths: [{ ...graph.paths[0], connectionIds: ["missing"] }] },
      "missing-reference",
    ],
    [
      {
        ...graph,
        paths: [{ ...graph.paths[0], isolatedEventIds: ["missing"] }],
      },
      "missing-reference",
    ],
    [
      { ...graph, connections: [{ ...graph.connections[0], segmentId: "yx" }] },
      "inconsistent-segment",
    ],
  ] as const)(
    "reports invalid graph input rather than silently inventing a repair",
    (input, code) => {
      expect(
        normalizeInvestigationGraph(input).issues.map((i) => i.code),
      ).toContain(code);
    },
  );
  it("accepts geometry-free observations with no inferred location or path", () => {
    const result = normalizeInvestigationGraph({
      events: [{ id: "e", label: "Report received" }],
      connections: [],
      paths: [],
    });
    expect(result.issues).toEqual([]);
    expect(result.records.events[0].pathIds).toEqual([]);
  });
});

describe("comparison claims", () => {
  const deviation = {
    id: "d",
    predictionId: "p",
    eventId: "return",
    firstDivergenceEventId: "visit",
    summary: "Caller finding",
    facts: [{ label: "Delay", value: "+0 min" }],
    source: "Reviewer",
    asOf: "2026-10-21T00:00:00Z",
  };
  it("accepts supplied findings with provenance and retains explicit zero values", () => {
    expect(
      validateInvestigationComparisons(records, predictions, [deviation]),
    ).toEqual([]);
    expect(deviation.facts[0].value).toBe("+0 min");
  });
  it.each([
    { ...deviation, eventId: "alone" },
    { ...deviation, firstDivergenceEventId: "other" },
    { ...deviation, predictionId: "absent" },
    { ...deviation, source: "" },
  ])("rejects unsupported cross-history or unprovenanced claims", (d) => {
    expect(
      validateInvestigationComparisons(records, predictions, [d]).map(
        (i) => i.code,
      ),
    ).toContain("invalid-deviation");
  });
  it.each([
    { ...predictions[0], pathId: "absent" },
    { ...predictions[0], source: "" },
    { ...predictions[0], dash: [0, 1] },
  ])("rejects malformed forecast references", (p) => {
    expect(
      validateInvestigationComparisons(records, [p], []).map((i) => i.code),
    ).toContain("invalid-prediction");
  });
  it("rejects invalid forecast coordinates and duplicate IDs", () => {
    expect(
      validateInvestigationComparisons(
        records,
        [
          {
            ...predictions[0],
            lines: [
              [
                [200, 40],
                [10, 10],
              ],
            ],
          },
        ],
        [],
      ).map((i) => i.code),
    ).toContain("invalid-geometry");
    expect(
      validateInvestigationComparisons(
        records,
        [predictions[0], predictions[0]],
        [],
      ).map((i) => i.code),
    ).toContain("duplicate-id");
  });
  it("validates assessment references without deriving risk from delivery status", () => {
    expect(
      validateInvestigationComparisons(
        records,
        [],
        [],
        [
          {
            id: "risk",
            target: { type: "event", eventId: "absent" },
            label: "High",
            tone: "danger",
            summary: "Supplied",
            source: "Policy",
            asOf: "Now",
          },
        ],
      ).map((i) => i.code),
    ).toContain("invalid-assessment");
    expect(
      validateInvestigationComparisons(
        records,
        [],
        [],
        [
          {
            id: "risk",
            target: { type: "event", eventId: "alone" },
            label: "High",
            tone: "danger",
            summary: "Supplied",
            source: "Policy",
            asOf: "Now",
          },
        ],
      ),
    ).toEqual([]);
  });
});

describe("workbench state", () => {
  it("keeps history focus and prediction choices when inspecting a location or another event", () => {
    let state = reduce(
      initial,
      { type: "focus", pathId: "a" },
      records,
      predictions,
    );
    state = reduce(state, { type: "compare", id: "p" }, records, predictions);
    state = reduce(
      state,
      { type: "select", selection: { type: "location", locationId: "x" } },
      records,
      predictions,
    );
    expect(state).toMatchObject({
      mode: "deviation",
      focusedPathId: "a",
      comparisonPredictionId: "p",
      selection: { type: "location", locationId: "x" },
    });
    state = reduce(
      state,
      { type: "select", selection: { type: "event", eventId: "alone" } },
      records,
      predictions,
    );
    expect(state.focusedPathId).toBe("a");
  });
  it("inspects the chosen history rather than an observation from the previous selection", () => {
    const selected = {
      ...initial,
      selection: { type: "event" as const, eventId: "origin" },
    };
    expect(
      reduce(selected, { type: "focus", pathId: "b" }, records, predictions)
        .selection,
    ).toEqual({ type: "path", pathId: "b" });
    expect(
      reduce(
        { ...selected, selection: { type: "event", eventId: "return" } },
        { type: "focus", pathId: "b" },
        records,
        predictions,
      ).selection,
    ).toEqual({ type: "path", pathId: "b" });
  });
  it("preserves prediction choices across overview and selects an applicable comparison", () => {
    const focused = reduce(
      initial,
      { type: "focus", pathId: "a" },
      records,
      predictions,
    );
    const compared = reduce(
      focused,
      { type: "compare", id: "q" },
      records,
      predictions,
    );
    const overview = reduce(
      compared,
      { type: "mode", mode: "overview" },
      records,
      predictions,
    );
    expect(overview.enabledPredictionIds).toEqual([]);
    expect(overview.comparisonPredictionId).toBe("q");
    expect(
      reduce(
        overview,
        { type: "mode", mode: "deviation" },
        records,
        predictions,
      ).comparisonPredictionId,
    ).toBe("q");
    expect(
      reduce(
        overview,
        { type: "mode", mode: "deviation" },
        records,
        predictions,
      ).enabledPredictionIds,
    ).toEqual([]);
  });
  it("deduplicates forecast toggles without changing a hidden comparison", () => {
    let state = reduce(
      initial,
      { type: "focus", pathId: "a" },
      records,
      predictions,
    );
    state = reduce(state, { type: "compare", id: "p" }, records, predictions);
    state = reduce(
      state,
      { type: "prediction", id: "p", enabled: true },
      records,
      predictions,
    );
    expect(state.enabledPredictionIds).toEqual(["p"]);
    state = reduce(
      state,
      { type: "prediction", id: "p", enabled: false },
      records,
      predictions,
    );
    expect(state.comparisonPredictionId).toBe("p");
    expect(state.enabledPredictionIds).toEqual([]);
  });
  it("ignores invalid history and forecast choices", () => {
    expect(
      reduce(
        initial,
        { type: "focus", pathId: "absent" },
        records,
        predictions,
      ),
    ).toBe(initial);
    expect(
      reduce(
        { ...initial, focusedPathId: "b" },
        { type: "compare", id: "p" },
        records,
        predictions,
      ).mode,
    ).toBe("overview");
  });
});

describe("map presentation", () => {
  it("never draws forecasts in overview and never promotes prediction vertices to scan locations", () => {
    const map = workbenchMapData(
      records,
      { ...initial, enabledPredictionIds: ["p", "q"] },
      predictions,
      "test",
    );
    expect(map.overlays).toHaveLength(3);
    expect(map.facilities).toHaveLength(3);
    expect(map.facilities.find((f) => f.id === "x")?.color).toBe("#8794a6");
  });
  it("preserves disconnected forecast lines and shared history offsets across focus changes", () => {
    const state = {
      ...initial,
      mode: "focused" as const,
      focusedPathId: "a",
      enabledPredictionIds: ["p", "q"],
    };
    const overview = workbenchMapData(records, initial, predictions, "test");
    const focused = workbenchMapData(records, state, predictions, "test");
    expect(focused.overlays[0].data).toEqual(overview.overlays[0].data);
    expect(
      focused.overlays.find((o) => o.id === "test-forecast-q")?.data.features[0]
        .geometry,
    ).toEqual({ type: "MultiLineString", coordinates: predictions[1].lines });
    expect(
      workbenchMapData(
        records,
        { ...state, focusedPathId: "b" },
        predictions,
        "test",
      ).overlays,
    ).toHaveLength(3);
  });
});

it("splits each forecast independently at the antimeridian", () => {
  const input: InvestigationPrediction = {
    ...predictions[0],
    lines: [
      [
        [179, 40],
        [-179, 42],
      ],
      [
        [10, 20],
        [12, 22],
      ],
    ],
  };
  const result = workbenchMapData(
    records,
    {
      ...initial,
      mode: "focused",
      focusedPathId: "a",
      enabledPredictionIds: ["p"],
    },
    [input],
    "test",
  );
  expect(
    result.overlays.find((o) => o.id === "test-forecast-p")?.data.features[0]
      .geometry,
  ).toEqual({
    type: "MultiLineString",
    coordinates: [
      [
        [179, 40],
        [180, 41],
      ],
      [
        [-180, 41],
        [-179, 42],
      ],
      [
        [10, 20],
        [12, 22],
      ],
    ],
  });
});
