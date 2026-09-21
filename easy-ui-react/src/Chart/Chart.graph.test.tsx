import React from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { init, setPlatformAPI, type GraphSeriesOption } from "echarts";
import { render } from "../utilities/test";
import { ThemeProvider } from "../Theme";
import { ChartSurface } from "./ChartSurface";
import { loadChartEngine, type ChartInstance } from "./engine";
import { preserveInteractions } from "./interactions";
import type { ChartOption } from "./types";

vi.mock("./engine", () => ({ loadChartEngine: vi.fn() }));
let engines: ChartInstance[];
const graph: GraphSeriesOption = {
  id: "network",
  type: "graph",
  layout: "none",
  roam: true,
  data: [
    { id: "a", name: "Origin", x: 0, y: 0 },
    { id: "b", name: "Destination", x: 100, y: 100 },
  ],
  links: [{ source: "a", target: "b" }],
};
const option: ChartOption = { animation: false, series: [graph] };
const currentGraph = (engine = engines[engines.length - 1], id = "network") =>
  (engine.getOption().series as GraphSeriesOption[]).find(
    (series) => series.id === id,
  )!;
const camera = (series = currentGraph()) => ({
  center: series.center,
  zoom: series.zoom,
});
function roam(id = "network", zoom = 2) {
  act(() => {
    const engine = engines[engines.length - 1];
    engine.dispatchAction({
      type: "graphRoam",
      seriesId: id,
      zoom,
      originX: 300,
      originY: 160,
    });
    engine.dispatchAction({ type: "graphRoam", seriesId: id, dx: 30, dy: -20 });
  });
}
const view = (
  input = option,
  scheme: "light" | "dark" = "light",
  renderer: "svg" | "canvas" = "svg",
) => (
  <ThemeProvider colorScheme={scheme}>
    <ChartSurface option={input} renderer={renderer} />
  </ThemeProvider>
);

beforeEach(() => {
  engines = [];
  setPlatformAPI({ measureText: (text) => ({ width: text.length * 7 }) });
  vi.mocked(loadChartEngine).mockImplementation(
    async () =>
      ({
        init: () => {
          const engine = init(null, undefined, {
            renderer: "svg",
            ssr: true,
            width: 720,
            height: 360,
          });
          engines.push(engine);
          return engine;
        },
      }) as Awaited<ReturnType<typeof loadChartEngine>>,
  );
});

it.each(["theme", "data", "renderer"] as const)(
  "retains graph pan and zoom through a %s change",
  async (change) => {
    const { rerender } = render(view());
    await screen.findByRole("img");
    roam();
    const retained = camera();
    expect(retained.zoom).toBeCloseTo(2);
    expect(retained.center).toHaveLength(2);
    const refreshed = {
      ...option,
      series: [
        { ...graph, data: [{ id: "c", name: "Updated", x: 50, y: 50 }] },
      ],
    };
    rerender(
      view(
        change === "data" ? refreshed : option,
        change === "theme" ? "dark" : "light",
        change === "renderer" ? "canvas" : "svg",
      ),
    );
    await waitFor(() =>
      expect(engines).toHaveLength(change === "renderer" ? 2 : 1),
    );
    expect(camera()).toEqual(retained);
    if (change === "data")
      expect(currentGraph().data).toEqual(refreshed.series[0].data);
    expect(graph).not.toHaveProperty("center");
    expect(graph).not.toHaveProperty("zoom");
  },
);

it("matches graph cameras by series ID when graphs reorder and removes stale series", async () => {
  const second = { ...graph, id: "second" };
  const initial = { ...option, series: [graph, second] };
  const { rerender } = render(view(initial));
  await screen.findByRole("img");
  roam();
  roam("second", 3);
  const firstCamera = camera();
  const secondCamera = camera(currentGraph(undefined, "second"));
  rerender(view({ ...initial, series: [second, graph] }));
  expect(camera()).toEqual(firstCamera);
  expect(camera(currentGraph(undefined, "second"))).toEqual(secondCamera);
  rerender(view(option));
  expect(camera()).toEqual(firstCamera);
  expect(engines[0].getOption().series).toHaveLength(1);
});

it("honors changed and removed authored camera settings", async () => {
  const { rerender } = render(view());
  await screen.findByRole("img");
  roam();
  rerender(
    view({ ...option, series: [{ ...graph, center: [20, 30], zoom: 1.5 }] }),
  );
  expect(camera()).toEqual({ center: [20, 30], zoom: 1.5 });
  rerender(view(option));
  expect(camera()).toEqual({ center: null, zoom: 1 });
});

it.each([false, true])(
  "retains graph cameras in baseOption (active media=%s)",
  async (media) => {
    const nested: ChartOption = {
      baseOption: option,
      ...(media
        ? {
            media: [
              {
                query: { minWidth: 500 },
                option: { series: [{ id: "network", zoom: 1.5 }] },
              },
            ],
          }
        : {}),
    };
    const { rerender } = render(view(nested));
    await screen.findByRole("img");
    roam();
    const retained = camera();
    expect(retained.zoom).toBeCloseTo(media ? 3 : 2);
    rerender(view(nested, "dark"));
    expect(camera()).toEqual(retained);
    if (media) {
      rerender(
        view({
          ...nested,
          media: [
            {
              query: { minWidth: 500 },
              option: { series: [{ id: "network", zoom: 4 }] },
            },
          ],
        }),
      );
      expect(camera().zoom).toBe(4);
    }
  },
);

it("does not carry a graph camera into a different layout or coordinate system", () => {
  const active: ChartOption = {
    series: [{ ...graph, center: [20, 30], zoom: 2 }],
  };
  for (const configured of [
    { ...graph, layout: "circular" as const },
    { ...graph, coordinateSystem: "cartesian2d" },
    { ...graph, scaleLimit: { max: 1.5 } },
    { id: "network", type: "pie" as const },
  ]) {
    const next: ChartOption = { series: [configured] };
    expect(preserveInteractions(next, option, active).series).toEqual([
      configured,
    ]);
  }
});
