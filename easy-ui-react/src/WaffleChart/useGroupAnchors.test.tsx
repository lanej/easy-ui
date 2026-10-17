import React, { useRef } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { vi } from "vitest";
import type { WaffleChartGroupAnchor } from "./types";
import { useGroupAnchors } from "./useGroupAnchors";

const groupIds = ["north", "south"];
const initialRevision = {};

function Harness({
  ids = groupIds,
  onChange,
  revision = initialRevision,
  elementRevision = "initial",
}: {
  ids?: readonly string[];
  onChange?: (anchors: readonly WaffleChartGroupAnchor[]) => void;
  revision?: unknown;
  elementRevision?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  useGroupAnchors(root, elements, onChange, revision);
  return (
    <div data-testid="scroll-parent">
      <div ref={root} data-testid="root">
        {ids.map((id) => (
          <div
            key={`${id}:${elementRevision}`}
            data-testid={id}
            ref={(element) => {
              if (element) elements.current.set(id, element);
              else elements.current.delete(id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

type Observer = {
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

let observers: Observer[];
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let offset: number;
let cancelFrame: ReturnType<typeof vi.fn>;

function flushFrames() {
  act(() => {
    const queued = [...frames.entries()];
    frames.clear();
    for (const [, callback] of queued) callback(0);
  });
}

beforeEach(() => {
  observers = [];
  frames = new Map();
  nextFrame = 0;
  offset = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        observers.push({
          callback,
          observe: this.observe,
          unobserve: this.unobserve,
          disconnect: this.disconnect,
        });
      }
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    }),
  );
  cancelFrame = vi.fn((id: number) => frames.delete(id));
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const left = this.dataset.testid === "south" ? 160 : 20;
      const top = 40 + offset;
      return {
        x: left,
        y: top,
        left,
        top,
        right: left + 100,
        bottom: top + 60,
        width: 100,
        height: 60,
        toJSON: () => ({}),
      };
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("publishes initial viewport geometry and supported anchor elements for each supplied group", () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange).toHaveBeenLastCalledWith([
    {
      groupId: "north",
      element: screen.getByTestId("north"),
      bounds: {
        left: 20,
        top: 40,
        right: 120,
        bottom: 100,
        width: 100,
        height: 60,
      },
    },
    {
      groupId: "south",
      element: screen.getByTestId("south"),
      bounds: {
        left: 160,
        top: 40,
        right: 260,
        bottom: 100,
        width: 100,
        height: 60,
      },
    },
  ]);
  expect(observers).toHaveLength(1);
  expect(observers[0].observe.mock.calls.map(([element]) => element)).toEqual([
    screen.getByTestId("root"),
    screen.getByTestId("north"),
    screen.getByTestId("south"),
  ]);
});

it("coalesces resize and captured scroll updates and suppresses unchanged geometry", () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  offset = 35;
  act(() => observers[0].callback([], {} as ResizeObserver));
  fireEvent(window, new Event("resize"));
  fireEvent.scroll(screen.getByTestId("scroll-parent"));
  expect(frames.size).toBe(1);
  expect(onChange).toHaveBeenCalledOnce();
  flushFrames();
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(
    onChange.mock.lastCall![0].map(
      (anchor: WaffleChartGroupAnchor) => anchor.bounds.top,
    ),
  ).toEqual([75, 75]);
  act(() => observers[0].callback([], {} as ResizeObserver));
  flushFrames();
  expect(onChange).toHaveBeenCalledTimes(2);
  offset = -20;
  fireEvent.scroll(screen.getByTestId("scroll-parent"));
  flushFrames();
  expect(onChange).toHaveBeenCalledTimes(3);
  expect(onChange.mock.lastCall![0][0].bounds.top).toBe(20);
});

it("remeasures layout revisions and group removal without retaining stale anchor elements", () => {
  const onChange = vi.fn();
  const { rerender } = render(<Harness onChange={onChange} />);
  const retained = screen.getByTestId("north");
  offset = 80;
  rerender(<Harness onChange={onChange} revision="caller-layout-change" />);
  expect(
    onChange.mock.lastCall![0].map(
      (anchor: WaffleChartGroupAnchor) => anchor.bounds.top,
    ),
  ).toEqual([120, 120]);
  expect(observers).toHaveLength(1);
  expect(observers[0].disconnect).not.toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange.mock.calls.some(([anchors]) => !anchors.length)).toBe(false);
  rerender(
    <Harness
      ids={["north"]}
      onChange={onChange}
      revision="one-group-removed"
    />,
  );
  expect(screen.queryByTestId("south")).toBeNull();
  expect(onChange.mock.lastCall![0]).toEqual([
    {
      groupId: "north",
      element: retained,
      bounds: {
        left: 20,
        top: 120,
        right: 120,
        bottom: 180,
        width: 100,
        height: 60,
      },
    },
  ]);
  expect(observers).toHaveLength(1);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(
    observers[0].observe.mock.calls.slice(-2).map(([element]) => element),
  ).toEqual([screen.getByTestId("root"), retained]);
  expect(onChange).toHaveBeenCalledTimes(3);
  rerender(
    <Harness ids={[]} onChange={onChange} revision="all-groups-removed" />,
  );
  expect(onChange).toHaveBeenLastCalledWith([]);
  expect(onChange).toHaveBeenCalledTimes(4);
});

it("publishes replacement anchor elements even when their group IDs and geometry are unchanged", () => {
  const onChange = vi.fn();
  const { rerender } = render(<Harness onChange={onChange} />);
  const original = screen.getByTestId("north");
  const previousBounds = onChange.mock.lastCall![0][0].bounds;
  rerender(
    <Harness
      onChange={onChange}
      revision="replaced-elements"
      elementRevision="replacement"
    />,
  );
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("north")).not.toBe(original);
  expect(onChange.mock.lastCall![0][0].element).toBe(
    screen.getByTestId("north"),
  );
  expect(onChange.mock.lastCall![0][0].bounds).toEqual(previousBounds);
  expect(observers).toHaveLength(1);
});

it("uses the latest callback without observer teardown or redundant anchor publications", () => {
  const first = vi.fn();
  const latest = vi.fn();
  const { rerender } = render(<Harness onChange={first} />);
  expect(first).toHaveBeenCalledOnce();
  rerender(<Harness onChange={latest} />);
  expect(observers).toHaveLength(1);
  expect(observers[0].disconnect).not.toHaveBeenCalled();
  expect(first).toHaveBeenCalledOnce();
  expect(latest).not.toHaveBeenCalled();
  offset = 15;
  fireEvent(window, new Event("resize"));
  flushFrames();
  expect(first).toHaveBeenCalledOnce();
  expect(latest).toHaveBeenCalledOnce();
  expect(latest.mock.lastCall![0][0].bounds.top).toBe(55);
});

it.each(["disable", "unmount"])(
  "clears the latest defined subscriber after replacement followed by %s",
  (action) => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = render(<Harness onChange={first} />);
    rerender(<Harness onChange={latest} />);
    offset = 20;
    fireEvent(window, new Event("resize"));
    flushFrames();
    expect(latest).toHaveBeenCalledOnce();
    expect(latest.mock.lastCall![0]).toHaveLength(2);
    if (action === "disable") rerender(<Harness />);
    else unmount();
    expect(first).toHaveBeenCalledOnce();
    expect(latest).toHaveBeenCalledTimes(2);
    expect(latest).toHaveBeenLastCalledWith([]);
  },
);

it("cancels pending measurements, disconnects observers and clears anchors on cleanup", () => {
  const onChange = vi.fn();
  const removeListener = vi.spyOn(window, "removeEventListener");
  const { unmount } = render(<Harness onChange={onChange} />);
  offset = 25;
  fireEvent(window, new Event("resize"));
  const [frameId, queued] = [...frames.entries()][0];
  unmount();
  expect(cancelFrame).toHaveBeenCalledWith(frameId);
  expect(frames.size).toBe(0);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(removeListener).toHaveBeenCalledWith(
    "scroll",
    expect.any(Function),
    true,
  );
  expect(onChange.mock.calls).toHaveLength(2);
  expect(onChange).toHaveBeenLastCalledWith([]);
  act(() => queued(0));
  fireEvent(window, new Event("resize"));
  fireEvent.scroll(window);
  flushFrames();
  expect(onChange).toHaveBeenCalledTimes(2);
});

it("retains the pending animation-frame cancellation handle across a synchronous revision measurement", () => {
  const onChange = vi.fn();
  const { rerender, unmount } = render(<Harness onChange={onChange} />);
  offset = 25;
  fireEvent(window, new Event("resize"));
  const [frameId, queued] = [...frames.entries()][0];
  rerender(
    <Harness onChange={onChange} revision="data-changed-before-frame" />,
  );
  expect(onChange.mock.lastCall![0][0].bounds.top).toBe(65);
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(frames.size).toBe(1);
  unmount();
  expect(cancelFrame).toHaveBeenCalledWith(frameId);
  expect(frames.size).toBe(0);
  expect(onChange).toHaveBeenLastCalledWith([]);
  act(() => queued(0));
  expect(onChange).toHaveBeenCalledTimes(3);
});

it("supports window resize measurements without ResizeObserver and skips work without a subscriber", () => {
  const { rerender } = render(<Harness />);
  expect(observers).toHaveLength(0);
  expect(HTMLElement.prototype.getBoundingClientRect).not.toHaveBeenCalled();
  vi.stubGlobal("ResizeObserver", undefined);
  const onChange = vi.fn();
  rerender(<Harness onChange={onChange} />);
  expect(onChange).toHaveBeenCalledOnce();
  offset = 10;
  fireEvent(window, new Event("resize"));
  flushFrames();
  expect(onChange.mock.lastCall![0][0].bounds.top).toBe(50);
});
