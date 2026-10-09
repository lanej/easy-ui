import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { EventTimeline } from "./EventTimeline";
import type { EventTimelineEvent } from "./EventItem";
import { HealthAssessment } from "../HealthAssessment";
import { DurationDistribution } from "../DurationDistribution";
import { DurationQuantileMetrics } from "../DurationDistribution/DurationQuantileMetrics";

const events: EventTimelineEvent[] = [
  {
    id: "a1",
    label: "Accepted",
    timeLabel: "09:42",
    locationLabel: "Oakland, CA",
    locationTypeLabel: "Origin facility",
    locationId: "oakland",
    tone: "neutral",
  },
  {
    id: "a2",
    label: "Departed",
    timeLabel: "13:18",
    locationLabel: "Oakland, CA",
    locationId: "oakland",
    tone: "success",
  },
  {
    id: "b1",
    label: "Arrived",
    timeLabel: "17:06",
    receivedTimeLabel: "17:14",
    locationLabel: "Sacramento, CA",
    locationTypeLabel: "Regional hub",
    locationId: "sacramento",
    tone: "warning",
    description: "Source A",
    pathIds: ["candidate-a"],
  },
  {
    id: "b2",
    label: "Arrived",
    timeLabel: "17:06",
    receivedTimeLabel: "18:21",
    locationLabel: "Reno, NV",
    locationTypeLabel: "Sort facility",
    locationId: "reno",
    tone: "danger",
    description: "Source B",
    pathIds: ["candidate-b"],
  },
  {
    id: "c1",
    label: "Additional observation",
    receivedTimeLabel: "19:00",
    tone: "neutral",
    statusLabel: "Not assessed",
  },
];

const meta: Meta<typeof EventTimeline> = {
  title: "Organisms/Data Display/EventTimeline",
  component: EventTimeline,
  parameters: { layout: "padded" },
  args: { events, selectedId: "b1" },
};
export default meta;
type Story = StoryObj<typeof EventTimeline>;
export const Default: Story = {};
export const Compact: Story = { args: { size: "compact" } };
export const Detailed: Story = { args: { size: "detailed" } };
export const MissingData: Story = {
  args: { events: [events[2], events[3], events[4]], selectedId: "b2" },
};
export const Empty: Story = { args: { events: [], selectedId: null } };
/** Duration and assessment belong to the caller's interval, not an invented event. */
const intervalAssessment = (event: EventTimelineEvent) =>
  event.id === "b1" ? (
    <HealthAssessment
      variant="compact"
      label="Facility dwell"
      observation={{ value: 6, unit: "hours" }}
      health={{ assessment: "healthy", label: "As expected" }}
    />
  ) : null;

export const WithIntervalAssessment: Story = {
  args: { renderInterval: intervalAssessment },
};

/** Optional graphical comparison reuses an existing molecule and reference fixture. */
const quantiles = [
  { fraction: 0.5, value: 9, label: "P50" },
  { fraction: 0.9, value: 18, label: "P90" },
];
const regions = [
  { from: 0, to: 10, assessment: "healthy" as const, label: "As expected" },
  {
    from: 10,
    to: 20,
    assessment: "degraded" as const,
    label: "Needs attention",
  },
  {
    from: 20,
    to: Infinity,
    assessment: "unhealthy" as const,
    label: "Outside expectations",
  },
];
const target = (event: EventTimelineEvent) => event.id === "b1";
const current = { value: 6, unit: "hours" };
const assessment = { assessment: "healthy" as const, label: "As expected" };

export const InlineMinimal: Story = {
  args: {
    renderTrailing: (event) =>
      target(event) ? (
        <HealthAssessment
          variant="compact"
          observation={current}
          health={assessment}
        />
      ) : null,
  },
};

export const InlineQuantiles: Story = {
  args: {
    renderTrailing: (event) =>
      target(event) ? (
        <div style={{ minWidth: 200 }}>
          <HealthAssessment
            variant="default"
            observation={current}
            health={assessment}
            observationDetails={
              <DurationQuantileMetrics
                quantiles={quantiles}
                unit="h"
                healthRegions={regions}
              />
            }
            reference={
              <DurationDistribution
                value={6}
                unit="h"
                domain={[0, 30]}
                quantiles={quantiles}
                healthRegions={regions}
                visualization="points"
                stretch={false}
              />
            }
          />
        </div>
      ) : null,
  },
};

export const WithDurationReference: Story = {
  args: {
    renderTrailing: (event) =>
      target(event) ? (
        <HealthAssessment
          variant="compact"
          observation={current}
          health={assessment}
        />
      ) : null,
    renderInterval: (event) =>
      target(event) ? (
        <HealthAssessment
          variant="wide"
          label="Facility dwell"
          observation={current}
          health={assessment}
          observationDetails={
            <DurationQuantileMetrics
              quantiles={quantiles}
              unit="h"
              healthRegions={regions}
            />
          }
          reference={
            <DurationDistribution
              value={6}
              unit="h"
              domain={[0, 30]}
              quantiles={quantiles}
              bins={[
                { from: 0, to: 6, count: 20 },
                { from: 6, to: 12, count: 50 },
                { from: 12, to: 20, count: 25 },
                { from: 20, to: 30, count: 5 },
              ]}
              healthRegions={regions}
              visualization="histogram"
            />
          }
        />
      ) : null,
  },
};

function CoordinatedExample() {
  const [selectedId, setSelectedId] = useState<string | null>("b1");
  const [locationId, setLocationId] = useState<string | null>("sacramento");
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(160px, 1fr)",
        gap: 20,
        maxWidth: 760,
      }}
    >
      <EventTimeline
        events={events}
        selectedId={selectedId}
        onSelectedIdChange={setSelectedId}
        onLocationSelect={(id) => setLocationId(id)}
      />
      <div>
        <h3>Selection bridge</h3>
        <p>Selected event: {selectedId ?? "none"}</p>
        <p>Focused location: {locationId ?? "none"}</p>
        <button type="button" onClick={() => setSelectedId("b2")}>
          Select conflicting observation
        </button>
      </div>
    </div>
  );
}
export const ControlledMapCoordination: Story = {
  render: () => <CoordinatedExample />,
};

/**
 * One review surface for the optional duration presentations. Reuse the
 * existing molecules and render callbacks; no status or quantile policy
 * lives in the timeline.
 */
export const PresentationModes: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ display: "grid", gap: 24, maxWidth: 1100 }}>
      <section style={{ border: "1px solid #c6cfe0", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>01 · Minimal</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13 }}>Current duration and assessment, without reference metrics</p>
        <EventTimeline
          events={events.slice(1, 4)}
          selectedId="b1"
          renderTrailing={(event) =>
            target(event) ? (
              <HealthAssessment
                variant="compact"
                observation={current}
                health={assessment}
              />
            ) : null
          }
        />
      </section>
      <section style={{ border: "1px solid #c6cfe0", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>02 · Inline quantiles</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13 }}>Current duration, semantic P50/P90, and the points-only reference</p>
        <EventTimeline
          events={events.slice(1, 4)}
          selectedId="b1"
          renderTrailing={(event) =>
            target(event) ? (
              <HealthAssessment
                variant="default"
                observation={current}
                health={assessment}
                observationDetails={
                  <DurationQuantileMetrics
                    quantiles={quantiles}
                    unit="h"
                    healthRegions={regions}
                  />
                }
                reference={
                  <DurationDistribution
                    value={6}
                    unit="h"
                    domain={[0, 30]}
                    quantiles={quantiles}
                    healthRegions={regions}
                    visualization="points"
                    stretch={false}
                  />
                }
              />
            ) : null
          }
        />
      </section>
      <section style={{ border: "1px solid #c6cfe0", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>03 · Expanded interval</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13 }}>The inline summary remains compact; the full distribution belongs to the interval</p>
        <EventTimeline
          events={events.slice(1, 4)}
          selectedId="b1"
          renderTrailing={(event) =>
            target(event) ? (
              <HealthAssessment
                variant="compact"
                observation={current}
                health={assessment}
              />
            ) : null
          }
          renderInterval={(event) =>
            target(event) ? (
              <HealthAssessment
                variant="wide"
                label="Facility dwell"
                observation={current}
                health={assessment}
                observationDetails={
                  <DurationQuantileMetrics
                    quantiles={quantiles}
                    unit="h"
                    healthRegions={regions}
                  />
                }
                reference={
                  <DurationDistribution
                    value={6}
                    unit="h"
                    domain={[0, 30]}
                    quantiles={quantiles}
                    bins={[
                      { from: 0, to: 6, count: 20 },
                      { from: 6, to: 12, count: 50 },
                      { from: 12, to: 20, count: 25 },
                      { from: 20, to: 30, count: 5 },
                    ]}
                    healthRegions={regions}
                    visualization="histogram"
                  />
                }
              />
            ) : null
          }
        />
      </section>
    </div>
  ),
};

export const NarrowQuantiles: Story = {
  render: () => (
    <div style={{ width: 380, maxWidth: "100%" }}>
      <EventTimeline
        events={events.slice(1, 4)}
        selectedId="b1"
        renderTrailing={(event) =>
          target(event) ? (
            <HealthAssessment
              variant="default"
              observation={current}
              health={assessment}
              observationDetails={
                <DurationQuantileMetrics
                  quantiles={quantiles}
                  unit="h"
                  healthRegions={regions}
                />
              }
              reference={
                <DurationDistribution
                  value={6}
                  unit="h"
                  domain={[0, 30]}
                  quantiles={quantiles}
                  healthRegions={regions}
                  visualization="points"
                  stretch={false}
                />
              }
            />
          ) : null
        }
      />
    </div>
  ),
};
