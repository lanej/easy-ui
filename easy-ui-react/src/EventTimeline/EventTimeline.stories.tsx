import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { EventTimeline } from "./EventTimeline";
import type { EventTimelineEvent } from "./EventItem";
import { HealthAssessment } from "../HealthAssessment";
import { DurationReferenceExample } from "../HealthAssessment/DurationReference.example";

const events: EventTimelineEvent[] = [
  { id: "a1", label: "Accepted", timeLabel: "09:42", locationLabel: "Oakland, CA", locationTypeLabel: "Origin facility", locationId: "oakland", tone: "neutral" },
  { id: "a2", label: "Departed", timeLabel: "13:18", locationLabel: "Oakland, CA", locationId: "oakland", tone: "success" },
  { id: "b1", label: "Arrived", timeLabel: "17:06", receivedTimeLabel: "17:14", locationLabel: "Sacramento, CA", locationTypeLabel: "Regional hub", locationId: "sacramento", tone: "warning", description: "Source A", pathIds: ["candidate-a"] },
  { id: "b2", label: "Arrived", timeLabel: "17:06", receivedTimeLabel: "18:21", locationLabel: "Reno, NV", locationTypeLabel: "Sort facility", locationId: "reno", tone: "danger", description: "Source B", pathIds: ["candidate-b"] },
  { id: "c1", label: "Additional observation", receivedTimeLabel: "19:00", tone: "neutral", statusLabel: "Not assessed" },
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
export const MissingData: Story = { args: { events: [events[2], events[3], events[4]], selectedId: "b2" } };
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
export const WithDurationReference: Story = {
  args: {
    renderInterval: (event) =>
      event.id === "b1" ? (
        <HealthAssessment
          label="Facility dwell"
          variant="default"
          observation={{ value: 6, unit: "hours" }}
          health={{ assessment: "healthy", label: "As expected" }}
          reference={
            <DurationReferenceExample
              value={6}
              currentAssessment="healthy"
              regions={[
                { from: 0, to: 10, assessment: "healthy", label: "As expected", shortLabel: "Expected" },
                { from: 10, to: 20, assessment: "degraded", label: "Needs attention", shortLabel: "Attention" },
                { from: 20, to: Infinity, assessment: "unhealthy", label: "Outside expectations", shortLabel: "Outside" },
              ]}
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
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(160px, 1fr)", gap: 20, maxWidth: 760 }}>
      <EventTimeline events={events} selectedId={selectedId} onSelectedIdChange={setSelectedId} onLocationSelect={(id) => setLocationId(id)} />
      <div>
        <h3>Selection bridge</h3>
        <p>Selected event: {selectedId ?? "none"}</p>
        <p>Focused location: {locationId ?? "none"}</p>
        <button type="button" onClick={() => setSelectedId("b2")}>Select conflicting observation</button>
      </div>
    </div>
  );
}
export const ControlledMapCoordination: Story = { render: () => <CoordinatedExample /> };
