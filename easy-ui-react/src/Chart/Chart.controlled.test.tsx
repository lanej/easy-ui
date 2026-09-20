import React, { useState } from "react";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { init, setPlatformAPI } from "echarts";
import { render } from "../utilities/test";
import { ThemeProvider } from "../Theme";
import { Chart } from "./Chart";
import { ChartSurface } from "./ChartSurface";
import { ChartProvider } from "./ChartProvider";
import { ChartZoomControls } from "./ChartZoomControls";
import { loadChartEngine } from "./engine";
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
