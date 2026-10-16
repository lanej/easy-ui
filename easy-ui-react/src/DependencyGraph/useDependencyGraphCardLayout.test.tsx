import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useDependencyGraphCardLayout } from "./useDependencyGraphCardLayout";
import type { DependencyGraphCardLayouts } from "./types";
import type { GraphItem } from "./model";

const item: GraphItem = {
  key: "node:one",
  node: { id: "one", label: "One" },
  members: [],
  x: 100,
  y: 100,
  width: 300,
  height: 200,
};
function Probe({
  onChange,
  zoom = 1,
  controlled,
  enabled = true,
  visible = true,
}: {
  onChange: (value: DependencyGraphCardLayouts) => void;
  zoom?: number;
  controlled?: DependencyGraphCardLayouts;
  enabled?: boolean;
  visible?: boolean;
}) {
  const state = useDependencyGraphCardLayout({
    controlled,
    initial: {},
    onChange,
    enabled,
    zoom,
  });
  return (
    <div data-graph-canvas>
      {visible && <button {...state.handleProps(item, "move")}>Move</button>}
      {visible && (
        <button {...state.handleProps(item, "resize")}>Resize</button>
      )}
      <output data-testid="layout">{JSON.stringify(state.layouts)}</output>
    </div>
  );
}
const read = () => JSON.parse(screen.getByTestId("layout").textContent!);
beforeEach(() => {
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId = 1;
      isPrimary = true;
    },
  );
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const key of [
    "setPointerCapture",
    "hasPointerCapture",
    "releasePointerCapture",
  ])
    Reflect.deleteProperty(HTMLElement.prototype, key);
  document.documentElement.style.removeProperty("font-size");
});
it("accounts for a viewport origin shift during dragging", () => {
  const change = vi.fn();
  render(<Probe onChange={change} />);
  const move = screen.getByRole("button", { name: "Move" });
  fireEvent.pointerDown(move, { clientX: 100, clientY: 100, button: 0 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 80,
  } as DOMRect);
  fireEvent.pointerUp(move, { clientX: 150, clientY: 200 });
  expect(change).toHaveBeenLastCalledWith({ one: { x: 150, y: 120 } });
});
it("cancels a removed handle and allows a new drag after it returns", () => {
  const change = vi.fn();
  const { rerender } = render(<Probe onChange={change} />);
  const move = screen.getByRole("button", { name: "Move" });
  fireEvent.pointerDown(move, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerMove(move, { clientX: 150, clientY: 150 });
  rerender(<Probe onChange={change} visible={false} />);
  expect(read()).toEqual({});
  expect(change).not.toHaveBeenCalled();
  rerender(<Probe onChange={change} />);
  const next = screen.getByRole("button", { name: "Move" });
  fireEvent.pointerDown(next, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerUp(next, { clientX: 150, clientY: 150 });
  expect(change).toHaveBeenCalledExactlyOnceWith({ one: { x: 150, y: 150 } });
});
it("previews scaled movement but saves only once at release", () => {
  const change = vi.fn();
  document.documentElement.style.fontSize = "20px";
  render(<Probe onChange={change} zoom={2} />);
  const move = screen.getByRole("button", { name: "Move" });
  fireEvent.pointerDown(move, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerMove(move, { clientX: 150, clientY: 175 });
  expect(read()).toEqual({ one: { x: 120, y: 130 } });
  expect(change).not.toHaveBeenCalled();
  fireEvent.pointerUp(move, { clientX: 150, clientY: 175 });
  expect(change).toHaveBeenCalledExactlyOnceWith({ one: { x: 120, y: 130 } });
  expect(read()).toEqual({ one: { x: 120, y: 130 } });
});
it.each(["escape", "pointercancel", "lostpointercapture"])(
  "cancels a %s gesture without saving",
  (exit) => {
    const change = vi.fn();
    render(<Probe onChange={change} />);
    const move = screen.getByRole("button", { name: "Move" });
    fireEvent.pointerDown(move, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(move, { clientX: 200, clientY: 200 });
    expect(read().one).toBeDefined();
    if (exit === "escape") fireEvent.keyDown(move, { key: "Escape" });
    else fireEvent(move, new Event(exit, { bubbles: true }));
    fireEvent.pointerUp(move, { clientX: 200, clientY: 200 });
    expect(read()).toEqual({});
    expect(change).not.toHaveBeenCalled();
  },
);
it("cancels when scale changes and never commits a click", () => {
  const change = vi.fn();
  const { rerender } = render(<Probe onChange={change} />);
  const move = screen.getByRole("button", { name: "Move" });
  fireEvent.pointerDown(move, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerUp(move, { clientX: 100, clientY: 100 });
  expect(change).not.toHaveBeenCalled();
  fireEvent.pointerDown(move, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerMove(move, { clientX: 200, clientY: 200 });
  rerender(<Probe onChange={change} zoom={2} />);
  expect(read()).toEqual({});
  expect(change).not.toHaveBeenCalled();
});
it("includes viewport scrolling and returns to controlled geometry if owner declines", () => {
  const change = vi.fn();
  render(<Probe onChange={change} controlled={{}} />);
  const resize = screen.getByRole("button", { name: "Resize" });
  fireEvent.pointerDown(resize, { clientX: 100, clientY: 100, button: 0 });
  act(() => {
    resize.parentElement!.scrollLeft = 25;
    resize.parentElement!.scrollTop = 15;
  });
  fireEvent.pointerMove(resize, { clientX: 150, clientY: 150 });
  expect(read()).toEqual({ one: { x: 100, y: 100, width: 375, height: 265 } });
  fireEvent.pointerUp(resize, { clientX: 150, clientY: 150 });
  expect(change).toHaveBeenCalledOnce();
  expect(read()).toEqual({});
});
