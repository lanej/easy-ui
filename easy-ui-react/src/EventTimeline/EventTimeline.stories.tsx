import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { EventTimeline, type EventTimelineProps } from "./EventTimeline";
import type { EventTimelineEvent } from "./EventItem";
import { HealthIndicator } from "../HealthIndicator";
import { DurationValue } from "../DurationValue";

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
export const WithIntervalAssessment: Story = {
  args: {
    renderInterval: (event) =>
      event.id === "b1" ? (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 12, border: "1px solid #c6cfe0", borderRadius: 8 }}>
          <span>Facility dwell</span>
          <DurationValue value={6} unit="hours" />
          <HealthIndicator assessment="healthy" label="As expected" />
        </div>
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
