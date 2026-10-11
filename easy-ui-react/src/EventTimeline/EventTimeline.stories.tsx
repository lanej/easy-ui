import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import ApartmentIcon from "@easypost/easy-ui-icons/Apartment";
import LocalPostOfficeIcon from "@easypost/easy-ui-icons/LocalPostOffice";
import { EventTimeline } from "./EventTimeline";
import type { EventTimelineEvent } from "./EventItem";
import { EventMetrics } from "../EventMetrics";
import { createExampleEventMetrics } from "../EventMetrics/EventMetrics.examples";
import { HealthAssessment } from "../HealthAssessment";
import { Icon } from "../Icon";
import { Button } from "../Button";
import styles from "./EventTimeline.examples.module.scss";

const events: EventTimelineEvent[] = [
  {
    id: "a1",
    label: "Accepted",
    timeLabel: "09:42",
    locationLabel: "Oakland, CA",
    locationTypeLabel: "Origin facility",
    locationIcon: <Icon symbol={LocalPostOfficeIcon} size="sm" />,
    locationId: "oakland",
    tone: "neutral",
  },
  {
    id: "a2",
    label: "Departed",
    timeLabel: "13:18",
    locationLabel: "Oakland, CA",
    locationTypeLabel: "Origin facility",
    locationIcon: <Icon symbol={LocalPostOfficeIcon} size="sm" />,
    locationId: "oakland",
    tone: "neutral",
  },
  {
    id: "b1",
    label: "Arrived",
    timeLabel: "17:06",
    receivedTimeLabel: "17:14",
    locationLabel: "Sacramento, CA",
    locationTypeLabel: "Regional hub",
    locationIcon: <Icon symbol={ApartmentIcon} size="sm" />,
    locationId: "sacramento",
    tone: "neutral",
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
    locationIcon: <Icon symbol={ApartmentIcon} size="sm" />,
    locationId: "reno",
    tone: "neutral",
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
type MetricVariant = "minimal" | "compact" | "expanded";

export const Default: Story = {};
export const Compact: Story = { args: { size: "compact" } };
export const Detailed: Story = { args: { size: "detailed" } };
export const MissingData: Story = {
  args: { events: [events[2], events[3], events[4]], selectedId: "b2" },
};
export const Empty: Story = { args: { events: [], selectedId: null } };

/** An actual following interval remains a separate, caller-owned composition. */
export const WithIntervalAssessment: Story = {
  args: {
    renderInterval: (event) =>
      event.id === "b1" ? (
        <HealthAssessment
          variant="compact"
          label="Facility dwell"
          observation={{ value: 6, unit: "hours" }}
          health={{ assessment: "healthy", label: "Within expectations" }}
        />
      ) : null,
  },
};

function renderMetrics(variant: MetricVariant) {
  return function MetricContent(event: EventTimelineEvent) {
    return event.id === "b1" ? (
      <EventMetrics
        variant={variant}
        metrics={createExampleEventMetrics(variant)}
        ariaLabel="Sacramento facility observations"
      />
    ) : null;
  };
}

function MetricsExample({
  variant,
  width = 420,
  singleEvent = false,
}: {
  variant: MetricVariant;
  width?: number;
  singleEvent?: boolean;
}) {
  return (
    <div className={styles.singleExample} style={{ width }}>
      <EventTimeline
        events={singleEvent ? [events[2]] : events.slice(1, 4)}
        defaultSelectedId="b1"
        size={variant === "minimal" ? "compact" : "default"}
        renderTrailing={
          variant === "minimal" ? renderMetrics(variant) : undefined
        }
        renderMetrics={
          variant === "minimal" ? undefined : renderMetrics(variant)
        }
      />
    </div>
  );
}

export const MinimalMetrics: Story = {
  render: () => <MetricsExample variant="minimal" />,
};

export const CompactMetrics: Story = {
  render: () => <MetricsExample variant="compact" />,
};

export const ExpandedMetrics: Story = {
  render: () => <MetricsExample variant="expanded" />,
};

/** The three presentations use the same observations at the same narrow width. */
export const PresentationModes: Story = {
  render: () => (
    <div className={styles.comparison}>
      <div className={styles.introduction}>
        <h2>One event, independent observations</h2>
        <p>
          Synthetic examples · 420px timeline · Dwell time and exception rate
        </p>
      </div>
      {[
        {
          variant: "minimal" as const,
          title: "Minimal",
          description: "Both labeled metric pills stay in the event row.",
        },
        {
          variant: "compact" as const,
          title: "Compact",
          description:
            "Each labeled pill stays beside its concentration reference.",
        },
        {
          variant: "expanded" as const,
          title: "Expanded",
          description: "The same labeled pills, with larger distributions.",
        },
      ].map(({ variant, title, description }) => (
        <section className={styles.presentation} key={variant}>
          <div className={styles.presentationHeading}>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <MetricsExample variant={variant} singleEvent />
        </section>
      ))}
    </div>
  ),
};

export const Narrow: Story = {
  render: () => <MetricsExample variant="compact" width={360} />,
};

function CoordinatedExample() {
  const [selectedId, setSelectedId] = useState<string | null>("b1");
  const [locationId, setLocationId] = useState<string | null>("sacramento");
  return (
    <div className={styles.coordinated}>
      <EventTimeline
        events={events}
        selectedId={selectedId}
        onSelectedIdChange={setSelectedId}
        onLocationSelect={(id) => setLocationId(id)}
        renderMetrics={renderMetrics("compact")}
      />
      <div className={styles.selectionPanel}>
        <h3>Selection bridge</h3>
        <p>Selected event: {selectedId ?? "none"}</p>
        <p>Focused location: {locationId ?? "none"}</p>
        <Button
          size="sm"
          variant="outlined"
          onPress={() => setSelectedId("b2")}
        >
          Select conflicting observation
        </Button>
      </div>
    </div>
  );
}
export const ControlledMapCoordination: Story = {
  render: () => <CoordinatedExample />,
};

/** The map remains application-owned; the timeline fits its allotted column. */
function MapAdjacentExample() {
  const [selectedId, setSelectedId] = useState<string | null>("b1");
  const [locationId, setLocationId] = useState<string | null>("sacramento");
  return (
    <div className={styles.mapAdjacent}>
      <section className={styles.mapColumn}>
        <h3>Events · 420px column</h3>
        <EventTimeline
          events={events}
          selectedId={selectedId}
          onSelectedIdChange={setSelectedId}
          onLocationSelect={(id) => setLocationId(id)}
          renderMetrics={renderMetrics("compact")}
        />
      </section>
      <aside
        className={styles.mapSurface}
        aria-label="Adjacent application-owned map surface"
      >
        <h3>Map integration space</h3>
        <p>Selected event: {selectedId ?? "none"}</p>
        <p>Map focus: {locationId ?? "none"}</p>
        <p>
          This space represents the consuming application&apos;s map. Select an
          event or its location to inspect the independent callbacks.
        </p>
      </aside>
    </div>
  );
}
export const MapAdjacent: Story = { render: () => <MapAdjacentExample /> };
