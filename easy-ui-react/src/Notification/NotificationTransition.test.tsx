import React from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { Transition, TransitionGroup } from "react-transition-group";
import { vi } from "vitest";
import { NotificationProvider, useNotification } from "./Notification";
import {
  NotificationTransition,
  useNotificationTransitionTracking,
} from "./NotificationTransition";
import {
  enableReactTransitionGroup,
  mockGetComputedStyle,
  render,
} from "../utilities/test";

// Upstream's runtime callback removes completed children from its keyed map.
// Its published component type does not expose this implementation method.
const groupPrototype =
  TransitionGroup.prototype as typeof TransitionGroup.prototype & {
    handleExited(child: React.ReactElement, node?: HTMLElement): void;
  };

function endTransition(node: Element, propertyName = "opacity") {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(node, event);
}

describe("notification transition cleanup", () => {
  let restoreStyle: () => void;
  beforeEach(() => {
    enableReactTransitionGroup();
    restoreStyle = mockGetComputedStyle();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    restoreStyle();
  });

  it("releases repeatedly closed toast wrappers while a persistent alert keeps the actual region mounted", () => {
    const exited = vi.spyOn(groupPrototype, "handleExited");
    const unmounted = vi.spyOn(Transition.prototype, "componentWillUnmount");
    let notification: ReturnType<typeof useNotification>;
    function Controls() {
      notification = useNotification();
      return null;
    }
    render(
      <NotificationProvider notificationOptions={{ stacking: true }}>
        <Controls />
      </NotificationProvider>,
    );
    let anchorKey = "";
    act(() => {
      anchorKey = notification.showWarningAlert({
        message: "Persistent anchor",
      });
    });
    act(() => vi.advanceTimersByTime(150));
    for (let index = 0; index < 3; index++) {
      let key = "";
      act(() => {
        key = notification.showSuccessToast({
          message: `Transient ${index}`,
          timeout: 0,
        });
      });
      act(() => vi.advanceTimersByTime(150));
      const node = screen
        .getByText(`Transient ${index}`)
        .closest("[data-notification-key]")!;
      act(() => {
        notification.closeNotification(key);
        notification.closeNotification(key);
      });
      if (index % 2 === 0) endTransition(node);
      else act(() => vi.advanceTimersByTime(150));
      expect(screen.queryByText(`Transient ${index}`)).not.toBeInTheDocument();
      expect(screen.getByText("Persistent anchor")).toBeInTheDocument();
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
      expect(exited).toHaveBeenCalledTimes(index + 1);
      expect(unmounted).toHaveBeenCalledTimes(index + 1);
      // Late transition events and timeout fallbacks cannot complete it twice.
      endTransition(node);
      act(() => vi.advanceTimersByTime(150));
      expect(exited).toHaveBeenCalledTimes(index + 1);
      expect(unmounted).toHaveBeenCalledTimes(index + 1);
    }
    act(() => notification.closeNotification(anchorKey));
    act(() => vi.advanceTimersByTime(150));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(exited).toHaveBeenCalledTimes(4);
    expect(unmounted).toHaveBeenCalledTimes(4);
  });

  it.each(["opacity event", "timeout fallback"])(
    "composes the upstream exit callback exactly once after cleanup and pending tracking via %s",
    (completion) => {
      const exited = vi.spyOn(groupPrototype, "handleExited");
      const pending = vi.fn();
      function Harness({ active }: { active: boolean }) {
        const tracking = useNotificationTransitionTracking();
        return (
          <>
            <output data-testid="pending">
              {tracking.isTransitionPending ? "pending" : "idle"}
            </output>
            <TransitionGroup component={null}>
              {active && (
                <NotificationTransition
                  key="tracked"
                  transitionKey="tracked"
                  onTransitionPendingChange={(value) => {
                    pending(value);
                    tracking.onTransitionPendingChange(value);
                  }}
                >
                  {({ nodeRef }) => (
                    <div ref={nodeRef}>
                      <span>Tracked transition</span>
                    </div>
                  )}
                </NotificationTransition>
              )}
            </TransitionGroup>
          </>
        );
      }
      const { rerender } = render(<Harness active />);
      expect(pending.mock.calls).toEqual([[true]]);
      act(() => vi.advanceTimersByTime(150));
      expect(screen.getByTestId("pending")).toHaveTextContent("pending");
      const node = screen.getByText("Tracked transition").parentElement!;
      const removeListener = vi.spyOn(node, "removeEventListener");
      rerender(<Harness active={false} />);
      endTransition(screen.getByText("Tracked transition"));
      endTransition(node, "transform");
      expect(pending.mock.calls).toEqual([[true]]);
      expect(exited).not.toHaveBeenCalled();
      if (completion === "opacity event") endTransition(node);
      else act(() => vi.advanceTimersByTime(150));
      expect(pending.mock.calls).toEqual([[true], [false]]);
      expect(screen.getByTestId("pending")).toHaveTextContent("idle");
      expect(node).not.toBeInTheDocument();
      expect(exited).toHaveBeenCalledTimes(1);
      // CSSTransition supplies an undefined node when nodeRef is used. Keep
      // that argument when forwarding the callback bound by TransitionGroup.
      expect(exited.mock.calls[0]).toHaveLength(2);
      expect(exited.mock.calls[0][1]).toBeUndefined();
      const removal = removeListener.mock.calls.findIndex(
        ([type]) => type === "transitionend",
      );
      expect(removal).toBeGreaterThanOrEqual(0);
      expect(removeListener.mock.invocationCallOrder[removal]).toBeLessThan(
        pending.mock.invocationCallOrder[1],
      );
      expect(pending.mock.invocationCallOrder[1]).toBeLessThan(
        exited.mock.invocationCallOrder[0],
      );
      endTransition(node);
      act(() => vi.advanceTimersByTime(500));
      expect(pending.mock.calls).toEqual([[true], [false]]);
      expect(exited).toHaveBeenCalledTimes(1);
      rerender(<Harness active />);
      act(() => vi.advanceTimersByTime(150));
      rerender(<Harness active={false} />);
      act(() => vi.advanceTimersByTime(150));
      expect(pending.mock.calls).toEqual([[true], [false], [true], [false]]);
      expect(exited).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("pending")).toHaveTextContent("idle");
    },
  );
});
