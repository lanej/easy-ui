import React, { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "../Theme";
import { Select } from "../Select";
import { Button } from "../Button";
import { TabPanels } from "../TabPanels";
import { Chart } from "../Chart";
import { Card } from "../Card";
import { MetricContent } from "../MetricCard";
import { KpiTile } from "../KpiTile";
import LocalShippingIcon from "@easypost/easy-ui-icons/LocalShipping";
import ScheduleIcon from "@easypost/easy-ui-icons/Schedule";
import { WorkspaceHeader } from "../WorkspaceHeader";
import { Pill } from "../Pill";
import { NetworkInvestigationMap } from "./NetworkInvestigationMap.examples";
import { guideRoot } from "./DesignGuide.fixtures";
import {
  flowChart,
  hubs,
  pressureChart,
  volumeChart,
} from "./NetworkGuide.fixtures";
import styles from "./NetworkGuide.module.scss";

export function NetworkGuideExample({
  initialMode = "coordinated",
  syncURL = false,
  showDataTable = true,
}: {
  initialMode?: "coordinated" | "fragmented";
  syncURL?: boolean;
  showDataTable?: boolean;
}) {
  const { resolvedColorScheme } = useColorScheme();
  const colorScheme = resolvedColorScheme === "dark" ? "dark" : "light";
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

          <NetworkInvestigationMap
            title="Great Lakes transfer network"
            description={`${hub.name} outgoing cohort shown · 08:00–14:00 UTC · straight connections are observed endpoints, not roads`}
            showDataTable={showDataTable}
            selectedFacilityId={selected}
            onFacilitySelect={select}
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
            showDataTable={showDataTable}
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
            <Card
              as="section"
              background="primary"
              paddingX="1"
              paddingY={{ xs: "2", md: "3" }}
            >
              <Chart
                showDataTable={showDataTable}
                variant="bare"
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
            </Card>
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
            showDataTable={showDataTable}
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
    <div
      className={styles.root}
      data-network-guide
      data-color-scheme={colorScheme}
    >
      <div className="workspace-heading">
        <WorkspaceHeader
          title="Network investigation"
          actions={
            <Pill size="sm">Synthetic Ground network · Sep 13, 14:00 UTC</Pill>
          }
        />
        <details className="assumptions">
          <summary>Task assumptions, geography, and evidence limits</summary>
          <p>
            For this exercise all three decision factors are essential. Capacity
            and expected volume are supplied scenario inputs; this screen does
            not infer the cause of an exception or authorize rerouting. Hubs,
            transfers, forecasts, service mixes, and weather are fictional; no
            EasyPost business rules are represented. Basemap: bundled Natural
            Earth 1:50m geography, generalized and unsuitable for routing.
            Straight transfer lines show endpoints, not traveled roads.
          </p>
          <p>
            Applies <a href={guideRoot + "evidence/recall.html"}>E-RECALL</a>,{" "}
            <a href={guideRoot + "evidence/disclosure.html"}>E-DISCLOSURE</a>,
            and <a href={guideRoot + "evidence/tufte.html"}>E-TUFTE</a>. These
            practitioner sources did not test this interface. Linked selection
            and the chosen decision factors are project hypotheses.
          </p>
        </details>
      </div>
      <main
        id="network"
        data-ready="true"
        data-selected-hub={selected}
        data-mode={mode}
      >
        <div className="toolbar">
          <div className="toolbar-field">
            <Select
              label="Investigate hub"
              selectedKey={selected}
              onSelectionChange={(key) => select(String(key))}
            >
              {hubs.map((h) => (
                <Select.Option key={h.id}>{h.name}</Select.Option>
              ))}
            </Select>
          </div>
          <div className="toolbar-field">
            <Select
              label="Presentation"
              selectedKey={mode}
              onSelectionChange={(key) =>
                setMode(key === "fragmented" ? "fragmented" : "coordinated")
              }
            >
              <Select.Option key="coordinated">
                Linked evidence workspace
              </Select.Option>
              <Select.Option key="fragmented">
                Separate evidence tabs
              </Select.Option>
            </Select>
          </div>
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
            ? `Good for this task: shared selection keeps location, pressure, and downstream exposure connected. ${showDataTable ? "Exact tables and methods" : "Methods"} remain available on demand.`
            : "Advisory bad for this task: tabs separate evidence needed together. The same data remains available, but comparison requires remembering the previous view. This may pass layout checks."}
        </p>
        <section
          className="decision-summary"
          aria-label="Selected hub decision context"
        >
          <div data-decision-label>
            <MetricContent
              label="Selected hub"
              value={hub.name}
              typography={{ title: 12 }}
              valueSize={16}
            />
          </div>
          <div data-decision-label>
            <KpiTile
              icon={LocalShippingIcon}
              metric={{
                label: "13:00–14:00 throughput / capacity",
                displayValue: `${Math.round((hub.capacity * hub.pressure) / 100).toLocaleString("en-US")} / ${hub.capacity.toLocaleString("en-US")} per hour`,
              }}
              compact
              bare
              hideUnavailableLabel
            />
          </div>
          <div data-decision-label>
            <KpiTile
              icon={ScheduleIcon}
              accent="purple"
              metric={{
                label: "Median facility dwell · last 24h",
                displayValue: `${hub.dwell} hours`,
              }}
              compact
              bare
              hideUnavailableLabel
            />
          </div>
          <div data-decision-label>
            <MetricContent
              label="New exception risk · next 24h"
              value={
                hub.risk === null
                  ? null
                  : `${Math.round(hub.risk * 100)}% · 6% baseline`
              }
              emptyLabel="Unavailable"
              typography={{ title: 12 }}
              valueSize={16}
            />
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
                  <TabPanels.Item key={panel.id}>{panel.label}</TabPanels.Item>
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
            supplied hourly capacity. It does not show utilization measured from
            equipment or predict failure. Expected volume is a synthetic
            reference profile, not a confidence interval. Map risk concerns new
            tracking exceptions in an inducted facility cohort; it is not the
            risk of each parcel in the transfer Sankey. Sankey links conserve
            counts within the six-hour transfer cohort and do not establish the
            cause or destination of future exceptions.
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
  );
}
