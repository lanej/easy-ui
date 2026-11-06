import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import ApartmentIcon from "@easypost/easy-ui-icons/Apartment";
import LocalPostOfficeIcon from "@easypost/easy-ui-icons/LocalPostOffice";
import { EventTimeline, type EventTimelineProps } from "./EventTimeline";
import type { EventTimelineEvent } from "./EventItem";
import type { EventTimelineConnection } from "./connectionGraph";
import { EventMetrics } from "../EventMetrics";
import { createExampleEventMetrics } from "../EventMetrics/EventMetrics.examples";
import { HealthAssessment } from "../HealthAssessment";
import { Icon } from "../Icon";
import { Button } from "../Button";
import { Pill } from "../Pill";
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

/** Event type, location, and risk have independent presentation roles. */
export const Ledger: Story = {
  render: (args) => (
    <div className={styles.ledgerExample}>
      <EventTimeline {...args} />
    </div>
  ),
  args: {
    variant: "ledger",
    size: "compact",
    selectedId: undefined,
    defaultSelectedId: "delivery-a",
    events: [
      { ...events[0], timeLabel: "Oct 22 · 09:42 UTC" },
      { ...events[2], label: "In transit", timeLabel: "Oct 23 · 17:06 UTC" },
      {
        ...events[3],
        id: "out-for-delivery",
        label: "Out for delivery",
        timeLabel: "Oct 24 · 08:14 UTC",
      },
      {
        ...events[3],
        id: "delivery-a",
        label: "Delivered",
        timeLabel: "Oct 24 · 11:26 UTC",
        detailLabel: "Received at 11:27 UTC · Source A",
      },
      {
        ...events[0],
        id: "delivery-b",
        label: "Delivered",
        timeLabel: "Oct 24 · 11:26 UTC",
        detailLabel: "Received at 11:41 UTC · Source B",
      },
    ],
    renderTrailing: (event) =>
      event.id === "delivery-a" || event.id === "delivery-b" ? (
        <Pill tone="danger" size="xs">
          High risk
        </Pill>
      ) : (
        <Pill size="xs">Not assessed</Pill>
      ),
  },
};

export const LedgerFullTimestamps: Story = {
  ...Ledger,
  args: {
    ...Ledger.args,
    size: "detailed",
    events: [
      {
        ...events[2],
        timeLabel: "2026-10-23 17:06:00 UTC",
        receivedTimeLabel: "2026-10-23 17:14:00 UTC",
      },
      {
        ...events[3],
        timeLabel: "2026-10-23 17:06:00 UTC",
        receivedTimeLabel: "2026-10-23 18:21:00 UTC",
      },
      events[4],
    ],
  },
};

const branchingEvents: EventTimelineEvent[] = [
  {
    id: "accepted",
    label: "Accepted",
    locationLabel: "Oakland, CA",
    timeLabel: "Oct 22 · 06:00 UTC",
    pathIds: ["north", "east"],
  },
  {
    id: "shared",
    label: "In transit",
    locationLabel: "Sacramento, CA",
    timeLabel: "Oct 22 · 08:00 UTC",
    pathIds: ["north", "east"],
  },
  {
    id: "other-origin",
    label: "Accepted",
    locationLabel: "San Diego, CA",
    timeLabel: "Oct 22 · 08:30 UTC",
    pathIds: ["south"],
  },
  {
    id: "north-local",
    label: "Out for delivery",
    locationLabel: "Portland, OR",
    timeLabel: "Oct 23 · 08:00 UTC",
    pathIds: ["north"],
  },
  {
    id: "east-local",
    label: "Out for delivery",
    locationLabel: "Reno, NV",
    timeLabel: "Oct 23 · 08:05 UTC",
    pathIds: ["east"],
  },
  {
    id: "north-delivery",
    label: "Delivered",
    locationLabel: "Portland, OR",
    timeLabel: "Oct 23 · 11:00 UTC",
    pathIds: ["north"],
  },
  {
    id: "east-delivery",
    label: "Delivered",
    locationLabel: "Reno, NV",
    timeLabel: "Oct 23 · 11:15 UTC",
    pathIds: ["east"],
  },
  {
    id: "other-delivery",
    label: "Delivered",
    locationLabel: "El Cajon, CA",
    timeLabel: "Oct 23 · 12:00 UTC",
    pathIds: ["south"],
  },
  {
    id: "unassigned",
    label: "Delivered",
    locationLabel: "Spokane, WA",
    timeLabel: "Oct 23 · 12:15 UTC",
    detailLabel: "No candidate history supplied",
  },
];

const branchingConnections: EventTimelineConnection[] = [
  {
    id: "shared-link",
    fromEventId: "accepted",
    toEventId: "shared",
    pathIds: ["north", "east"],
  },
  {
    id: "north-link",
    fromEventId: "shared",
    toEventId: "north-local",
    pathIds: ["north"],
  },
  {
    id: "east-link",
    fromEventId: "shared",
    toEventId: "east-local",
    pathIds: ["east"],
  },
  {
    id: "north-delivered",
    fromEventId: "north-local",
    toEventId: "north-delivery",
    pathIds: ["north"],
  },
  {
    id: "east-delivered",
    fromEventId: "east-local",
    toEventId: "east-delivery",
    pathIds: ["east"],
  },
  {
    id: "separate-origin",
    fromEventId: "other-origin",
    toEventId: "other-delivery",
    pathIds: ["south"],
  },
];

function BranchingLedgerExample(args: EventTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>("east-delivery");
  return (
    <div className={styles.ledgerExample}>
      {args.pathColors && (
        <div className={styles.pathLegend} aria-label="Candidate colors">
          {Object.entries(args.pathColors).map(([pathId, color]) => (
            <span key={pathId}>
              <span
                className={styles.pathSwatch}
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              {pathId}
            </span>
          ))}
        </div>
      )}
      <EventTimeline
        {...args}
        variant="ledger"
        events={branchingEvents}
        connections={branchingConnections}
        selectedId={selectedId}
        onSelectedIdChange={setSelectedId}
        selectedConnectionIds={branchingConnections
          .filter(
            (connection) =>
              connection.fromEventId === selectedId ||
              connection.toEventId === selectedId,
          )
          .map((connection) => connection.id)}
        renderTrailing={(event) =>
          event.id === "north-delivery" || event.id === "east-delivery" ? (
            <Pill tone="danger" size="xs">
              High risk
            </Pill>
          ) : event.id === "unassigned" ? (
            <Pill size="xs">Not assessed</Pill>
          ) : null
        }
      />
    </div>
  );
}

/** Shared observations branch only through supplied links; other roots remain separate. */
export const BranchingLedger: Story = {
  render: (args) => <BranchingLedgerExample {...args} />,
  args: { variant: "ledger", size: "compact" },
};

/** Stable candidate colors survive selection; shared observations stay canonical. */
export const ColoredBranchingLedger: Story = {
  ...BranchingLedger,
  args: {
    ...BranchingLedger.args,
    pathColors: { north: "#2563eb", east: "#8b5cf6", south: "#0d9488" },
  },
};

/** Full caller-owned evidence stays intact at narrow and wide widths. */
export const FullTimestamps: Story = {
  render: (args) => <EventTimeline {...args} selectedId={undefined} />,
  args: {
    selectedId: undefined,
    size: "detailed",
    events: events.slice(0, 3).map((event, index) => ({
      ...event,
      timeLabel: `2026-10-16 ${["09:42:00", "13:18:00", "17:06:00"][index]} UTC`,
      receivedTimeLabel: `2026-10-16 ${["09:43:00", "13:20:00", "17:14:00"][index]} UTC`,
    })),
  },
};

export const FullTimestampsInline: Story = {
  render: FullTimestamps.render,
  args: { ...FullTimestamps.args, metricsPlacement: "inline" },
};

export const FullTimestampsCompact: Story = {
  render: FullTimestamps.render,
  args: {
    ...FullTimestamps.args,
    size: "compact",
    renderTrailing: () => <span>6 h</span>,
  },
};

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
        metricsPlacement={variant === "minimal" ? "inline" : "below"}
        renderMetrics={renderMetrics(variant)}
      />
    </div>
  );
}

export const MinimalMetrics: Story = {
  render: () => <MetricsExample variant="minimal" />,
};

export const TrailingSummary: Story = {
  args: { size: "compact", renderTrailing: () => <span>6 h</span> },
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
          description:
            "Event, facility, and metric pills share one wrapping flow.",
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
