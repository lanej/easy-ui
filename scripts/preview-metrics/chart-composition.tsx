import "./audit/console.mjs";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import {
  Chart,
  ChartDataView,
  ChartHeading,
  ChartProvider,
  ChartSurface,
  ChartZoomControls,
  ChartOption,
  ChartZoomState,
  ChartLegendState,
} from "../../easy-ui-react/src/Chart";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";
import "./chart-composition.css";

const base: ChartOption = {
  animation: false,
  grid: { left: 52, right: 32, top: 48, bottom: 40 },
  xAxis: [
    { type: "value", min: 0, max: 100 },
    { type: "value", min: 0, max: 100, show: false },
  ],
  yAxis: { type: "value", min: 0, max: 10 },
  legend: { id: "services", data: ["A", "B"] },
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
        [25, 4],
        [50, 3],
        [75, 6],
        [100, 8],
      ],
    },
    {
      id: "b",
      name: "B",
      type: "line",
      xAxisIndex: 1,
      data: [
        [0, 2],
        [25, 3],
        [50, 5],
        [75, 7],
        [100, 9],
      ],
    },
  ],
};
const option: ChartOption = { baseOption: base };
const dataTable = {
  columns: ["Elapsed time", "A", "B"],
  rows: [
    { id: "start", values: [0, 1, 2] },
    { id: "quarter", values: [25, 4, 3] },
    { id: "middle", values: [50, 3, 5] },
    { id: "three-quarter", values: [75, 6, 7] },
    { id: "end", values: [100, 8, 9] },
  ],
};
let allowRetry = false;
const retryOption: ChartOption = {
  ...base,
  xAxis: [
    {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: {
        formatter: (value: number) => {
          if (!allowRetry)
            throw new Error(
              "Intentional chart acceptance initialization failure",
            );
          return String(value);
        },
      },
    },
    { type: "value", min: 0, max: 100, show: false },
  ],
};
async function engineFor(key: string) {
  const { getInstanceByDom } = await import("echarts/core");
  const element = document.querySelector<HTMLElement>(
    `[data-chart-case="${key}"] [data-chart-state] > div`,
  );
  return element ? getInstanceByDom(element) : undefined;
}
async function readState(key: string) {
  const engine = await engineFor(key);
  if (!engine) return null;
  const current = engine.getOption() as {
    dataZoom: { id?: string; start?: number; end?: number }[];
    legend: { selected: Record<string, boolean> }[];
  };
  return {
    engineId: engine.id,
    typography: engine.getOption().textStyle,
    zoom: current.dataZoom.map(({ id, start, end }) => ({ id, start, end })),
    selected: current.legend[0]?.selected,
  };
}
Object.assign(window, {
  __chartComposition: {
    readState,
    allowRetry: () => {
      allowRetry = true;
    },
    requestLegend: async (key: string) =>
      (await engineFor(key))?.dispatchAction({
        type: "legendToggleSelect",
        name: "A",
      }),
  },
});

function ChartComposition() {
  const [dark, setDark] = useState(false);
  const [large, setLarge] = useState(
    () => new URLSearchParams(location.search).get("large") === "1",
  );
  const [showRetry, setShowRetry] = useState(false);
  const [selection, setSelection] = useState("none");
  const [zoom, setZoom] = useState<ChartZoomState[]>([
    { id: "first", start: 0, end: 100 },
  ]);
  const [legend, setLegend] = useState<ChartLegendState[]>([
    { id: "services", selected: { A: true, B: true } },
  ]);
  const [zoomRequests, setZoomRequests] = useState(0);
  const [legendRequests, setLegendRequests] = useState(0);
  const [renderErrors, setRenderErrors] = useState(0);
  const typography = large
    ? {
        title: 24,
        description: 18,
        label: 16,
        control: 18,
        legend: 16,
        detail: 16,
      }
    : undefined;
  const renderer =
    new URLSearchParams(location.search).get("renderer") === "canvas"
      ? "canvas"
      : "svg";
  return (
    <ThemeProvider colorScheme={dark ? "dark" : "light"}>
      <main
        className="chart-composition-review"
        data-chart-review-theme={dark ? "dark" : "light"}
        data-chart-review-size={large ? "large" : "default"}
        data-chart-review-stress={
          new URLSearchParams(location.search).get("stress") === "1"
        }
      >
        <header>
          <h1>Chart composition acceptance</h1>
          <p>
            Synthetic observations exercise independent composition, coordinated
            interactions, theme changes, and engine recovery.
          </p>
          <div className="chart-review-actions">
            <label>
              <input
                id="chart-theme"
                type="checkbox"
                checked={dark}
                onChange={(event) => setDark(event.target.checked)}
              />{" "}
              Dark chart theme
            </label>
            <label>
              <input
                id="chart-text"
                type="checkbox"
                checked={large}
                onChange={(event) => setLarge(event.target.checked)}
              />{" "}
              Larger chart text
            </label>
          </div>
        </header>
        <section
          className="chart-review-card"
          data-chart-case="independent"
          aria-labelledby="external-chart-title"
        >
          <ChartProvider>
            <ChartHeading
              title="Application-owned report"
              titleId="external-chart-title"
              description="Independent zoom ranges remain distinct. Controls and exact data belong to the surrounding report."
              descriptionId="external-chart-description"
              typography={typography}
            />
            <div data-external-chart-controls>
              <ChartZoomControls typography={typography} />
            </div>
            <ChartSurface
              option={option}
              aria-labelledby="external-chart-title"
              aria-describedby="external-chart-description external-chart-data"
              height={240}
              renderer={renderer}
              typography={typography}
            />
            <ChartDataView
              id="external-chart-data"
              title="Exact observations"
              dataTable={dataTable}
              onRowSelect={setSelection}
              typography={typography}
            />
            <p role="status" data-chart-selection>
              Selected observation: {selection}
            </p>
          </ChartProvider>
        </section>
        <section aria-labelledby="coordinated-heading">
          <h2 id="coordinated-heading">Coordinated chart state</h2>
          <button
            id="request-legend"
            type="button"
            onClick={async () =>
              (await engineFor("pair-a"))?.dispatchAction({
                type: "legendToggleSelect",
                name: "A",
              })
            }
          >
            Toggle series A from first chart
          </button>
          <p
            data-chart-requests
            data-zoom-requests={zoomRequests}
            data-legend-requests={legendRequests}
          >
            Requests: zoom {zoomRequests}, legend {legendRequests}
          </p>
          <div className="chart-review-grid">
            {["a", "b"].map((key) => (
              <div key={key} data-chart-case={`pair-${key}`}>
                <Chart
                  title={`Coordinated ${key.toUpperCase()}`}
                  description="The requested zoom and series visibility are shared."
                  option={option}
                  dataTable={dataTable}
                  height={220}
                  renderer={renderer}
                  typography={typography}
                  zoomState={zoom}
                  legendState={legend}
                  onZoomChange={(next) => {
                    setZoom(next);
                    setZoomRequests((count) => count + 1);
                  }}
                  onLegendChange={(next) => {
                    setLegend(next);
                    setLegendRequests((count) => count + 1);
                  }}
                />
              </div>
            ))}
          </div>
        </section>
        <section data-chart-case="retry">
          <h2 id="retry-heading">Engine recovery</h2>
          {!showRetry && (
            <button
              id="show-retry"
              type="button"
              onClick={() => setShowRetry(true)}
            >
              Exercise engine recovery
            </button>
          )}
          {showRetry && (
            <Chart
              aria-labelledby="retry-heading"
              option={retryOption}
              dataTable={dataTable}
              height={180}
              renderer={renderer}
              typography={typography}
              onRenderError={() => setRenderErrors((count) => count + 1)}
            />
          )}
          <p data-chart-render-errors={renderErrors}>
            Reported initialization errors: {renderErrors}
          </p>
        </section>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<ChartComposition />);
