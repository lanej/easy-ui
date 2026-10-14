import React, { useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { useDependencyGraphHeadings } from "./useDependencyGraphHeadings";

const clusters = [
  { group: { id: "runtime" }, x: 80, y: 240, width: 620, height: 160 },
];
let width = 140;
let scale = 1;
let resize: () => void;
let disconnected: ReturnType<typeof vi.fn>;
const rect = (x: number, y: number, w: number, h: number) =>
  ({
    x, y, left: x, top: y, right: x + w, bottom: y + h, width: w, height: h,
    toJSON: () => ({}),
  }) as DOMRect;

function Probe({ zoom = 1, visible = true, layout = clusters }: {
  zoom?: number;
  visible?: boolean;
  layout?: typeof clusters;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const obstacles = useDependencyGraphHeadings(viewport, layout, zoom, "ready");
  return (
    <div ref={viewport}>
      <div data-graph-scene>
        {visible && <div data-graph-group-heading="runtime">
          <button data-label>Runtime module</button>
          <button data-collapse>Collapse</button>
        </div>}
      </div>
      <output data-testid="obstacles">{JSON.stringify(obstacles)}</output>
    </div>
  );
}
const read = () => JSON.parse(screen.getByTestId("obstacles").textContent!);
beforeEach(() => {
  width = 140;
  scale = 1;
  disconnected = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnected;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.hasAttribute("data-graph-scene")) return rect(31, 47, 900 * scale, 600 * scale);
    if (this.hasAttribute("data-label")) return rect(31 + 96 * scale, 47 + 244 * scale, width * scale, 32 * scale);
    if (this.hasAttribute("data-collapse")) return rect(31 + 656 * scale, 47 + 244 * scale, 25 * scale, 25 * scale);
    return rect(0, 0, 0, 0);
  });
});
afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("reserves the actual controls, leaving an open routing corridor", () => {
  render(<Probe />);
  expect(read()).toEqual([
    { x: 96, y: 244, width: 140, height: 32 },
    { x: 656, y: 244, width: 25, height: 25 },
  ]);
});
it("remeasures resized labels without replacing the graph layout", () => {
  const { unmount } = render(<Probe />);
  width = 420;
  act(() => resize());
  expect(read()[0].width).toBe(420);
  expect(clusters[0]).toEqual({ group: { id: "runtime" }, x: 80, y: 240, width: 620, height: 160 });
  unmount();
  expect(disconnected).toHaveBeenCalled();
});
it("converts zoom and enlarged root text back into graph coordinates", () => {
  document.documentElement.style.fontSize = "20px";
  scale = 0.5;
  const { rerender } = render(<Probe zoom={0.4} />);
  expect(read()[0]).toEqual({ x: 96, y: 244, width: 140, height: 32 });
  scale = 1.25;
  rerender(<Probe zoom={1} />);
  expect(read()[0]).toEqual({ x: 96, y: 244, width: 140, height: 32 });
});
it("uses a conservative fallback only until a heading is measurable", () => {
  const { rerender } = render(<Probe visible={false} />);
  expect(read()).toEqual([{ x: 80, y: 240, width: 620, height: 36 }]);
  rerender(<Probe layout={[...clusters]} />);
  expect(read()).toHaveLength(2);
});
it("remeasures after group disclosure and removes stale obstacles", () => {
  const { rerender } = render(<Probe />);
  rerender(<Probe visible={false} layout={[]} />);
  expect(read()).toEqual([]);
  width = 250;
  rerender(<Probe layout={[...clusters]} />);
  expect(read()[0].width).toBe(250);
});
