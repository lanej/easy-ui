import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "../utilities/test";
import { ThemeProvider } from "../Theme";
import { Chart } from "./Chart";
import { ChartSurface } from "./ChartSurface";
import { ChartHeading } from "./ChartHeading";
import { ChartDataView } from "./ChartDataView";
import { ChartProvider } from "./ChartProvider";
import { ChartZoomControls } from "./ChartZoomControls";
import { loadChartEngine } from "./engine";
import type { ChartOption } from "./types";

vi.mock("./engine", () => ({ loadChartEngine: vi.fn() }));
let option: ChartOption;
const setOption = vi.fn((next: ChartOption) => {
  option = next;
});
const dispose = vi.fn();
const dispatchAction = vi.fn();
const init = vi.fn(() => ({
  setOption,
  dispose,
  dispatchAction,
  resize: vi.fn(),
  on: vi.fn(),
  getOption: () => option,
}));
const engine = { init } as unknown as Awaited<
  ReturnType<typeof loadChartEngine>
>;
const table = {
  columns: ["Day", "Count"],
  rows: [{ id: "monday", values: ["Monday", 0] }],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadChartEngine).mockResolvedValue(engine);
  option = {
    dataZoom: [{ id: "time", type: "inside", start: 0, end: 100 }],
    series: [],
  };
});

it.each([
  { title: undefined, description: "Description only" },
  { title: "Title only", description: undefined },
  { title: null, description: null },
])(
  "renders independently optional headings without empty elements: %j",
  async (heading) => {
    const { container } = render(
      <ThemeProvider>
        <Chart
          {...heading}
          option={option}
          dataTable={table}
          aria-label="Shipment counts"
        />
      </ThemeProvider>,
    );
    await screen.findByRole("img", { name: "Shipment counts" });
    expect(container.querySelectorAll("h2")).toHaveLength(
      heading.title ? 1 : 0,
    );
    expect(container.querySelectorAll("p")).toHaveLength(
      heading.description ? 1 : 0,
    );
    expect(
      screen.getByRole("region", { name: "Shipment counts" }),
    ).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(
      /(?:null|undefined)(?: location| —)/,
    );
  },
);

it("composes one surface with external heading, controls, and exact data in a caller-owned layout", async () => {
  const onRowSelect = vi.fn();
  render(
    <ThemeProvider>
      <section aria-label="Application report">
        <ChartProvider>
          <ChartHeading
            title="Shipping trends"
            titleId="external-heading"
            description="Counts over time"
            descriptionId="external-description"
          />
          <aside>
            <ChartZoomControls />
          </aside>
          <ChartSurface
            option={option}
            aria-labelledby="external-heading"
            aria-describedby="external-description exact-data"
          />
          <ChartDataView
            id="exact-data"
            title="Exact counts"
            dataTable={table}
            onRowSelect={onRowSelect}
          />
        </ChartProvider>
      </section>
    </ThemeProvider>,
  );
  const surface = await screen.findByRole("img", { name: "Shipping trends" });
  expect(surface).toHaveAttribute(
    "aria-describedby",
    "external-description exact-data",
  );
  expect(screen.getAllByRole("heading")).toHaveLength(1);
  expect(screen.queryByTestId("area")).toBeNull();
  expect(screen.queryByText("View data table")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(dispatchAction).toHaveBeenCalledWith({
    type: "dataZoom",
    dataZoomId: "time",
    start: 25,
    end: 75,
  });
  fireEvent.click(screen.getByRole("button", { name: "Select row: Monday" }));
  expect(onRowSelect).toHaveBeenCalledWith("monday");
  expect(screen.getByRole("cell", { name: "0" })).toBeInTheDocument();
});

it("omits unavailable or mismatched zoom controls and clears them when the surface disappears", async () => {
  const view = (visible = true) => (
    <ThemeProvider>
      <ChartProvider>
        <ChartZoomControls
          target={{ dataZoomId: "missing" }}
          zoomInLabel="Wrong target"
        />
        <ChartZoomControls />
        {visible && <ChartSurface option={option} />}
      </ChartProvider>
    </ThemeProvider>
  );
  const { rerender } = render(view());
  await screen.findByRole("img");
  expect(screen.queryByRole("button", { name: "Wrong target" })).toBeNull();
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  rerender(view(false));
  expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
});

it("recovers a failed lazy import in place and keeps exact data available", async () => {
  const onRetry = vi.fn(),
    onRenderError = vi.fn();
  vi.mocked(loadChartEngine).mockRejectedValueOnce(new Error("Offline"));
  render(
    <ThemeProvider>
      <Chart
        option={option}
        dataTable={table}
        onRetry={onRetry}
        onRenderError={onRenderError}
      />
    </ThemeProvider>,
  );
  await screen.findByRole("alert");
  expect(screen.getByText("View data table")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("img");
  expect(loadChartEngine).toHaveBeenCalledTimes(2);
  expect(onRetry).not.toHaveBeenCalled();
  expect(onRenderError).toHaveBeenCalledOnce();
});

it("recovers engine initialization failure without remounting its surrounding report", async () => {
  init.mockImplementationOnce(() => {
    throw new Error("Engine initialization");
  });
  render(
    <ThemeProvider>
      <input aria-label="Report notes" defaultValue="Keep this" />
      <ChartSurface option={option} retryLabel="Try chart again" />
    </ThemeProvider>,
  );
  const input = screen.getByRole("textbox");
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Try chart again" }));
  await screen.findByRole("img");
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("Keep this");
});

it("applies role typography to engine defaults while preserving authored overrides", async () => {
  const { rerender } = render(
    <ThemeProvider>
      <ChartSurface
        option={{
          ...option,
          xAxis: { axisLabel: { fontSize: 19 } },
          legend: [
            { id: "first" },
            { id: "second", textStyle: { fontSize: 22 } },
          ],
        }}
        typography={{ label: 16, legend: 17, detail: 18 }}
      />
    </ThemeProvider>,
  );
  await screen.findByRole("img");
  expect(option.textStyle?.fontSize).toBe(16);
  expect(
    (option.xAxis as { axisLabel: { fontSize: number } }).axisLabel.fontSize,
  ).toBe(19);
  expect(
    (option.legend as { textStyle: { fontSize: number } }[]).map(
      (legend) => legend.textStyle.fontSize,
    ),
  ).toEqual([17, 22]);
  expect(
    (option.tooltip as { textStyle: { fontSize: number } }).textStyle.fontSize,
  ).toBe(18);
  rerender(
    <ThemeProvider>
      <ChartSurface option={{ series: [] }} typography={{ label: 20 }} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(option.textStyle?.fontSize).toBe(20));
  expect(init).toHaveBeenCalledOnce();
});

it.each(["loading", "empty", "error"] as const)(
  "preserves surface identity and its external data association while %s",
  (status) => {
    const view = (next: typeof status) => (
      <ThemeProvider>
        <h2 id="surface-name">Named observations</h2>
        <p id="surface-data">External exact values remain available</p>
        <ChartSurface
          id="stable-surface"
          aria-labelledby="surface-name"
          aria-describedby="surface-data"
          option={{}}
          status={next}
        />
      </ThemeProvider>
    );
    const { rerender } = render(view(status));
    const surface = screen.getByRole("group", { name: "Named observations" });
    expect(surface).toHaveAttribute("id", "stable-surface");
    expect(surface).toHaveAccessibleDescription(
      "External exact values remain available",
    );
    rerender(view(status));
    expect(screen.getByRole("group", { name: "Named observations" })).toBe(
      surface,
    );
    expect(loadChartEngine).not.toHaveBeenCalled();
  },
);

it("retains the named surface wrapper while an engine loads, fails, and recovers", async () => {
  let reject!: (error: Error) => void;
  vi.mocked(loadChartEngine).mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  render(
    <ThemeProvider>
      <p id="engine-data">External exact data</p>
      <ChartSurface
        id="engine-surface"
        aria-label="Named engine"
        aria-describedby="engine-data"
        option={option}
      />
    </ThemeProvider>,
  );
  const surface = screen.getByRole("group", { name: "Named engine" });
  expect(surface).toHaveAccessibleDescription("External exact data");
  reject(new Error("Engine unavailable"));
  await screen.findByRole("alert");
  expect(screen.getByRole("group", { name: "Named engine" })).toBe(surface);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("img", { name: "Named engine" });
  expect(screen.getByRole("group", { name: "Named engine" })).toBe(surface);
});
