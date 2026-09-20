import {
  createExpression,
  featureFilter,
  latest,
  type Feature,
  type StylePropertySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { surfaceData } from "./geometry";
import {
  deliverySurfaceFilter,
  deliverySurfacePaint,
} from "./surfaceRendering";
import type { MapSurfaceCell } from "./types";

function compilePaint(property: "fill-color" | "fill-opacity") {
  const result = createExpression(
    deliverySurfacePaint[property],
    `layers[0].paint.${property}`,
    latest.paint_fill[property] as StylePropertySpecification,
  );
  if (result.result === "error") throw new Error(JSON.stringify(result.value));
  return result.value;
}

const color = compilePaint("fill-color");
const opacity = compilePaint("fill-opacity");
const filter = featureFilter(deliverySurfaceFilter, "layers[0].filter");
const zoom = { zoom: 8 };
const cell: MapSurfaceCell = {
  latMin: 37,
  latMax: 37.01,
  lonMin: -122,
  lonMax: -121.99,
  medianMinutes: 45,
  iqrMinutes: 10,
  n: 12,
};

function mapFeature(source: MapSurfaceCell): Feature {
  const data = surfaceData([source]);
  expect(data.features).toHaveLength(1);
  return { type: "Polygon", properties: data.features[0].properties! };
}

it.each<Partial<MapSurfaceCell>>([
  { medianMinutes: null },
  { medianMinutes: undefined },
  { medianMinutes: NaN },
  { medianMinutes: Infinity },
  { medianMinutes: -1 },
  { n: 0 },
  { n: -1 },
  { n: NaN },
  { n: Infinity },
])(
  "keeps unsupported cell %j outside the quantitative color ramp",
  (unsupported) => {
    const source = { ...cell, ...unsupported };
    const feature = mapFeature(source);
    expect(feature.properties.medianMinutes).toBe(source.medianMinutes);
    expect(feature.properties.n).toBe(source.n);
    expect(feature.properties.hasSupportedEstimate).toBe(false);
    // Use MapLibre's real filter and paint evaluators, including the JSON worker-transfer form.
    for (const candidate of [
      feature,
      JSON.parse(JSON.stringify(feature)) as Feature,
    ]) {
      expect(filter.filter(zoom, candidate)).toBe(false);
      expect(
        color.evaluateWithoutErrorHandling(zoom, candidate).toString(),
      ).toBe("rgba(0,0,0,0)");
      expect(opacity.evaluateWithoutErrorHandling(zoom, candidate)).toBe(0);
    }
  },
);

it.each<[number, string]>([
  [0, "rgba(44,123,182,1)"],
  [30, "rgba(171,217,233,1)"],
  [60, "rgba(255,255,191,1)"],
  [90, "rgba(253,174,97,1)"],
  [120, "rgba(215,25,28,1)"],
  [180, "rgba(215,25,28,1)"],
])(
  "preserves the existing ramp at %s minutes, including a real zero estimate",
  (medianMinutes, expected) => {
    const feature = mapFeature({ ...cell, medianMinutes });
    expect(filter.filter(zoom, feature)).toBe(true);
    expect(color.evaluateWithoutErrorHandling(zoom, feature).toString()).toBe(
      expected,
    );
    expect(opacity.evaluateWithoutErrorHandling(zoom, feature)).toBe(0.5);
  },
);

it("uses relative positive sample count for opacity without treating no samples as a valid estimate", () => {
  const features = surfaceData([
    { ...cell, n: 8 },
    { ...cell, n: 4 },
    { ...cell, n: 0 },
    { ...cell, medianMinutes: null, n: 10000 },
  ]).features.map(
    (feature): Feature => ({
      type: "Polygon",
      properties: feature.properties!,
    }),
  );
  expect(features.map((feature) => filter.filter(zoom, feature))).toEqual([
    true,
    true,
    false,
    false,
  ]);
  const alphas = features.map(
    (feature) => opacity.evaluateWithoutErrorHandling(zoom, feature) as number,
  );
  expect(alphas[0]).toBe(0.5);
  expect(alphas[1]).toBeCloseTo(0.275);
  expect(alphas.slice(2)).toEqual([0, 0]);
});
