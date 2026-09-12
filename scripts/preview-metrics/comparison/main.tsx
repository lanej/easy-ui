import React, { lazy, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../../easy-ui-react/src/Theme";
import { fixtures } from "./fixtures";
import "../../../easy-ui-react/src/styles/global.scss";
import "../../../.storybook/public/poppins.css";
import "../preview.css";
import "./style.css";

const EChartsExample = lazy(() =>
  import("./EChartsExample").then((module) => ({
    default: module.EChartsExample,
  })),
);
const RechartsExample = lazy(() =>
  import("./RechartsExample").then((module) => ({
    default: module.RechartsExample,
  })),
);
const EChartsRefresh = lazy(() =>
  import("./EChartsExample").then((module) => ({
    default: module.EChartsRefresh,
  })),
);
const RechartsRefresh = lazy(() =>
  import("./RechartsExample").then((module) => ({
    default: module.RechartsRefresh,
  })),
);
const query = new URLSearchParams(location.search);

function App() {
  const [engine, setEngine] = useState(query.get("engine") ?? "both");
  const [kind, setKind] = useState(query.get("chart") ?? "all");
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  const [maximum, setMaximum] = useState(100);
  const [responsive, setResponsive] = useState(true);
  const [status, setStatus] = useState<"ready" | "loading" | "empty" | "error">(
    "ready",
  );
  const selection = fixtures.filter(
    (fixture) => kind === "all" || fixture.kind === kind,
  );
  return (
    <ThemeProvider colorScheme={scheme}>
      <main className="engine-comparison" data-scheme={scheme}>
        <p className="eyebrow">EASY UI · LIBRARY EXPERIMENT</p>
        <h1>Analytical chart comparison</h1>
        <p className="note">
          Same 18 synthetic datasets, descriptions, and exact tables. ECharts
          6.1.0 versus Recharts 3.10.1.{" "}
          <a href="/">
            Open the original gallery, including all six lightweight components.
          </a>
        </p>
        <div className="comparison-toolbar">
          <label>
            Renderer{" "}
            <select
              aria-label="Renderer"
              value={engine}
              onChange={(event) => setEngine(event.target.value)}
            >
              <option value="both">Side by side</option>
              <option value="echarts">ECharts</option>
              <option value="recharts">Recharts</option>
            </select>
          </label>
          <label>
            Example{" "}
            <select
              aria-label="Example"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">All 18 examples</option>
              {fixtures.map((fixture) => (
                <option key={fixture.kind} value={fixture.kind}>
                  {fixture.example.title}
                </option>
              ))}
              <option value="refresh">Live refresh</option>
            </select>
          </label>
          <label>
            Theme{" "}
            <select
              aria-label="Theme"
              value={scheme}
              onChange={(event) =>
                setScheme(event.target.value as typeof scheme)
              }
            >
              <option value="light">Light preference</option>
              <option value="dark">Dark preference (default palette)</option>
            </select>
          </label>
          <label>
            State{" "}
            <select
              aria-label="State"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              {["ready", "loading", "empty", "error"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <Suspense fallback={<p role="status">Loading renderer…</p>}>
          {selection.map((fixture) => (
            <section
              key={fixture.kind}
              data-comparison={fixture.kind}
              aria-label={`${fixture.example.title} comparison`}
            >
              <h2>{fixture.example.title}</h2>
              <div
                className={`engine-grid ${engine === "both" ? "" : "single"}`}
              >
                {engine !== "recharts" && (
                  <div data-engine="echarts">
                    <p className="engine-label">Apache ECharts</p>
                    <EChartsExample
                      {...fixture}
                      example={{
                        ...fixture.example,
                        status,
                        onRetry: () => setStatus("ready"),
                      }}
                    />
                  </div>
                )}
                {engine !== "echarts" && (
                  <div data-engine="recharts">
                    <p className="engine-label">
                      Recharts
                      {fixture.kind.includes("heatmap")
                        ? " + native matrix"
                        : fixture.kind === "box-plot"
                          ? " + custom summary marks"
                          : ""}
                    </p>
                    <RechartsExample
                      {...fixture}
                      example={{
                        ...fixture.example,
                        status,
                        onRetry: () => setStatus("ready"),
                      }}
                    />
                  </div>
                )}
              </div>
            </section>
          ))}
          {kind === "refresh" && (
            <section
              data-comparison="refresh"
              aria-label="Live refresh comparison"
            >
              <h2>Zoom through a domain change</h2>
              <p className="note">
                Zoom in, then append data. The domain grows from 0–100 to 0–200.
                Percentage windows should track the expanded domain; an
                untouched absolute window should stay fixed. Switch the case to
                reset both charts.
              </p>
              <div className="comparison-toolbar">
                <label>
                  Case{" "}
                  <select
                    aria-label="Case"
                    value={String(responsive)}
                    onChange={(event) => {
                      setResponsive(event.target.value === "true");
                      setMaximum(100);
                    }}
                  >
                    <option value="true">Responsive default 10–90%</option>
                    <option value="false">Initial absolute window 10–20</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setMaximum((current) => (current === 100 ? 200 : 100))
                  }
                >
                  {maximum === 100 ? "Append data" : "Restore domain"}
                </button>
                <span>Full domain: 0–{maximum}</span>
              </div>
              <div className="engine-grid" key={String(responsive)}>
                <div data-engine="echarts">
                  <p className="engine-label">Apache ECharts · current PR</p>
                  <EChartsRefresh maximum={maximum} responsive={responsive} />
                </div>
                <div data-engine="recharts">
                  <p className="engine-label">Recharts · controlled window</p>
                  <RechartsRefresh maximum={maximum} responsive={responsive} />
                </div>
              </div>
            </section>
          )}
        </Suspense>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
