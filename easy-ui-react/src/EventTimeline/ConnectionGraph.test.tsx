import React, { useRef } from "react";
import { act, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { ConnectionGraph } from "./ConnectionGraph";
import type { EventTimelineConnection } from "./connectionGraph";

const events = [
  { id: "a", label: "Accepted", locationLabel: "Ludington" },
  { id: "b", label: "Arrived", locationLabel: "Hammond" },
  { id: "c", label: "Delivered", locationLabel: "Oakland" },
];
const forward: EventTimelineConnection[] = [
  { id: "a-c", fromEventId: "a", toEventId: "c" },
];
const uncoloredPalettes: (Readonly<Record<string, string>> | undefined)[] = [
  undefined,
  {},
  { unrelated: "#8250c4" },
];

function Harness({
  observations = events,
  connections = forward,
  selectedConnectionIds,
  pathColors,
  anchorVersion = 0,
}: {
  observations?: readonly {
    id: string;
    label: string;
    locationLabel?: string;
    pathIds?: readonly string[];
  }[];
  connections?: readonly EventTimelineConnection[];
  selectedConnectionIds?: readonly string[];
  pathColors?: Readonly<Record<string, string>>;
  anchorVersion?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowElements = useRef(new Map<string, HTMLElement>());
  return (
    <div ref={rootRef} data-test-root>
      <ol>
        {observations.map((event) => (
          <li key={event.id}>
            <button
              key={anchorVersion}
              type="button"
              data-row={event.id}
              ref={(node) => {
                if (node) rowElements.current.set(event.id, node);
                else rowElements.current.delete(event.id);
              }}
            >
              {event.label}
            </button>
          </li>
        ))}
      </ol>
      <ConnectionGraph
        events={observations}
        connections={connections}
        selectedConnectionIds={selectedConnectionIds}
        pathColors={pathColors}
        rowElements={rowElements.current}
        rootRef={rootRef}
      />
    </div>
  );
}

describe("ConnectionGraph", () => {
  let centers: Map<string, number>;
  let resize: ResizeObserverCallback;
  let observed: Element[];
  const disconnect = vi.fn();

  beforeEach(() => {
    centers = new Map([
      ["a", 24],
      ["b", 88],
      ["c", 240],
    ]);
    observed = [];
    disconnect.mockClear();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.hasAttribute("data-test-root")) {
          return new DOMRect(0, 100, 320, 400);
        }
        const center = centers.get(this.dataset.row ?? "");
        return center === undefined
          ? new DOMRect()
          : new DOMRect(40, 100 + center - 10, 200, 20);
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("measures real event anchors on mount and after variable-height rows change", () => {
    const { container, unmount } = render(<Harness />);
    const graph = container.querySelector("[data-connection-graph]");
    expect(graph).not.toBeNull();
    expect(graph).toHaveAttribute("aria-hidden", "true");
    expect(graph?.querySelector('circle[data-event-id="a"]')).toHaveAttribute(
      "cy",
      "24",
    );
    expect(graph?.querySelector('circle[data-event-id="c"]')).toHaveAttribute(
      "cy",
      "240",
    );
    expect(
      new Set(observed.filter((element) => element.tagName === "LI")).size,
    ).toBe(3);
    act(() => {
      centers.set("c", 367);
      resize([], {} as ResizeObserver);
    });
    expect(graph?.querySelector('circle[data-event-id="c"]')).toHaveAttribute(
      "cy",
      "367",
    );
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("refreshes replaced native anchors when the same event array changes layout", () => {
    const { container, rerender } = render(<Harness />);
    const originalButtons = screen.getAllByRole("button");
    centers.set("a", 36);
    centers.set("c", 316);
    rerender(<Harness anchorVersion={1} />);

    const currentButtons = screen.getAllByRole("button");
    expect(currentButtons[0]).not.toBe(originalButtons[0]);
    expect(originalButtons[0]).not.toBeInTheDocument();
    expect(
      container.querySelector('circle[data-event-id="a"]'),
    ).toHaveAttribute("cy", "36");
    expect(
      container.querySelector('circle[data-event-id="c"]'),
    ).toHaveAttribute("cy", "316");
    for (const button of currentButtons) expect(observed).toContain(button);

    // An unchanged measurement must settle without another commit and
    // observer subscription, including its initial resize notification.
    const observedCount = observed.length;
    act(() => resize([], {} as ResizeObserver));
    expect(observed).toHaveLength(observedCount);
  });

  it("accents only selected explicit relationships and keeps event selection controls unchanged", () => {
    const { container } = render(<Harness selectedConnectionIds={["a-c"]} />);
    expect(
      container.querySelector('[data-connection-id="a-c"]'),
    ).toHaveAttribute("data-selected", "true");
    expect(
      container.querySelector('circle[data-event-id="b"]'),
    ).not.toHaveAttribute("data-selected");
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText("1 candidate relationship")).toBeInTheDocument();
  });

  it("keeps supplied path colors stable through selection and color changes without rerouting", () => {
    const observations = events.map((event) => ({ ...event, pathIds: ["A"] }));
    const connections = [{ ...forward[0], pathIds: ["A"] }];
    const { container, rerender } = render(
      <Harness
        observations={observations}
        connections={connections}
        pathColors={{ A: "#2457cc" }}
      />,
    );
    const edge = container.querySelector('[data-connection-id="a-c"]')!;
    const rail = edge.querySelector('[data-path-id="A"]')!;
    const geometry = rail.getAttribute("d");
    expect(rail).toHaveAttribute("data-path-color", "#2457cc");
    expect(rail.getAttribute("style")).toContain(
      "--connection-path-color: #2457cc",
    );
    expect(rail).not.toHaveAttribute("stroke-dasharray");
    expect(
      container.querySelector('circle[data-event-id="a"]'),
    ).toHaveAttribute("data-path-color", "#2457cc");
    rerender(
      <Harness
        observations={observations}
        connections={connections}
        pathColors={{ A: "#2457cc" }}
        selectedConnectionIds={["a-c"]}
      />,
    );
    expect(edge).toHaveAttribute("data-selected", "true");
    expect(rail).toHaveAttribute("data-path-color", "#2457cc");
    expect(rail).toHaveAttribute("d", geometry);
    rerender(
      <Harness
        observations={observations}
        connections={connections}
        pathColors={{ A: "#8ba7ff" }}
        selectedConnectionIds={["a-c"]}
      />,
    );
    expect(rail).toHaveAttribute("data-path-color", "#8ba7ff");
    expect(rail).toHaveAttribute("d", geometry);
    expect(screen.getAllByRole("button")).toHaveLength(events.length);
  });

  it("paints every shared membership on one canonical edge and retains one neutral shared node", () => {
    const observations = events.map((event) => ({
      ...event,
      pathIds: ["A", "B"],
    }));
    const connections = [{ ...forward[0], pathIds: ["A", "B"] }];
    const { container } = render(
      <Harness
        observations={observations}
        connections={connections}
        pathColors={{ A: "#2457cc", B: "#8250c4" }}
        selectedConnectionIds={["a-c"]}
      />,
    );
    expect(container.querySelectorAll("[data-connection-id]")).toHaveLength(1);
    expect(container.querySelectorAll("circle[data-event-id]")).toHaveLength(
      events.length,
    );
    const edge = container.querySelector('[data-connection-id="a-c"]')!;
    expect(edge).toHaveAttribute("data-shared", "true");
    const rails = edge.querySelectorAll("[data-path-id]");
    expect(rails).toHaveLength(2);
    expect(rails[0]).toHaveAttribute("data-path-color", "#2457cc");
    expect(rails[1]).toHaveAttribute("data-path-color", "#8250c4");
    expect(rails[0].getAttribute("d")).toBe(rails[1].getAttribute("d"));
    expect(rails[0]).toHaveAttribute("stroke-dasharray", "6 6");
    expect(rails[1]).toHaveAttribute("stroke-dasharray", "6 6");
    expect(rails[0]).toHaveAttribute("stroke-dashoffset", "0");
    expect(rails[1]).toHaveAttribute("stroke-dashoffset", "-6");
    const shared = container.querySelector('circle[data-event-id="a"]')!;
    expect(shared).toHaveAttribute("data-shared", "true");
    expect(shared).not.toHaveAttribute("data-path-color");
    expect(screen.getByText("Candidate memberships: A, B")).toBeInTheDocument();
  });

  it("retains unmapped shared slices and never infers a node's membership from incident edges", () => {
    const observations = [
      { ...events[0], pathIds: ["A", "B"] },
      events[1],
      events[2],
    ];
    const connections = [{ ...forward[0], pathIds: ["A", "A", "B"] }];
    const { container } = render(
      <Harness
        observations={observations}
        connections={connections}
        pathColors={{ A: "#2457cc" }}
      />,
    );
    const edge = container.querySelector('[data-connection-id="a-c"]')!;
    expect(edge.querySelectorAll("[data-path-id]")).toHaveLength(2);
    expect(edge.querySelector('[data-path-id="B"]')).not.toHaveAttribute(
      "data-path-color",
    );
    expect(edge.querySelector('[data-path-id="B"]')).toHaveAttribute(
      "stroke-dasharray",
      "6 6",
    );
    expect(
      container.querySelector('circle[data-event-id="a"]'),
    ).toHaveAttribute("data-shared", "true");
    expect(
      container.querySelector('circle[data-event-id="c"]'),
    ).not.toHaveAttribute("data-path-color");
    expect(
      container.querySelector('circle[data-event-id="c"]'),
    ).not.toHaveAttribute("data-path-id");
  });

  it.each(uncoloredPalettes)(
    "retains the original continuous rail when no membership resolves a supplied color (%s)",
    (pathColors) => {
      const { container } = render(
        <Harness
          connections={[{ ...forward[0], pathIds: ["A", "B"] }]}
          pathColors={pathColors}
          selectedConnectionIds={["a-c"]}
        />,
      );
      const edge = container.querySelector('[data-connection-id="a-c"]')!;
      expect(edge).toHaveAttribute("data-selected", "true");
      expect(edge).not.toHaveAttribute("data-colored");
      expect(edge).not.toHaveAttribute("data-shared");
      // One casing and the original one continuous rail.
      expect(edge.querySelectorAll("path")).toHaveLength(2);
      expect(edge.querySelector("[stroke-dasharray]")).toBeNull();
      expect(edge.querySelector("[data-path-color]")).toBeNull();
    },
  );

  it("lists directed backward and self relationships visibly without drawing reversed edges", () => {
    const { container } = render(
      <Harness
        connections={[
          {
            id: "back",
            fromEventId: "c",
            toEventId: "a",
            label: "Source reconciliation",
          },
          { id: "self", fromEventId: "b", toEventId: "b" },
        ]}
      />,
    );
    expect(container.querySelector("details")).toHaveAttribute("open");
    expect(container.querySelector("[data-connection-id]")).toBeNull();
    expect(screen.getByText(/Points to an earlier row/)).toBeVisible();
    expect(screen.getByText(/Links this event to itself/)).toBeVisible();
    expect(screen.getByText("Source reconciliation")).toBeVisible();
    expect(
      screen.getByText(
        /Event 3: Delivered · Oakland → Event 1: Accepted · Ludington/,
      ),
    ).toBeVisible();
  });

  it("keeps removed endpoints explicit without drawing a replacement relationship", () => {
    const { rerender, container } = render(<Harness />);
    expect(
      container.querySelector('[data-connection-id="a-c"]'),
    ).not.toBeNull();
    rerender(<Harness observations={events.slice(0, 2)} />);
    expect(container.querySelector('[data-connection-id="a-c"]')).toBeNull();
    expect(screen.getByText(/Endpoint outside this view/)).toBeVisible();
    expect(screen.getByText(/Event c \(outside this view\)/)).toBeVisible();
  });

  it("shows every relationship in a bounded list when the graph would need five lanes", () => {
    const origins = [1, 2, 3, 4, 5].map((index) => ({
      id: `o${index}`,
      label: `Origin ${index}`,
    }));
    const deliveries = [1, 2, 3, 4, 5].map((index) => ({
      id: `d${index}`,
      label: `Delivery ${index}`,
    }));
    const links = origins.map((origin, index) => ({
      id: `edge-${index}`,
      fromEventId: origin.id,
      toEventId: deliveries[index].id,
    }));
    const { container } = render(
      <Harness
        observations={[...origins, ...deliveries]}
        connections={links}
      />,
    );
    expect(container.querySelector("[data-connection-graph]")).toBeNull();
    expect(container.querySelector("details")).toHaveAttribute(
      "data-connection-fallback",
      "true",
    );
    expect(
      within(
        screen.getByRole("list", { name: "Candidate relationships" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(5);
  });
});
