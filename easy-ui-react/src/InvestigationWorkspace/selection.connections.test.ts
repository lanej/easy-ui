import { investigationRecords as records } from "./InvestigationWorkspace.fixtures";
import {
  resolveSelection,
  type InvestigationRecords,
  type InvestigationConnection,
  type InvestigationSelection,
} from "./selection";

const connections: InvestigationConnection[] = [
  {
    id: "shared-link",
    fromEventId: "accepted",
    toEventId: "arrived",
    pathIds: ["north", "south"],
    segmentId: "shared-leg",
  },
  {
    id: "north-link",
    fromEventId: "arrived",
    toEventId: "north-scan",
    pathIds: ["north"],
    segmentId: "north-leg",
  },
  {
    id: "south-link",
    fromEventId: "arrived",
    toEventId: "south-scan",
    pathIds: ["south"],
    segmentId: "south-leg",
  },
  {
    id: "return-link",
    fromEventId: "north-scan",
    toEventId: "revisit",
    pathIds: ["north"],
  },
  {
    id: "no-path-membership",
    fromEventId: "arrived",
    toEventId: "duplicate",
    segmentId: "shared-leg",
  },
  {
    id: "independent-link",
    fromEventId: "other-origin",
    toEventId: "other-delivery",
    pathIds: ["independent"],
    segmentId: "independent-leg",
  },
];

const connectedRecords = {
  ...records,
  events: [
    ...records.events,
    {
      id: "revisit",
      label: "Returned to exchange",
      timeLabel: "18:00",
      locationId: "shared",
      locationLabel: "Central Exchange",
      pathIds: ["north"],
    },
    {
      id: "other-origin",
      label: "Accepted",
      timeLabel: "08:00",
      locationId: "unobserved",
      locationLabel: "West Annex",
      pathIds: ["independent"],
    },
    {
      id: "other-delivery",
      label: "Delivered",
      timeLabel: "19:00",
      locationId: "destination",
      locationLabel: "Destination",
      pathIds: ["independent"],
    },
    {
      id: "unassigned-delivery",
      label: "Delivered",
      timeLabel: "19:00",
      locationId: "destination",
      locationLabel: "Destination",
    },
  ],
  paths: [
    ...records.paths,
    {
      id: "independent",
      label: "Independent history",
      segmentIds: ["independent-leg"],
    },
  ],
  segments: [
    ...records.segments,
    {
      id: "independent-leg",
      from: "unobserved",
      to: "destination",
      label: "West Annex → Destination",
      evidence: "transfer",
    },
  ],
  connections,
} satisfies InvestigationRecords;

const ids = (items: readonly { id: string }[] | undefined) =>
  items?.map((item) => item.id);

describe("explicit investigation connections", () => {
  it("returns incoming and outgoing event links without extending them across its candidate histories", () => {
    const selected = resolveSelection(connectedRecords, {
      type: "event",
      eventId: "arrived",
    });
    expect(ids(selected.connections)).toEqual([
      "shared-link",
      "north-link",
      "south-link",
      "no-path-membership",
    ]);
    expect(ids(selected.paths)).toEqual(["north", "south"]);
    expect(selected.events).toBe(connectedRecords.events);
    expect(ids(selected.connections)).not.toContain("return-link");
    expect(ids(selected.connections)).not.toContain("independent-link");
  });

  it("uses only a connection's explicit path membership, including while stepping within that path", () => {
    const selected = resolveSelection(connectedRecords, {
      type: "path",
      pathId: "north",
      eventId: "revisit",
    });
    expect(ids(selected.connections)).toEqual([
      "shared-link",
      "north-link",
      "return-link",
    ]);
    // Both endpoints belong to north, but that does not assign the link itself.
    expect(ids(selected.events)).toContain("arrived");
    expect(ids(selected.events)).toContain("duplicate");
    expect(ids(selected.connections)).not.toContain("no-path-membership");
    expect(ids(selected.connections)).not.toContain("south-link");
    expect(selected.event?.id).toBe("revisit");
  });

  it("uses only explicit segmentId correspondence while retaining the existing candidate event scope", () => {
    const selected = resolveSelection(connectedRecords, {
      type: "segment",
      segmentId: "shared-leg",
    });
    expect(ids(selected.connections)).toEqual([
      "shared-link",
      "no-path-membership",
    ]);
    expect(ids(selected.paths)).toEqual(["north", "south"]);
    expect(ids(selected.events)).toContain("north-scan");
    expect(ids(selected.events)).toContain("south-scan");
    // Segment membership in a candidate never copies all of that candidate's event links.
    expect(ids(selected.connections)).not.toContain("north-link");
    expect(ids(selected.connections)).not.toContain("south-link");
    expect(ids(selected.connections)).not.toContain("return-link");
  });

  it("keeps visits and duplicate observations distinct while resolving every incident link at a location", () => {
    const selected = resolveSelection(connectedRecords, {
      type: "location",
      locationId: "shared",
      eventId: "revisit",
    });
    expect(ids(selected.events)).toEqual([
      "arrived",
      "duplicate",
      "untimed",
      "revisit",
    ]);
    expect(ids(selected.connections)).toEqual([
      "shared-link",
      "north-link",
      "south-link",
      "return-link",
      "no-path-membership",
    ]);
    expect(selected.event?.id).toBe("revisit");
    expect(ids(selected.connections)).not.toContain("independent-link");
  });

  it("does not join an unassigned delivery to an identical-looking delivery or to a disjoint history", () => {
    const independent = resolveSelection(connectedRecords, {
      type: "event",
      eventId: "other-delivery",
    });
    const unassigned = resolveSelection(connectedRecords, {
      type: "event",
      eventId: "unassigned-delivery",
    });
    expect(independent.event?.label).toBe(unassigned.event?.label);
    expect(independent.event?.timeLabel).toBe(unassigned.event?.timeLabel);
    expect(independent.event?.locationId).toBe(unassigned.event?.locationId);
    expect(ids(independent.connections)).toEqual(["independent-link"]);
    expect(ids(independent.paths)).toEqual(["independent"]);
    expect(unassigned.connections).toEqual([]);
    expect(unassigned.paths).toEqual([]);
    expect(unassigned.isAvailable).toBe(true);
  });

  it("does not invent adjacency for an untimed or unlinked event", () => {
    const selected = resolveSelection(connectedRecords, {
      type: "event",
      eventId: "untimed",
    });
    expect(selected.event?.locationId).toBe("shared");
    expect(selected.connections).toEqual([]);
    expect(selected.isAvailable).toBe(true);
  });

  it.each(["path", "segment", "location"] as const)(
    "clears relationship emphasis when the selected %s record was removed",
    (type) => {
      const selection: InvestigationSelection =
        type === "path"
          ? { type, pathId: "north" }
          : type === "segment"
            ? { type, segmentId: "shared-leg" }
            : { type, locationId: "shared" };
      const available = resolveSelection(connectedRecords, selection);
      expect(available.connections?.length).toBeGreaterThan(0);
      const withoutScope = {
        ...connectedRecords,
        ...(type === "path"
          ? {
              paths: connectedRecords.paths.filter(
                (path) => path.id !== "north",
              ),
            }
          : {}),
        ...(type === "segment"
          ? {
              segments: connectedRecords.segments.filter(
                (segment) => segment.id !== "shared-leg",
              ),
            }
          : {}),
        ...(type === "location"
          ? {
              locations: connectedRecords.locations.filter(
                (location) => location.id !== "shared",
              ),
            }
          : {}),
      };
      const unavailable = resolveSelection(withoutScope, selection);
      expect(unavailable.isAvailable).toBe(false);
      expect(unavailable.connections).toEqual([]);
      expect(unavailable.selection).toBe(selection);
    },
  );

  it("preserves the legacy event and candidate scope when connections are omitted", () => {
    const event = resolveSelection(records, {
      type: "event",
      eventId: "accepted",
    });
    expect(event.connections).toBeUndefined();
    expect(event.events).toBe(records.events);
    expect(ids(event.paths)).toEqual(["north", "south"]);
    const path = resolveSelection(records, { type: "path", pathId: "north" });
    expect(path.connections).toBeUndefined();
    expect(ids(path.events)).toEqual([
      "accepted",
      "arrived",
      "duplicate",
      "north-scan",
    ]);
    const explicitlyEmpty = resolveSelection(
      { ...records, connections: [] },
      { type: "event", eventId: "accepted" },
    );
    expect(explicitlyEmpty.connections).toEqual([]);
    expect(explicitlyEmpty.events).toBe(records.events);
    expect(explicitlyEmpty.paths).toEqual(event.paths);
  });
});
