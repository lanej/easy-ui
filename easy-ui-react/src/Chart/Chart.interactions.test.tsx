import React, { useState } from "react";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { init, setPlatformAPI, type GraphSeriesOption } from "echarts";
import { render } from "../utilities/test";
import { ThemeProvider } from "../Theme";
import { Chart } from "./Chart";
import { ChartSurface } from "./ChartSurface";
import { ChartProvider } from "./ChartProvider";
import { ChartZoomControls } from "./ChartZoomControls";
import { loadChartEngine } from "./engine";
import { preserveInteractions } from "./interactions";
import type { ChartInstance } from "./engine";
import type { ChartOption, ChartZoomState, ChartLegendState } from "./types";

vi.mock("./engine", () => ({ loadChartEngine: vi.fn() }));
let engines: ChartInstance[];
const option: ChartOption = {
  animation: false,
  xAxis: [
    { type: "value", min: 0, max: 100 },
    { type: "value", min: 0, max: 100 },
  ],
  yAxis: { type: "value" },
  legend: { id: "services" },
  dataZoom: [
    { id: "first", type: "inside", xAxisIndex: 0, start: 20, end: 80 },
    { id: "second", type: "inside", xAxisIndex: 1, start: 50, end: 100 },
  ],
  series: [
    {
      id: "a",
      name: "A",
      type: "line",
      data: [
        [0, 1],
        [100, 2],
      ],
    },
    {
      id: "b",
      name: "B",
      type: "line",
      xAxisIndex: 1,
      data: [
        [0, 2],
        [100, 3],
      ],
    },
  ],
};
const dataTable = { columns: ["Value"], rows: [{ id: "a", values: [1] }] };
const current = (engine = engines[0]) =>
  engine.getOption() as {
    dataZoom: {
      id: string;
      start: number;
      end: number;
      startValue: number;
      endValue: number;
    }[];
    legend: { selected: Record<string, boolean> }[];
  };
const ranges = (engine = engines[0]) =>
  current(engine).dataZoom.map(({ start, end }) => [start, end]);

const unpositioned: ChartOption = {
  legend: { id: "services" },
  xAxis: { type: "category", data: ["Monday", "Tuesday"] },
  yAxis: { type: "value" },
  series: [
    {
      name: "Ground",
      type: "bar",
      data: [10, 20],
      itemStyle: { color: "#007f86" },
    },
    { name: "Express Saver", type: "bar", data: [4, 8] },
  ],
};

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

it("lays out an accessible legend with engine colors and retains selection across updates", async () => {
  const view = (scheme: "light" | "dark", input = unpositioned) => (
    <ThemeProvider colorScheme={scheme}>
      <ChartSurface option={input} />
    </ThemeProvider>
  );
  const { rerender } = render(view("light"));
  const ground = await screen.findByRole("button", { name: "Ground" });
  expect(ground).toHaveAttribute("aria-pressed", "true");
  expect(ground.querySelector("[aria-hidden]")).toHaveStyle({
    backgroundColor: "#007f86",
  });
  expect(engines[0].getOption().legend).toEqual([
    expect.objectContaining({ show: false }),
  ]);
  fireEvent.click(ground);
  expect(ground).toHaveAttribute("aria-pressed", "false");
  expect(current().legend[0].selected.Ground).toBe(false);
  rerender(view("dark", { ...unpositioned }));
  expect(screen.getByRole("button", { name: "Ground" })).toBe(ground);
  expect(ground).toHaveAttribute("aria-pressed", "false");
  expect(engines).toHaveLength(1);
  rerender(
    view("dark", {
      ...unpositioned,
      legend: {
        id: "services",
        selected: { Ground: true },
        selectedMode: false,
      },
    }),
  );
  expect(screen.queryByRole("button", { name: "Ground" })).toBeNull();
  expect(screen.getByRole("list", { name: "Chart series" })).toHaveTextContent(
    "Ground",
  );
  expect(current().legend[0].selected.Ground).toBe(true);
});

it("keeps HTML legend toggles controlled, including single selection", async () => {
  const requested = vi.fn();
  const input: ChartOption = {
    ...unpositioned,
    legend: { id: "services", selectedMode: "single" },
  };
  const view = (selected: Record<string, boolean>) => (
    <ThemeProvider>
      <ChartSurface
        option={input}
        legendState={[{ id: "services", selected }]}
        onLegendChange={requested}
      />
    </ThemeProvider>
  );
  const { rerender } = render(view({ Ground: true, "Express Saver": false }));
  const express = await screen.findByRole("button", { name: "Express Saver" });
  fireEvent.click(express);
  expect(requested).toHaveBeenCalledWith([
    expect.objectContaining({
      selected: { Ground: false, "Express Saver": true },
    }),
  ]);
  expect(express).toHaveAttribute("aria-pressed", "false");
  rerender(view(requested.mock.calls[0][0][0].selected));
  expect(express).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Ground" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

it("preserves authored native layout and supports an explicit native opt-out", async () => {
  const view = (input: ChartOption, layout?: "auto" | "native") => (
    <ThemeProvider>
      <ChartSurface option={input} layout={layout} />
    </ThemeProvider>
  );
  const { rerender } = render(view(unpositioned, "native"));
  await screen.findByRole("img");
  expect(screen.queryByRole("list", { name: "Chart series" })).toBeNull();
  expect(engines[0].getOption().legend).toEqual([
    expect.objectContaining({ show: true }),
  ]);
  for (const authored of [
    { ...unpositioned, grid: { top: 50, bottom: 80 } },
    { ...unpositioned, legend: { top: 8 } },
    {
      baseOption: unpositioned,
      media: [
        { query: { maxWidth: 400 }, option: { legend: { show: false } } },
      ],
    },
  ]) {
    rerender(view(authored));
    expect(screen.queryByRole("list", { name: "Chart series" })).toBeNull();
  }
  rerender(view(unpositioned));
  expect(
    await screen.findByRole("button", { name: "Ground" }),
  ).toBeInTheDocument();
});

it("preserves real engine zoom and legend state through theme changes, while honoring changed caller settings", async () => {
  const view = (scheme: "light" | "dark", input = option) => (
    <ThemeProvider colorScheme={scheme}>
      <Chart
        title="Theme"
        description="Observations"
        option={input}
        dataTable={dataTable}
      />
    </ThemeProvider>
  );
  const { rerender } = render(view("light"));
  await screen.findByRole("img");
  act(() => {
    engines[0].dispatchAction({
      type: "dataZoom",
      dataZoomId: "first",
      start: 30,
      end: 60,
    });
    engines[0].dispatchAction({ type: "legendUnSelect", name: "A" });
  });
  rerender(view("dark"));
  expect(engines).toHaveLength(1);
  expect(ranges()).toEqual([
    [30, 60],
    [50, 100],
  ]);
  expect(current().legend[0].selected.A).toBe(false);
  rerender(
    view("light", {
      ...option,
      dataZoom: [
        { id: "first", type: "inside", xAxisIndex: 0, start: 0, end: 100 },
      ],
      legend: { id: "services", selected: { A: true } },
    }),
  );
  expect(ranges()).toEqual([[0, 100]]);
  expect(current().legend[0].selected.A).toBe(true);
});

it("finds baseOption zoom controls and leaves independent ranges unchanged", async () => {
  render(
    <ThemeProvider>
      <Chart
        title="Base option"
        option={{ baseOption: option }}
        dataTable={dataTable}
      />
    </ThemeProvider>,
  );
  await screen.findByRole("img");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(ranges()).toEqual([
    [35, 65],
    [50, 100],
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
  expect(ranges()).toEqual([
    [0, 100],
    [50, 100],
  ]);
});

it("targets an explicit zoom ID and preserves native linked-axis zoom behavior", async () => {
  const { rerender } = render(
    <ThemeProvider>
      <Chart
        option={option}
        dataTable={dataTable}
        zoomTarget={{ dataZoomId: "second" }}
      />
    </ThemeProvider>,
  );
  await screen.findByRole("img");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(ranges()).toEqual([
    [20, 80],
    [62.5, 87.5],
  ]);
  rerender(
    <ThemeProvider>
      <Chart
        option={{
          ...option,
          dataZoom: [
            { id: "first", type: "inside", xAxisIndex: 0 },
            { id: "second", type: "slider", xAxisIndex: 0 },
          ],
        }}
        dataTable={dataTable}
      />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(ranges()).toEqual([
    [25, 75],
    [25, 75],
  ]);
});

it("restores controlled ranges and legends after unaccepted user requests and avoids prop feedback loops", async () => {
  const onZoomChange = vi.fn(),
    onLegendChange = vi.fn();
  const props = {
    option,
    zoomState: [{ id: "first", start: 10, end: 90 }],
    legendState: [{ id: "services", selected: { A: true, B: true } }],
    onZoomChange,
    onLegendChange,
  };
  const { rerender } = render(
    <ThemeProvider>
      <ChartSurface {...props} />
    </ThemeProvider>,
  );
  await screen.findByRole("img");
  expect(ranges()[0]).toEqual([10, 90]);
  expect(onZoomChange).not.toHaveBeenCalled();
  act(() =>
    engines[0].dispatchAction({
      type: "dataZoom",
      dataZoomId: "first",
      start: 30,
      end: 60,
    }),
  );
  expect(onZoomChange).toHaveBeenCalledOnce();
  expect(onZoomChange.mock.calls[0][0][0]).toMatchObject({
    id: "first",
    start: 30,
    end: 60,
  });
  expect(ranges()[0]).toEqual([10, 90]);
  act(() =>
    engines[0].dispatchAction({ type: "legendToggleSelect", name: "A" }),
  );
  expect(onLegendChange).toHaveBeenCalledOnce();
  expect(onLegendChange.mock.calls[0][0][0].selected.A).toBe(false);
  expect(current().legend[0].selected.A).toBe(true);
  rerender(
    <ThemeProvider>
      <ChartSurface
        {...props}
        zoomState={[{ id: "first", start: 40, end: 50 }]}
        legendState={[{ id: "services", selected: { A: false } }]}
      />
    </ThemeProvider>,
  );
  expect(ranges()[0]).toEqual([40, 50]);
  expect(current().legend[0].selected.A).toBe(false);
  expect(onZoomChange).toHaveBeenCalledOnce();
  expect(onLegendChange).toHaveBeenCalledOnce();
});

it("scales each range in an explicitly requested independent zoom group", async () => {
  render(
    <ThemeProvider>
      <Chart
        option={option}
        dataTable={dataTable}
        zoomTarget={{ dataZoomId: ["first", "second"] }}
      />
    </ThemeProvider>,
  );
  await screen.findByRole("img");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(ranges()).toEqual([
    [35, 65],
    [62.5, 87.5],
  ]);
});

it("coordinates two independently initialized charts through controlled callbacks", async () => {
  const notifyZoom = vi.fn(),
    notifyLegend = vi.fn();
  function Pair() {
    const [zoomState, setZoom] = useState<ChartZoomState[]>([
      { id: "first", start: 0, end: 100 },
    ]);
    const [legendState, setLegend] = useState<ChartLegendState[]>([
      { id: "services", selected: { A: true } },
    ]);
    return (
      <ThemeProvider>
        {[0, 1].map((i) => (
          <ChartProvider key={i}>
            <section aria-label={`Chart ${i}`}>
              <ChartZoomControls />
              <ChartSurface
                option={option}
                zoomState={zoomState}
                legendState={legendState}
                onZoomChange={(state) => {
                  notifyZoom(state);
                  setZoom(state);
                }}
                onLegendChange={(state) => {
                  notifyLegend(state);
                  setLegend(state);
                }}
              />
            </section>
          </ChartProvider>
        ))}
      </ThemeProvider>
    );
  }
  render(<Pair />);
  await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
  fireEvent.click(
    within(screen.getByRole("region", { name: "Chart 0" })).getByRole(
      "button",
      { name: "Zoom in" },
    ),
  );
  expect(ranges(engines[0])[0]).toEqual([25, 75]);
  expect(ranges(engines[1])[0]).toEqual([25, 75]);
  expect(notifyZoom).toHaveBeenCalledOnce();
  act(() =>
    engines[0].dispatchAction({ type: "legendToggleSelect", name: "A" }),
  );
  expect(current(engines[1]).legend[0].selected.A).toBe(false);
  expect(notifyLegend).toHaveBeenCalledOnce();
});

it("retains interaction state if changing renderer requires a new instance", async () => {
  const { rerender } = render(
    <ThemeProvider>
      <ChartSurface option={option} />
    </ThemeProvider>,
  );
  await screen.findByRole("img");
  act(() =>
    engines[0].dispatchAction({
      type: "dataZoom",
      dataZoomId: "first",
      start: 30,
      end: 60,
    }),
  );
  rerender(
    <ThemeProvider>
      <ChartSurface option={option} renderer="canvas" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(engines).toHaveLength(2));
  expect(ranges(engines[1])[0]).toEqual([30, 60]);
});

it("round-trips anonymous component state through callback indices", async () => {
  const anonymous: ChartOption = {
    ...option,
    legend: {},
    dataZoom: [{ type: "inside", xAxisIndex: 0, start: 0, end: 100 }],
  };
  const onZoomChange = vi.fn(),
    onLegendChange = vi.fn();
  const { rerender } = render(
    <ThemeProvider>
      <ChartSurface
        option={anonymous}
        onZoomChange={onZoomChange}
        onLegendChange={onLegendChange}
      />
    </ThemeProvider>,
  );
  await screen.findByRole("img");
  act(() => {
    engines[0].dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 0,
      start: 20,
      end: 40,
    });
    engines[0].dispatchAction({ type: "legendToggleSelect", name: "A" });
  });
  const requestedZoom = onZoomChange.mock.calls[0][0];
  const requestedLegend = onLegendChange.mock.calls[0][0];
  rerender(
    <ThemeProvider>
      <ChartSurface
        option={anonymous}
        zoomState={requestedZoom}
        legendState={requestedLegend}
      />
    </ThemeProvider>,
  );
  act(() => {
    engines[0].dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 0,
      start: 0,
      end: 100,
    });
    engines[0].dispatchAction({ type: "legendToggleSelect", name: "A" });
  });
  expect(ranges()[0]).toEqual([20, 40]);
  expect(current().legend[0].selected.A).toBe(false);
});

it("retains a zoom window authored in an active media option through theme changes", async () => {
  const responsive: ChartOption = {
    baseOption: option,
    media: [
      {
        query: { minWidth: 500 },
        option: { dataZoom: [{ id: "first", start: 30, end: 70 }] },
      },
    ],
  };
  const view = (colorScheme: "light" | "dark") => (
    <ThemeProvider colorScheme={colorScheme}>
      <ChartSurface option={responsive} />
    </ThemeProvider>
  );
  const { rerender } = render(view("light"));
  await screen.findByRole("img");
  act(() =>
    engines[0].dispatchAction({
      type: "dataZoom",
      dataZoomId: "first",
      start: 40,
      end: 60,
    }),
  );
  rerender(view("dark"));
  expect(ranges()[0]).toEqual([40, 60]);
});

it("retains zoom and legend choices across refreshes while replacing stale series and honoring changed settings", async () => {
  const option: ChartOption = {
    animation: false,
    xAxis: { type: "value", min: 0, max: 100 },
    yAxis: { type: "value" },
    legend: { id: "services" },
    dataZoom: [{ id: "time", type: "inside", start: 0, end: 100 }],
    series: [
      {
        id: "a",
        name: "A",
        type: "line",
        data: [
          [0, 1],
          [100, 2],
        ],
        markLine: { data: [{ yAxis: 1 }] },
      },
      {
        id: "b",
        name: "B",
        type: "line",
        data: [
          [0, 2],
          [100, 3],
        ],
      },
    ],
  };
  const view = (option: ChartOption) => (
    <ThemeProvider>
      <Chart
        title="Refresh"
        description="Observed values"
        option={option}
        dataTable={{ columns: ["Value"], rows: [{ id: "a", values: [1] }] }}
      />
    </ThemeProvider>
  );
  const { rerender, unmount } = render(view(option));
  try {
    await screen.findByRole("img", { name: "Observed values" });
    const engine = engines[0];
    act(() => {
      engine.dispatchAction({ type: "dataZoom", start: 25, end: 75 });
      engine.dispatchAction({ type: "legendUnSelect", name: "A" });
    });
    const refreshed: ChartOption = {
      ...option,
      series: [
        {
          id: "a",
          name: "A",
          type: "line",
          data: [
            [0, 3],
            [100, 4],
          ],
        },
      ],
    };
    rerender(view(refreshed));
    const current = engine.getOption() as {
      dataZoom: {
        start: number;
        end: number;
        startValue: number;
        endValue: number;
      }[];
      legend: { selected: Record<string, boolean> }[];
      series: { id: string; markLine?: { data?: unknown[] } }[];
    };
    expect([current.dataZoom[0].start, current.dataZoom[0].end]).toEqual([
      25, 75,
    ]);
    expect(current.legend[0].selected.A).toBe(false);
    expect(current.series.map((series) => series.id)).toEqual(["a"]);
    expect(current.series[0].markLine?.data ?? []).toEqual([]);

    const controlled: ChartOption = {
      ...refreshed,
      dataZoom: [{ id: "time", type: "inside", start: 0, end: 50 }],
      legend: { id: "services", selected: { A: true } },
    };
    rerender(view(controlled));
    expect(
      (engine.getOption().dataZoom as typeof current.dataZoom)[0].end,
    ).toBe(50);
    expect(
      (engine.getOption().legend as typeof current.legend)[0].selected.A,
    ).toBe(true);

    const valueWindow: ChartOption = {
      ...controlled,
      dataZoom: [{ id: "time", type: "inside", startValue: 10, endValue: 20 }],
    };
    rerender(view(valueWindow));
    rerender(
      view({ ...valueWindow, xAxis: { type: "value", min: 0, max: 200 } }),
    );
    const zoom = (engine.getOption().dataZoom as typeof current.dataZoom)[0];
    expect([zoom.startValue, zoom.endValue]).toEqual([10, 20]);
    rerender(view({ ...refreshed, dataZoom: [] }));
    expect(engine.getOption().dataZoom).toEqual([]);
  } finally {
    unmount();
  }
});

describe("Graph camera", () => {
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
      engine.dispatchAction({
        type: "graphRoam",
        seriesId: id,
        dx: 30,
        dy: -20,
      });
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

  it.each([false, true])(
    "honors removed media camera settings (remove breakpoint=%s)",
    async (removeBreakpoint) => {
      const initial: ChartOption = {
        baseOption: option,
        media: [
          {
            query: { minWidth: 500 },
            option: { series: [{ id: "network", zoom: 1.5 }] },
          },
        ],
      };
      const { rerender } = render(view(initial));
      await screen.findByRole("img");
      roam();
      expect(camera().zoom).toBeCloseTo(3);
      rerender(
        view({
          ...initial,
          media: removeBreakpoint
            ? []
            : [
                {
                  query: { minWidth: 500 },
                  option: { series: [{ id: "network" }] },
                },
              ],
        }),
      );
      expect(camera()).toEqual({ center: null, zoom: 1 });
    },
  );
});
