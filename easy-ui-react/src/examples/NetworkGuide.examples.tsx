import React, { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "../Theme";
import { Button } from "../Button";
import { TabPanels } from "../TabPanels";
import { Chart } from "../Chart";
import { NetworkMap } from "../NetworkMap";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { guideRoot } from "./DesignGuide.fixtures";
import {
  facilities,
  flowChart,
  hubs,
  pressureChart,
  segments,
  volumeChart,
  weather,
} from "./NetworkGuide.fixtures";
import { basemap } from "./NetworkGuide.geography";
import styles from "./NetworkGuide.module.scss";

export function NetworkGuideExample({
  initialMode = "coordinated",
  syncURL = false,
}: {
  initialMode?: "coordinated" | "fragmented";
  syncURL?: boolean;
}) {
  const [selected, setSelected] = useState("dtw");
  const [mode, setMode] = useState(initialMode);
  const [tab, setTab] = useState("map");
  const [status, setStatus] = useState(
    "Choose a hub using the map, heatmap, or hub selector. No operational action is sent.",
  );
  const hub = hubs.find((h) => h.id === selected)!;
  const volume = useMemo(() => volumeChart(hub), [hub]);
  const pressure = useMemo(() => pressureChart(selected), [selected]);
  const flow = useMemo(() => flowChart(hub), [hub]);
  const outgoing = useMemo(
    () => segments.filter((s) => s.from === selected),
    [selected],
  );
  useEffect(() => {
    if (!syncURL) return;
    const url = new URL(location.href);
    url.searchParams.set("mode", mode);
    history.replaceState(null, "", url);
  }, [mode, syncURL]);
  function select(id: string) {
    if (hubs.some((h) => h.id === id)) setSelected(id);
  }
  const panels = [
    {
      id: "map",
      label: "Network",
      content: (
        <div data-panel="map" className="map-panel">
          <h2 className="section-label">01 · Where can pressure propagate?</h2>

          <NetworkMap
            onRenderError={(error) =>
              console.error("Network guide map:", error)
            }
            title="Great Lakes transfer network"
            description={`${hub.name} outgoing cohort shown · 08:00–14:00 UTC · straight connections are observed endpoints, not roads`}
            mapStyle={basemap}
            workerUrl={workerUrl}
            facilities={facilities}
            segments={outgoing}
            areas={weather}
            selectedFacilityId={selected}
            onFacilitySelect={select}
            primaryFacilityIds={hubs.map((h) => h.id)}
            height={360}
            showSelectionDetails={false}
          />
        </div>
      ),
    },
    {
      id: "volume",
      label: "Trajectory",
      content: (
        <div data-panel="volume">
          <h2 className="section-label">02 · Is pressure building?</h2>

          <Chart
            title={`${hub.name} · throughput and capacity`}
            description="Hourly parcels · Sep 13, 00:00–14:00 UTC · zero-based 0–2,100 scale stays fixed when selecting hubs"
            {...volume}
            height={330}
          />
        </div>
      ),
    },
    {
      id: "pressure",
      label: "Compare hubs",
      content: (
        <div data-panel="pressure">
          <h2 className="section-label">
            03 · Compare the same hours across hubs
          </h2>

          <div
            className="matrix-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable network pressure chart"
          >
            <Chart
              title="Network pressure by hour"
              description="Observed throughput / supplied hourly capacity · 100% is this scenario’s capacity reference · gray dash means unavailable"
              {...pressure}
              height={345}
              onSelect={(s) => {
                if (Array.isArray(s.value))
                  select(hubs[Number(s.value[1])]?.id);
              }}
              onRowSelect={(id) => select(id.split(":")[0])}
              selectRowLabel="Investigate hub"
            />
          </div>
        </div>
      ),
    },
    {
      id: "flows",
      label: "Downstream flow",
      content: (
        <div data-panel="flows">
          <h2 className="section-label">
            04 · Follow the exposed downstream cohort
          </h2>

          <Chart
            title={`${hub.name} · destination and service mix`}
            description={`${hub.flow.reduce((a, b) => a + b, 0).toLocaleString("en-US")} transferred parcels · 08:00–14:00 UTC · widths encode counts, not delay probability`}
            {...flow}
            height={345}
          />
        </div>
      ),
    },
  ];
  return (
    <ThemeProvider colorScheme="light">
      <div className={styles.root}>
        <header>
          <nav aria-label="Examples">
            <a href="./pricing.html">Action lists</a> ·{" "}
            <a href="./encodings.html">Encodings</a> ·{" "}
            <a href={guideRoot + "decision-context.html"}>Design guidance</a>
          </nav>
          <p className="eyebrow">
            EASY UI · NETWORK INVESTIGATION · P-001 / P-002 / P-004
          </p>
          <div className="title-row">
            <div>
              <h1>Find pressure. Follow its consequences.</h1>
              <p>
                Choose a hub to investigate before the next dispatch using
                capacity, trajectory, and downstream exposure.
              </p>
            </div>
            <p className="snapshot">
              Sep 13, 2026 · 14:00 UTC
              <br />
              <strong>Synthetic Ground network</strong>
            </p>
          </div>
          <details className="assumptions">
            <summary>Task assumptions, geography, and evidence limits</summary>
            <p>
              For this exercise all three decision factors are essential.
              Capacity and expected volume are supplied scenario inputs; this
              screen does not infer the cause of an exception or authorize
              rerouting. Hubs, transfers, forecasts, service mixes, and weather
              are fictional; no EasyPost business rules are represented.
              Basemap: bundled Natural Earth 1:50m geography, generalized and
              unsuitable for routing. Straight transfer lines show endpoints,
              not traveled roads.
            </p>
            <p>
              Applies <a href={guideRoot + "evidence/recall.html"}>E-RECALL</a>,{" "}
              <a href={guideRoot + "evidence/disclosure.html"}>E-DISCLOSURE</a>,
              and <a href={guideRoot + "evidence/tufte.html"}>E-TUFTE</a>. These
              practitioner sources did not test this interface. Linked selection
              and the chosen decision factors are project hypotheses.
            </p>
          </details>
        </header>
        <main
          id="network"
          data-ready="true"
          data-selected-hub={selected}
          data-mode={mode}
        >
          <div className="toolbar">
            <label>
              Investigate hub
              <select
                id="hub"
                value={selected}
                onChange={(e) => select(e.target.value)}
              >
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Presentation
              <select
                id="network-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="coordinated">Linked evidence workspace</option>
                <option value="fragmented">Separate evidence tabs</option>
              </select>
            </label>
            <Button
              onPress={() =>
                setStatus(
                  `${hub.name} queued for analyst investigation. Local demonstration only; no dispatch changed.`,
                )
              }
            >
              Queue investigation
            </Button>
          </div>
          <p className="consequence">
            {mode === "coordinated"
              ? "Good for this task: shared selection keeps location, pressure, and downstream exposure connected. Exact tables and methods remain available on demand."
              : "Advisory bad for this task: tabs separate evidence needed together. The same data remains available, but comparison requires remembering the previous view. This may pass layout checks."}
          </p>
          <section
            className="decision-summary"
            aria-label="Selected hub decision context"
          >
            <div>
              <span>Selected hub</span>
              <strong data-decision-label>{hub.name}</strong>
            </div>
            <div>
              <span>13:00–14:00 throughput / capacity</span>
              <strong data-decision-label>
                {Math.round((hub.capacity * hub.pressure) / 100).toLocaleString(
                  "en-US",
                )}{" "}
                / {hub.capacity.toLocaleString("en-US")} per hour
              </strong>
            </div>
            <div>
              <span>Median facility dwell · last 24h</span>
              <strong data-decision-label>{hub.dwell} hours</strong>
            </div>
            <div>
              <span>New exception risk · next 24h</span>
              <strong data-decision-label>
                {hub.risk === null
                  ? "Unavailable"
                  : `${Math.round(hub.risk * 100)}% · 6% baseline`}
              </strong>
            </div>
          </section>
          {mode === "fragmented" ? (
            <TabPanels
              aria-label="Separated evidence"
              selectedKey={tab}
              onSelectionChange={(key) => setTab(String(key))}
            >
              <div className="tabs">
                <TabPanels.Tabs>
                  {panels.map((panel) => (
                    <TabPanels.Item key={panel.id}>
                      {panel.label}
                    </TabPanels.Item>
                  ))}
                </TabPanels.Tabs>
              </div>
              <div className="workspace">
                <TabPanels.Panels>
                  {panels.map((panel) => (
                    <TabPanels.Item key={panel.id}>
                      {panel.content}
                    </TabPanels.Item>
                  ))}
                </TabPanels.Panels>
              </div>
            </TabPanels>
          ) : (
            <div className="workspace">
              {panels.map((panel) => (
                <React.Fragment key={panel.id}>{panel.content}</React.Fragment>
              ))}
            </div>
          )}
          <p role="status" className="status">
            {status}
          </p>
          <details className="methods">
            <summary>Definitions and limits</summary>
            <p>
              Pressure divides one hour’s observed throughput by that hub’s
              supplied hourly capacity. It does not show utilization measured
              from equipment or predict failure. Expected volume is a synthetic
              reference profile, not a confidence interval. Map risk concerns
              new tracking exceptions in an inducted facility cohort; it is not
              the risk of each parcel in the transfer Sankey. Sankey links
              conserve counts within the six-hour transfer cohort and do not
              establish the cause or destination of future exceptions.
            </p>
            <p>
              Missing Buffalo risk and its 11:00 pressure observation stay
              unavailable. Weather is an optional invented forecast layer;
              proximity does not establish causation. The task may be better
              served by an exact table when geography is irrelevant. Narrow
              screens stack panels and lose simultaneous comparison.{" "}
              <a href="https://lanej.io/viewrule/examples/network-rules.json">
                Scoped label checks
              </a>{" "}
              cannot establish that these are sufficient decision factors.
            </p>
          </details>
        </main>
      </div>
    </ThemeProvider>
  );
}
