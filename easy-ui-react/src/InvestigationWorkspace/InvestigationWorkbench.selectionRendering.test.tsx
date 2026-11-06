import React from "react";
import { render } from "../utilities/test";
import type { MapOverlay, MapSegment, NetworkMapProps } from "../NetworkMap";
import { InvestigationWorkbench } from "./InvestigationWorkbench";
import {
  normalizeInvestigationGraph,
  type InvestigationGraph,
} from "./workbenchModel";
import { selectedObservationOverlays, workbenchMapData } from "./workbenchMap";
import { initialInvestigationWorkbenchState } from "./workbenchState";

let mapProps: NetworkMapProps;
vi.mock("../NetworkMap", () => ({
  NetworkMap: (props: NetworkMapProps) => {
    mapProps = props;
    return <div data-testid="selection-map" />;
  },
}));

function graphFor(
  evidence: MapSegment["evidence"] = "inferred",
  assigned = true,
): InvestigationGraph {
  return {
    events: [
      { id: "a", label: "Accepted", locationId: "x" },
      { id: "b", label: "Arrived", locationId: "y" },
    ],
    locations: [
      { id: "x", label: "Origin", coordinates: [-100, 40], kind: "hub" },
      { id: "y", label: "Hub", coordinates: [-95, 40], kind: "hub" },
    ],
    connections: [
      { id: "ab", fromEventId: "a", toEventId: "b", segmentId: "xy" },
    ],
    segments: [
      {
        id: "xy",
        from: "x",
        to: "y",
        evidence,
        label: "Supplied transfer",
        coordinates: [
          [-100, 40],
          [-98, 41],
          [-95, 40],
        ],
      },
    ],
    paths: assigned
      ? [
          { id: "A", label: "A", color: "#2563eb", connectionIds: ["ab"] },
          { id: "B", label: "B", color: "#7c3aed", connectionIds: ["ab"] },
        ]
      : [],
  };
}
const candidateFilter = [
  "in",
  ["get", "evidence"],
  ["literal", ["inferred", "planned"]],
];

describe("selected connection rendering", () => {
  it.each(["inferred", "planned", "transfer", "measured"] as const)(
    "preserves %s evidence in assigned and unassigned selections",
    (evidence) => {
      for (const assigned of [true, false]) {
        const records = normalizeInvestigationGraph(
          graphFor(evidence, assigned),
        ).records;
        const selected = selectedObservationOverlays(
          records,
          ["a", "b"],
          "test",
        ).filter((overlay) => !overlay.id.endsWith("-points"));
        expect(selected).toHaveLength(assigned ? 2 : 1);
        for (const overlay of selected) {
          expect(overlay.data.features[0].properties?.evidence).toBe(evidence);
          expect(overlay.data.features[0].properties?.label).toBe(
            "Supplied transfer",
          );
          // No unconditional selection stroke may paint over these two mutually exclusive layers.
          expect(overlay.layers).toHaveLength(2);
          const observed = overlay.layers.find(
            (layer) => layer.id === "observed",
          )!;
          const candidate = overlay.layers.find(
            (layer) => layer.id === "candidate",
          )!;
          expect(observed.filter).toEqual(["!", candidateFilter]);
          expect(candidate.filter).toEqual(candidateFilter);
          expect(observed.paint).not.toHaveProperty("line-dasharray");
          expect(candidate.paint).toHaveProperty("line-dasharray", [2, 2]);
          expect(observed.paint).toHaveProperty("line-width", 5);
          expect(candidate.paint).toHaveProperty("line-width", 5);
        }
      }
    },
  );

  it("retains base geometry, colors, evidence filters and distinct membership offsets", () => {
    const records = normalizeInvestigationGraph(graphFor()).records;
    const base = workbenchMapData(
      records,
      initialInvestigationWorkbenchState,
      [],
      "test",
    );
    const selected = selectedObservationOverlays(
      records,
      ["a", "b"],
      "test",
    ).filter((overlay) => overlay.id.includes("-selected-history-"));
    expect(
      selected.map((overlay) => overlay.data.features[0].properties?.offset),
    ).toEqual([-2, 2]);
    for (let i = 0; i < selected.length; i++) {
      expect(selected[i].data).toEqual(base.overlays[i].data);
      selected[i].layers.forEach((layer, index) => {
        expect(layer.filter).toEqual(base.overlays[i].layers[index].filter);
        expect(layer.paint).toMatchObject({
          "line-color": records.paths[i].color,
          "line-offset": ["get", "offset"],
        });
      });
    }
  });

  it("keeps offsets stable when only one history's connection is selected", () => {
    const base = graphFor();
    const graph: InvestigationGraph = {
      ...base,
      events: [...base.events, { id: "c", label: "Revisit", locationId: "y" }],
      connections: [
        ...base.connections,
        { id: "ac", fromEventId: "a", toEventId: "c", segmentId: "xy" },
      ],
      paths: [base.paths[0], { ...base.paths[1], connectionIds: ["ac"] }],
    };
    const records = normalizeInvestigationGraph(graph).records;
    const overlays = selectedObservationOverlays(records, ["a", "b"], "test");
    const selected = overlays.filter((overlay) =>
      overlay.id.includes("-selected-history-"),
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].data.features[0].properties?.offset).toBe(-2);
    const reordered = selectedObservationOverlays(
      normalizeInvestigationGraph({
        ...graph,
        paths: [...graph.paths].reverse(),
      }).records,
      ["a", "b"],
      "test",
    );
    expect(reordered).toEqual(overlays);
  });

  it("does not draw an edge when its other endpoint is not selected", () => {
    const records = normalizeInvestigationGraph(graphFor()).records;
    expect(
      selectedObservationOverlays(records, ["a"], "test").map(
        (overlay) => overlay.id,
      ),
    ).toEqual(["test-selected-points"]);
    expect(selectedObservationOverlays(records, [], "test")).toEqual([]);
  });
});

const external: MapOverlay = {
  id: "external",
  label: "External evidence",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "e",
        properties: {},
        geometry: { type: "Point", coordinates: [-100, 40] },
      },
    ],
  },
  layers: [{ id: "points", type: "circle", paint: { "circle-radius": 5 } }],
};
const externalHit = {
  overlayId: external.id,
  overlay: external,
  feature: external.data.features[0],
};
function setup(options: Partial<NetworkMapProps> = {}) {
  render(
    <InvestigationWorkbench
      graph={graphFor()}
      map={{
        mapStyle: { version: 8, sources: {}, layers: [] },
        workerUrl: "/worker.js",
        overlays: [external],
        ...options,
      }}
    />,
  );
}
const inspect = (pinned = false) =>
  mapProps.renderOverlayHoverDetails!({
    pinned,
    overlays: [external],
    selections: [externalHit],
  });

describe("workbench inspection suppression", () => {
  it.each([null, false, undefined])(
    "preserves external suppression (%s) on hover and click",
    (suppressed) => {
      const hover = vi.fn(() => suppressed);
      const legacy = vi.fn(() => "Must not bypass explicit suppression");
      setup({ renderOverlayHoverDetails: hover, renderOverlayDetails: legacy });
      expect(inspect()).toBeNull();
      expect(inspect(true)).toBeNull();
      expect(hover).toHaveBeenCalledTimes(2);
      expect(legacy).not.toHaveBeenCalled();
    },
  );

  it.each([null, false, undefined])(
    "preserves legacy click suppression (%s) without invoking it on hover",
    (suppressed) => {
      const legacy = vi.fn(() => suppressed);
      setup({ renderOverlayDetails: legacy });
      expect(inspect()).toBeNull();
      expect(legacy).not.toHaveBeenCalled();
      expect(inspect(true)).toBeNull();
      expect(legacy).toHaveBeenCalledExactlyOnceWith(externalHit);
    },
  );

  it("omits unsupported external and empty inspections", () => {
    setup();
    expect(inspect()).toBeNull();
    expect(inspect(true)).toBeNull();
    expect(
      mapProps.renderOverlayHoverDetails!({ overlays: [], selections: [] }),
    ).toBeNull();
  });

  it("retains owned content when an overlapping external renderer suppresses its content", () => {
    const hover = vi.fn(() => false);
    setup({ renderOverlayHoverDetails: hover });
    const owned = mapProps.overlays!.find((overlay) =>
      overlay.id.endsWith("-history-A"),
    )!;
    const content = mapProps.renderOverlayHoverDetails!({
      overlays: [owned, external],
      selections: [
        {
          overlayId: owned.id,
          overlay: owned,
          feature: owned.data.features[0],
        },
        externalHit,
      ],
    });
    const view = render(<>{content}</>);
    expect(view.getByText("Supplied transfer")).toBeInTheDocument();
    expect(
      view.getByText("Supplied candidate relationship"),
    ).toBeInTheDocument();
    expect(hover).toHaveBeenCalledExactlyOnceWith({
      overlays: [external],
      selections: [externalHit],
    });
  });

  it("does not discard zero or collection-only external content", () => {
    setup({ renderOverlayHoverDetails: () => 0 });
    expect(render(<>{inspect()}</>).container).toHaveTextContent("0");
    expect(
      render(
        <>
          {mapProps.renderOverlayHoverDetails!({
            overlays: [external],
            selections: [],
          })}
        </>,
      ).container,
    ).toHaveTextContent("0");
  });

  it("keeps the first legacy click feature and never invokes it on hover", () => {
    const legacy = vi.fn(() => "Click evidence");
    setup({ renderOverlayDetails: legacy });
    expect(inspect()).toBeNull();
    const content = mapProps.renderOverlayHoverDetails!({
      pinned: true,
      overlays: [external],
      selections: [
        externalHit,
        { ...externalHit, feature: { ...externalHit.feature, id: "second" } },
      ],
    });
    expect(
      render(<>{content}</>).getByText("Click evidence"),
    ).toBeInTheDocument();
    expect(legacy).toHaveBeenCalledExactlyOnceWith(externalHit);
  });
});
