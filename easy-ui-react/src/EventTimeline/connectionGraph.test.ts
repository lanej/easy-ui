import {
  connectionGraphEdgePath,
  getConnectionGraphLayout,
  type EventTimelineConnection,
} from "./connectionGraph";

const observations = (...ids: string[]) => ids.map((id) => ({ id }));
const connection = (
  fromEventId: string,
  toEventId: string,
  id = `${fromEventId}-${toEventId}`,
): EventTimelineConnection => ({ id, fromEventId, toEventId });

describe("getConnectionGraphLayout", () => {
  it("does not infer connections from adjacent observations or shared candidate membership", () => {
    const events = [
      { id: "origin", pathIds: ["candidate"] },
      { id: "return", pathIds: ["candidate"] },
      { id: "delivery", pathIds: ["candidate"] },
    ];
    const layout = getConnectionGraphLayout(events, []);
    expect(layout.edges).toEqual([]);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.nodes.every((node) => node.incomingCount === 0)).toBe(true);
  });

  it("keeps two interleaved, disjoint origin and delivery pairs on separate rails", () => {
    const layout = getConnectionGraphLayout(
      observations("origin-a", "origin-b", "delivery-a", "delivery-b"),
      [
        connection("origin-a", "delivery-a"),
        connection("origin-b", "delivery-b"),
      ],
    );
    expect(layout.nodes.map((node) => node.lane)).toEqual([0, 1, 0, 1]);
    expect(layout.edges.map((edge) => edge.lane)).toEqual([0, 1]);
    expect(layout.nodes.map((node) => node.incomingCount)).toEqual([
      0, 0, 1, 1,
    ]);
  });

  it("joins only a supplied shared event and retains distinct revisit observations", () => {
    const events = observations(
      "origin",
      "visit-1",
      "alternate",
      "shared",
      "visit-2",
    );
    const layout = getConnectionGraphLayout(events, [
      connection("origin", "visit-1"),
      connection("origin", "alternate"),
      connection("visit-1", "shared"),
      connection("alternate", "shared"),
      connection("shared", "visit-2"),
    ]);
    expect(layout.nodes.map((node) => node.eventId)).toEqual(
      events.map((event) => event.id),
    );
    expect(layout.nodes[0].outgoingCount).toBe(2);
    expect(layout.nodes[3].incomingCount).toBe(2);
    const sharedEdges = layout.edges.filter(
      (edge) => edge.connection.toEventId === "shared",
    );
    expect(new Set(sharedEdges.map((edge) => edge.toLane)).size).toBe(1);
    expect(layout.nodes[4].incomingCount).toBe(1);
  });

  it("does not place an unrelated event on a relationship passing its row", () => {
    const layout = getConnectionGraphLayout(
      observations("a", "unassigned", "b"),
      [connection("a", "b")],
    );
    expect(layout.nodes[1].lane).not.toBe(layout.edges[0].lane);
    expect(layout.nodes[1].incomingCount).toBe(0);
    expect(layout.nodes[1].outgoingCount).toBe(0);
  });

  it("retains backward and self relationships without reversing them", () => {
    const links = [connection("last", "first"), connection("first", "first")];
    const layout = getConnectionGraphLayout(
      observations("first", "last"),
      links,
    );
    expect(layout.edges).toEqual([]);
    expect(layout.omitted).toEqual([
      { connection: links[0], reason: "backward" },
      { connection: links[1], reason: "self" },
    ]);
  });

  it("does not bridge an endpoint removed by filtering", () => {
    const links = [connection("a", "b"), connection("b", "c")];
    const layout = getConnectionGraphLayout(observations("a", "c"), links);
    expect(layout.edges).toEqual([]);
    expect(layout.omitted.map((item) => item.reason)).toEqual([
      "missing-endpoint",
      "missing-endpoint",
    ]);
  });

  it("routes deterministically without using the connection array's order", () => {
    const events = observations("a", "b", "c", "d");
    const links = [
      connection("a", "b"),
      connection("a", "c"),
      connection("b", "d"),
      connection("c", "d"),
    ];
    const first = getConnectionGraphLayout(events, links);
    const second = getConnectionGraphLayout(events, links.slice().reverse());
    expect(first.nodes).toEqual(second.nodes);
    expect(first.edges).toEqual(second.edges);
  });

  it("never lets a live edge occupy a different event's node in a branching graph", () => {
    const layout = getConnectionGraphLayout(
      observations("a", "b", "c", "d", "e", "f"),
      [
        connection("a", "d"),
        connection("a", "c"),
        connection("b", "e"),
        connection("c", "f"),
        connection("d", "f"),
      ],
    );
    expect(layout.isFallback).toBe(false);
    for (const edge of layout.edges) {
      for (const node of layout.nodes) {
        if (node.rowIndex > edge.fromIndex && node.rowIndex < edge.toIndex) {
          expect(node.lane).not.toBe(edge.lane);
        }
      }
    }
  });

  it("bounds four simultaneous lanes and uses a complete list for a fifth", () => {
    const events = observations("o1", "o2", "o3", "o4", "d1", "d2", "d3", "d4");
    const links = [1, 2, 3, 4].map((index) =>
      connection(`o${index}`, `d${index}`),
    );
    const four = getConnectionGraphLayout(events, links);
    expect(four.isFallback).toBe(false);
    expect(four.width).toBe(72);
    const five = getConnectionGraphLayout(
      observations("o1", "o2", "o3", "o4", "o5", "d1", "d2", "d3", "d4", "d5"),
      [...links, connection("o5", "d5")],
    );
    expect(five.isFallback).toBe(true);
    expect(five.width).toBe(0);
    expect(five.nodes).toEqual([]);
    expect(five.edges).toEqual([]);
    expect(five.omitted).toHaveLength(5);
    expect(five.omitted.every((item) => item.reason === "lane-limit")).toBe(
      true,
    );
  });

  it("also falls back when an unrelated node cannot fit beside four active rails", () => {
    const layout = getConnectionGraphLayout(
      observations("a", "b", "c", "d", "isolated", "e", "f", "g", "h"),
      [
        connection("a", "e"),
        connection("b", "f"),
        connection("c", "g"),
        connection("d", "h"),
      ],
    );
    expect(layout.isFallback).toBe(true);
    expect(layout.edges).toEqual([]);
  });
});

describe("connectionGraphEdgePath", () => {
  it("uses actual variable row centers rather than assumed equal row heights", () => {
    const layout = getConnectionGraphLayout(observations("a", "b", "c"), [
      connection("a", "c"),
    ]);
    const centers = new Map([
      [0, 18],
      [1, 88],
      [2, 264],
    ]);
    expect(connectionGraphEdgePath(layout.edges[0], centers)).toBe(
      "M 12 18 L 12 264",
    );
    centers.set(2, 391);
    expect(connectionGraphEdgePath(layout.edges[0], centers)).toBe(
      "M 12 18 L 12 391",
    );
  });

  it("never draws missing, non-finite, or reversed measured endpoints", () => {
    const [edge] = getConnectionGraphLayout(observations("a", "b"), [
      connection("a", "b"),
    ]).edges;
    expect(connectionGraphEdgePath(edge, new Map([[0, 20]]))).toBeNull();
    expect(
      connectionGraphEdgePath(
        edge,
        new Map([
          [0, 20],
          [1, NaN],
        ]),
      ),
    ).toBeNull();
    expect(
      connectionGraphEdgePath(
        edge,
        new Map([
          [0, 50],
          [1, 20],
        ]),
      ),
    ).toBeNull();
  });
});
