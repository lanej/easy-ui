import React, { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useDependencyGraphFullscreen } from "./useDependencyGraphFullscreen";

let fullscreenElement: Element | null;
const change = (element: Element | null) => {
  fullscreenElement = element;
  document.dispatchEvent(new Event("fullscreenchange"));
};
function Probe({ id = "graph" }: { id?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const state = useDependencyGraphFullscreen(root);
  return (
    <div ref={root} data-testid={id}>
      {state.available && (
        <button
          data-graph-fullscreen-toggle
          aria-pressed={state.active}
          onClick={state.toggle}
        >
          {id}
        </button>
      )}
      {state.error && <p role="alert">{state.error}</p>}
    </div>
  );
}
beforeEach(() => {
  fullscreenElement = null;
  Object.defineProperties(document, {
    fullscreenEnabled: { configurable: true, value: true },
    fullscreenElement: { configurable: true, get: () => fullscreenElement },
    exitFullscreen: {
      configurable: true,
      value: vi.fn(async () => change(null)),
    },
  });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    value: vi.fn(async function (this: HTMLElement) {
      change(this);
    }),
  });
});
afterEach(() => {
  for (const key of [
    "fullscreenEnabled",
    "fullscreenElement",
    "exitFullscreen",
  ])
    Reflect.deleteProperty(document, key);
  Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
  vi.restoreAllMocks();
});
it("follows browser state and restores focus after an external exit", async () => {
  render(<Probe />);
  const button = screen.getByRole("button");
  await act(async () => fireEvent.click(button));
  expect(button).toHaveAttribute("aria-pressed", "true");
  act(() => change(null));
  expect(button).toHaveAttribute("aria-pressed", "false");
  expect(button).toHaveFocus();
  await act(async () => fireEvent.click(button));
  await act(async () => fireEvent.click(button));
  expect(document.exitFullscreen).toHaveBeenCalledOnce();
});
it("does not show a control when fullscreen is disallowed", () => {
  Object.defineProperty(document, "fullscreenEnabled", { value: false });
  render(<Probe />);
  expect(screen.queryByRole("button")).toBeNull();
});
it("announces rejection without changing state and allows a retry", async () => {
  vi.spyOn(HTMLElement.prototype, "requestFullscreen").mockRejectedValueOnce(
    new Error(),
  );
  render(<Probe />);
  const button = screen.getByRole("button");
  await act(async () => fireEvent.click(button));
  expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
  expect(button).toHaveAttribute("aria-pressed", "false");
  await act(async () => fireEvent.click(button));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(button).toHaveAttribute("aria-pressed", "true");
});
it("ignores repeated requests while a request is pending", async () => {
  let finish!: () => void;
  const request = vi
    .spyOn(HTMLElement.prototype, "requestFullscreen")
    .mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
  render(<Probe />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("button"));
  expect(request).toHaveBeenCalledOnce();
  await act(async () => finish());
});
it("keeps separate graphs independent and removes listeners on unmount", async () => {
  const { unmount } = render(
    <>
      <Probe id="one" />
      <Probe id="two" />
    </>,
  );
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "one" })),
  );
  expect(screen.getByRole("button", { name: "two" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const removed = vi.spyOn(document, "removeEventListener");
  unmount();
  expect(
    removed.mock.calls.filter(([name]) => name === "fullscreenchange"),
  ).toHaveLength(2);
});
