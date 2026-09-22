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
  defaultDeliverySurfaceColorScale,
  buildDeliverySurfacePaint,
  buildMetricPaint,
} from "./surfaceRendering";
import type { MapSurfaceCell } from "./types";

function compileExpression(
  expression: unknown,
  property: "fill-color" | "fill-opacity" = "fill-color",
) {
  const result = createExpression(
    expression,
    `layers[0].paint.${property}`,
    latest.paint_fill[property] as StylePropertySpecification,
  );
  if (result.result === "error") throw new Error(JSON.stringify(result.value));
  return result.value;
}

function compilePaint(property: "fill-color" | "fill-opacity") {
  return compileExpression(deliverySurfacePaint[property], property);
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
  ]).features.map((feature): Feature => ({
    type: "Polygon",
    properties: feature.properties!,
  }));
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

describe("buildDeliverySurfacePaint", () => {
  it("defaults to the exact original 5-stop 0/30/60/90/120 ramp", () => {
    expect(buildDeliverySurfacePaint()).toEqual(deliverySurfacePaint);
    expect(defaultDeliverySurfaceColorScale).toEqual([
      { value: 0, color: "#2c7bb6" },
      { value: 30, color: "#abd9e9" },
      { value: 60, color: "#ffffbf" },
      { value: 90, color: "#fdae61" },
      { value: 120, color: "#d7191c" },
    ]);
  });

  it("changes the fill-color interpolate expression's stops for a caller-supplied scale, e.g. minutes-since-midnight", () => {
    // usps-local-route-detection's real medianMinutes values (~700-1000+) fall outside the
    // default 0-120 elapsed-time ramp; a caller-supplied scale must reach the compiled stops.
    const customScale = [
      { value: 600, color: "#000000" },
      { value: 900, color: "#808080" },
      { value: 1200, color: "#ffffff" },
    ];
    const customPaint = buildDeliverySurfacePaint(customScale);
    expect(customPaint["fill-color"]).not.toEqual(
      deliverySurfacePaint["fill-color"],
    );
    const customColor = compileExpression(customPaint["fill-color"]);
    const feature = mapFeature({ ...cell, medianMinutes: 900 });
    expect(
      customColor.evaluateWithoutErrorHandling(zoom, feature).toString(),
    ).toBe("rgba(128,128,128,1)");
    // The default scale renders 900 minutes identically to its top stop (120) -- exactly the
    // "every cell clamps to solid color" bug this configurable scale exists to fix.
    expect(color.evaluateWithoutErrorHandling(zoom, feature).toString()).toBe(
      "rgba(215,25,28,1)",
    );
  });

  it("leaves fill-opacity (relativeSampleCount-driven) untouched by a custom color scale", () => {
    const customPaint = buildDeliverySurfacePaint([
      { value: 0, color: "#000000" },
      { value: 1, color: "#ffffff" },
    ]);
    expect(customPaint["fill-opacity"]).toEqual(
      deliverySurfacePaint["fill-opacity"],
    );
  });
});

describe("buildMetricPaint", () => {
  it("reads the metric's own field, not medianMinutes, and defaults to the standard scale", () => {
    const paint = buildMetricPaint({ field: "n" });
    const metricColor = compileExpression(paint["fill-color"]);
    const feature = mapFeature({ ...cell, n: 60 });
    expect(
      metricColor.evaluateWithoutErrorHandling(zoom, feature).toString(),
    ).toBe("rgba(255,255,191,1)"); // the default scale's 60-value stop
  });

  it("uses a metric's own colorScale when supplied", () => {
    const paint = buildMetricPaint({
      field: "n",
      colorScale: [
        { value: 1, color: "#111111" },
        { value: 100, color: "#eeeeee" },
      ],
    });
    const metricColor = compileExpression(paint["fill-color"]);
    // n must stay > 0 -- hasSupportedSurfaceEstimate() (and the layer filter built from it)
    // treats n<=0 as no observations at all, regardless of which metric is being rendered.
    const feature = mapFeature({ ...cell, n: 1 });
    expect(
      metricColor.evaluateWithoutErrorHandling(zoom, feature).toString(),
    ).toBe("rgba(17,17,17,1)");
  });

  it("gives a flat, non-blended opacity for supported cells -- no second metric encoded in the same channel", () => {
    const paint = buildMetricPaint({ field: "iqrMinutes" });
    const metricOpacity = compileExpression(
      paint["fill-opacity"],
      "fill-opacity",
    );
    const supported = mapFeature({ ...cell, iqrMinutes: 500 });
    const unsupported = mapFeature({ ...cell, medianMinutes: null });
    expect(metricOpacity.evaluateWithoutErrorHandling(zoom, supported)).toBe(
      0.5,
    );
    expect(metricOpacity.evaluateWithoutErrorHandling(zoom, unsupported)).toBe(
      0,
    );
  });
});
