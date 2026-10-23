import { act, fireEvent, screen } from "@testing-library/react";
import { UserEvent } from "@testing-library/user-event";
import React from "react";
import { vi } from "vitest";
import { Button } from "../Button";
import {
  NotificationProps,
  useNotification,
  NotificationProvider,
} from "./Notification";
import { TOAST_TIMEOUT_DURATION } from "./NotificationQueue";
import {
  disableReactTransitionGroup,
  enableReactTransitionGroup,
  mockGetComputedStyle,
  render,
  userClick,
} from "../utilities/test";

describe("<Notification />", () => {
  let restoreGetComputedStyle: () => void;

  beforeEach(() => {
    disableReactTransitionGroup();
    restoreGetComputedStyle = mockGetComputedStyle();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreGetComputedStyle();
    enableReactTransitionGroup();
  });

  it("should render an alert notification", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger type="alert" message="Hello World" />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("should render a toast notification", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger message="Hello World" />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("should render a notification with a visible message", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger message="Hello World" />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("checks that toast notifications disappear after 4000ms", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger message="Hello World" />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_DURATION);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("checks that alert notifications can be dismissed", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger type="alert" message="Hello World" />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    await clickNotification(user, screen.getAllByRole("button")[1]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("should render a notification with appropriate status styles applied", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger
          type="alert"
          message="Hello World"
          status="promotional"
        />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    expect(screen.getByRole("alertdialog")).toHaveAttribute(
      "class",
      expect.stringContaining("statusPromotional"),
    );
  });

  it("should render a notification with appropriate type styles applied", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger type="alert" message="Hello World" />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    expect(screen.getByRole("alertdialog")).toHaveAttribute(
      "class",
      expect.stringContaining("typeAlert"),
    );
  });

  it("should render a notification with an icon", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger message="Hello World" />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
  });

  it("should render a notification without an icon", async () => {
    const { user } = render(
      <NotificationProvider>
        <SimulatedNotificationTrigger message="Hello World" hasIcon={false} />
      </NotificationProvider>,
    );
    await clickNotification(user, screen.getByRole("button"));
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
  });
});

async function clickNotification(user: UserEvent, el: HTMLElement) {
  await userClick(user, el);
}

function SimulatedNotificationTrigger(props: NotificationProps) {
  const {
    type = "toast",
    message,
    status = "success",
    hasIcon = true,
    onDismiss,
  } = props;
  const notification = useNotification();
  const handlePress = () => {
    if (type === "toast") {
      if (status === "promotional") {
        notification.showPromotionalToast({ message, hasIcon });
      } else {
        notification.showSuccessToast({ message, hasIcon });
      }
    } else {
      if (status === "promotional") {
        notification.showPromotionalAlert({ message, hasIcon, onDismiss });
      } else {
        notification.showSuccessAlert({ message, hasIcon, onDismiss });
      }
    }
  };

  return <Button onPress={handlePress}>Trigger</Button>;
}

describe("stacked notification interaction", () => {
  let notification: ReturnType<typeof useNotification>;
  let restoreStyle: () => void;
  function Controls() {
    notification = useNotification();
    return <button>Outside notifications</button>;
  }
  beforeEach(() => {
    disableReactTransitionGroup();
    restoreStyle = mockGetComputedStyle();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    restoreStyle();
    enableReactTransitionGroup();
  });

  it("retains rapid mixed messages, names close controls, and invokes only the dismissed callback", async () => {
    const onDismiss = vi.fn();
    const { user } = render(
      <NotificationProvider
        notificationOptions={{
          stacking: true,
          timeout: 5000,
          isDismissable: true,
        }}
      >
        <Controls />
      </NotificationProvider>,
    );
    let first = "";
    act(() => {
      first = notification.showSuccessToast({ message: "Order saved" });
      notification.showSuccessToast({ message: "Order saved" });
      notification.showWarningAlert({ message: "Review address", onDismiss });
    });
    expect(screen.getAllByText("Order saved")).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Dismiss Order saved" }),
    ).toHaveLength(2);
    act(() => notification.closeNotification(first));
    expect(screen.getAllByText("Order saved")).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Dismiss Review address" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Review address")).not.toBeInTheDocument();
    expect(screen.getByText("Order saved")).toBeInTheDocument();
    // The live content belongs to each new item, never the whole region.
    expect(screen.getByRole("region")).not.toHaveAttribute("aria-live");
    expect(screen.getByRole("status")).toHaveTextContent("Order saved");
  });

  it("pauses for overlapping hover and keyboard interaction and resumes only remaining time", async () => {
    const { user } = render(
      <NotificationProvider
        notificationOptions={{
          stacking: true,
          timeout: 5000,
          isDismissable: true,
        }}
      >
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showSuccessToast({ message: "Order A saved" }));
    const close = screen.getByRole("button", { name: "Dismiss Order A saved" });
    act(() => vi.advanceTimersByTime(2000));
    await user.hover(close);
    act(() => close.focus());
    await user.unhover(close);
    act(() => {
      notification.showSuccessToast({ message: "Order B saved" });
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Order A saved")).toBeInTheDocument();
    expect(screen.getByText("Order B saved")).toBeInTheDocument();
    act(() =>
      screen.getByRole("button", { name: "Outside notifications" }).focus(),
    );
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByText("Order A saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Order A saved")).not.toBeInTheDocument();
    expect(screen.getByText("Order B saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText("Order B saved")).not.toBeInTheDocument();
  });

  it("keeps existing DOM/live regions stable on arrival and supports keyboard individual dismissal", async () => {
    const { user } = render(
      <NotificationProvider
        notificationOptions={{ stacking: true, isDismissable: true }}
      >
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showSuccessToast({ message: "First saved" }));
    const original = screen.getByRole("status");
    act(() => notification.showSuccessToast({ message: "Second saved" }));
    expect(screen.getByText("First saved").closest('[role="status"]')).toBe(
      original,
    );
    const close = screen.getByRole("button", { name: "Dismiss First saved" });
    act(() => close.focus());
    await user.keyboard("{Enter}");
    expect(screen.queryByText("First saved")).not.toBeInTheDocument();
    expect(screen.getByText("Second saved")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toHaveFocus();
  });

  it("moves keyboard focus past an exiting newest item with real transitions", async () => {
    enableReactTransitionGroup();
    const { user } = render(
      <NotificationProvider
        notificationOptions={{ stacking: true, isDismissable: true }}
      >
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showSuccessToast({ message: "Older saved" }));
    fireEvent.transitionEnd(screen.getByRole("alertdialog"));
    act(() => notification.showSuccessToast({ message: "Newest saved" }));
    const newest = screen
      .getByRole("button", { name: "Dismiss Newest saved" })
      .closest('[role="alertdialog"]')!;
    fireEvent.transitionEnd(newest);
    act(() =>
      screen.getByRole("button", { name: "Dismiss Newest saved" }).focus(),
    );
    await user.keyboard("{Enter}");
    expect(newest).toHaveAttribute("aria-hidden", "true");
    expect(newest).not.toHaveAttribute("role");
    expect(screen.getByRole("alertdialog")).toHaveFocus();
    expect(newest).toHaveAttribute("class", expect.stringContaining("exiting"));
    act(() => vi.advanceTimersByTime(200)); // also works when no transitionend fires
    expect(newest).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toHaveFocus();
    expect(screen.getByText("Older saved")).toBeInTheDocument();
  });

  it("recovers focus by key after a newer arrival shifts an older focused item", async () => {
    const { user } = render(
      <NotificationProvider notificationOptions={{ stacking: true }}>
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showWarningAlert({ message: "Reading this alert" }));
    act(() =>
      screen
        .getByRole("button", { name: "Dismiss Reading this alert" })
        .focus(),
    );
    act(() =>
      notification.showSuccessToast({ message: "New nondismissible toast" }),
    );
    expect(
      screen.getByRole("button", { name: "Dismiss Reading this alert" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alertdialog")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "New nondismissible toast",
    );
  });

  it("keeps focus on a surviving oldest item after multiple prepends and a newer dismissal", () => {
    render(
      <NotificationProvider notificationOptions={{ stacking: true }}>
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showWarningAlert({ message: "Reading A" }));
    const close = screen.getByRole("button", { name: "Dismiss Reading A" });
    act(() => close.focus());
    act(() => notification.showWarningAlert({ message: "New B" }));
    let newest = "";
    act(() => {
      newest = notification.showWarningAlert({ message: "New C" });
    });
    act(() => notification.closeNotification(newest));
    expect(close).toHaveFocus();
  });

  it("resumes future arrivals after the final hovered region unmounts", async () => {
    const { user } = render(
      <NotificationProvider
        notificationOptions={{
          stacking: true,
          timeout: 1000,
          isDismissable: true,
        }}
      >
        <Controls />
      </NotificationProvider>,
    );
    let first = "";
    act(() => {
      first = notification.showSuccessToast({ message: "Hovered A" });
    });
    await user.hover(screen.getByRole("button", { name: "Dismiss Hovered A" }));
    act(() => notification.closeNotification(first));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await user.unhover(document.body);
    act(() => notification.showSuccessToast({ message: "Later B" }));
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText("Later B")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Later B")).not.toBeInTheDocument();
  });

  it("uses configured options from descendant layout effects, including after changes", () => {
    function LayoutArrival({ version }: { version: number }) {
      const current = useNotification();
      React.useLayoutEffect(() => {
        current.showSuccessToast({ message: `First ${version}` });
        current.showSuccessToast({ message: `Second ${version}` });
        // Only simulate a new committed application update, not queue renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [version]);
      return <button>Outside</button>;
    }
    const { rerender } = render(
      <NotificationProvider
        notificationOptions={{ stacking: true, timeout: 5000 }}
      >
        <LayoutArrival version={1} />
      </NotificationProvider>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(2);
    rerender(
      <NotificationProvider
        notificationOptions={{ stacking: true, timeout: 1000 }}
      >
        <LayoutArrival version={2} />
      </NotificationProvider>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(4);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByText("First 1")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not recover notification focus after an explicit blur to the document", () => {
    render(
      <NotificationProvider
        notificationOptions={{ stacking: true, isDismissable: true }}
      >
        <Controls />
      </NotificationProvider>,
    );
    let first = "";
    act(() => {
      first = notification.showSuccessToast({ message: "First" });
      notification.showSuccessToast({ message: "Second" });
    });
    const close = screen.getByRole("button", { name: "Dismiss First" });
    act(() => close.focus());
    act(() => close.blur());
    act(() => notification.closeNotification(first));
    expect(document.body).toHaveFocus();
  });

  it("gates mounted notification timers by actual scroll-viewport presentation", () => {
    const callbacks = new Map<Element, IntersectionObserverCallback>();
    let creations = 0;
    let disconnections = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        node?: Element;
        constructor(private callback: IntersectionObserverCallback) {
          creations++;
        }
        observe(node: Element) {
          this.node = node;
          callbacks.set(node, this.callback);
        }
        disconnect() {
          disconnections++;
          if (this.node) callbacks.delete(this.node);
        }
      },
    );
    try {
      const { unmount, rerender } = render(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 5000 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      act(() => {
        notification.showSuccessToast({ message: "Presented" });
        notification.showSuccessToast({ message: "Clipped" });
      });
      const presented = screen
        .getByText("Presented")
        .closest("[data-notification-key]")!;
      const clipped = screen
        .getByText("Clipped")
        .closest("[data-notification-key]")!;
      const observe = (node: Element, ratio: number) =>
        act(() =>
          callbacks.get(node)!(
            [
              {
                target: node,
                isIntersecting: ratio > 0,
                intersectionRatio: ratio,
              } as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
          ),
        );
      observe(presented, 1);
      observe(clipped, 0.5);
      act(() => vi.advanceTimersByTime(2000));
      rerender(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 5000 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      expect(creations).toBe(2);
      expect(disconnections).toBe(0);
      act(() => vi.advanceTimersByTime(3000));
      expect(screen.queryByText("Presented")).not.toBeInTheDocument();
      expect(screen.getByText("Clipped")).toBeInTheDocument();
      observe(clipped, 1);
      act(() => vi.advanceTimersByTime(4999));
      expect(screen.getByText("Clipped")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByText("Clipped")).not.toBeInTheDocument();
      unmount();
      expect(callbacks.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("offers an oversized timed stack item a close control even when ordinary toast controls are disabled", async () => {
    let callback: IntersectionObserverCallback;
    let onResize: ResizeObserverCallback;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          onResize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(onIntersection: IntersectionObserverCallback) {
          callback = onIntersection;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      const { user, unmount } = render(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 5000 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      act(() =>
        notification.showSuccessToast({
          message: "Oversized timed message",
          isDismissable: false,
        }),
      );
      const node = screen.getByRole("alertdialog");
      act(() =>
        callback(
          [
            {
              target: node,
              isIntersecting: true,
              intersectionRatio: 0.5,
              boundingClientRect: new DOMRect(0, 0, 200, 200),
              intersectionRect: new DOMRect(0, 0, 200, 100),
              rootBounds: new DOMRect(0, 0, 320, 720),
              time: 0,
            },
          ],
          {} as IntersectionObserver,
        ),
      );
      expect(
        screen.queryByRole("button", {
          name: "Dismiss Oversized timed message",
        }),
      ).not.toBeInTheDocument();
      vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
        width: 200,
        height: 2000,
      } as DOMRect);
      // Geometry can grow without crossing any intersection threshold.
      act(() => onResize([], {} as ResizeObserver));
      act(() => vi.advanceTimersByTime(60000));
      const close = screen.getByRole("button", {
        name: "Dismiss Oversized timed message",
      });
      expect(close).toBeInTheDocument();
      await user.click(close);
      expect(
        screen.queryByText("Oversized timed message"),
      ).not.toBeInTheDocument();
      unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retains scrollable presentation when stacking is disabled until replacement arrives", () => {
    const { rerender } = render(
      <NotificationProvider notificationOptions={{ stacking: true }}>
        <Controls />
      </NotificationProvider>,
    );
    act(() =>
      notification.showSuccessToast({ message: "Retained stack item" }),
    );
    rerender(
      <NotificationProvider notificationOptions={{ stacking: false }}>
        <Controls />
      </NotificationProvider>,
    );
    expect(screen.getByRole("region").parentElement).toHaveAttribute(
      "class",
      expect.stringContaining("stacked"),
    );
    act(() => notification.showSuccessToast({ message: "Replacement" }));
    expect(screen.queryByText("Retained stack item")).not.toBeInTheDocument();
    expect(screen.getByRole("region").parentElement).not.toHaveAttribute(
      "class",
      expect.stringContaining("stacked"),
    );
  });

  it("reserves configured placement offsets when sizing the stack", () => {
    render(
      <NotificationProvider
        notificationOptions={{ stacking: true }}
        notificationPlacement={{ offset: { bottom: "80px", right: "80px" } }}
      >
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showSuccessToast({ message: "Offset stack" }));
    const container = screen.getByRole("region").parentElement!;
    expect(
      container.style.getPropertyValue("--easy-ui-notification-bottom"),
    ).toBe("80px");
    expect(
      container.style.getPropertyValue("--easy-ui-notification-right"),
    ).toBe("80px");
    expect(container.style.getPropertyValue("--easy-ui-notification-top")).toBe(
      "16px",
    );
    expect(container.style.justifyContent).toBe("flex-end");
  });

  it("normalizes default and explicit zero offsets for length arithmetic", () => {
    const { rerender } = render(
      <NotificationProvider notificationOptions={{ stacking: true }}>
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showSuccessToast({ message: "Default stack" }));
    expect(
      screen
        .getByRole("region")
        .parentElement!.style.getPropertyValue("--easy-ui-notification-top"),
    ).toBe("0px");
    expect(
      screen
        .getByRole("region")
        .parentElement!.style.getPropertyValue("--easy-ui-notification-left"),
    ).toBe("0px");
    rerender(
      <NotificationProvider
        notificationOptions={{ stacking: true }}
        notificationPlacement={{ offset: { top: "0", left: "0" } }}
      >
        <Controls />
      </NotificationProvider>,
    );
    expect(
      screen
        .getByRole("region")
        .parentElement!.style.getPropertyValue("--easy-ui-notification-top"),
    ).toBe("0px");
  });

  it("adapts presentation tracking when stacking is enabled without resetting an older toast", () => {
    let onIntersection: IntersectionObserverCallback;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          onIntersection = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      const { rerender, unmount } = render(
        <NotificationProvider>
          <Controls />
        </NotificationProvider>,
      );
      act(() =>
        notification.showSuccessToast({
          message: "Predates stacking",
          timeout: 5000,
        }),
      );
      act(() => vi.advanceTimersByTime(1000));
      rerender(
        <NotificationProvider notificationOptions={{ stacking: true }}>
          <Controls />
        </NotificationProvider>,
      );
      const node = screen.getByRole("alertdialog");
      act(() =>
        onIntersection(
          [
            {
              target: node,
              boundingClientRect: node.getBoundingClientRect(),
              intersectionRect: node.getBoundingClientRect(),
              rootBounds: null,
              time: 0,
              isIntersecting: false,
              intersectionRatio: 0,
            } as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        ),
      );
      act(() => vi.advanceTimersByTime(10000));
      expect(screen.getByText("Predates stacking")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Dismiss Predates stacking" }),
      ).not.toBeInTheDocument();
      act(() =>
        onIntersection(
          [
            {
              target: node,
              boundingClientRect: node.getBoundingClientRect(),
              intersectionRect: node.getBoundingClientRect(),
              rootBounds: null,
              time: 0,
              isIntersecting: true,
              intersectionRatio: 1,
            } as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        ),
      );
      act(() => vi.advanceTimersByTime(3999));
      expect(screen.getByText("Predates stacking")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByText("Predates stacking")).not.toBeInTheDocument();
      unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("makes the empty region pointer-transparent during the final exit", async () => {
    enableReactTransitionGroup();
    const { user } = render(
      <NotificationProvider notificationOptions={{ stacking: true }}>
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showWarningAlert({ message: "Final alert" }));
    fireEvent.transitionEnd(screen.getByRole("alertdialog"));
    await user.click(
      screen.getByRole("button", { name: "Dismiss Final alert" }),
    );
    expect(screen.getByRole("region")).toHaveStyle({ pointerEvents: "none" });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("clears active timers when the provider unmounts", () => {
    const { unmount } = render(
      <NotificationProvider notificationOptions={{ stacking: true }}>
        <Controls />
      </NotificationProvider>,
    );
    act(() => {
      notification.showSuccessToast({ message: "One" });
      notification.showSuccessToast({ message: "Two" });
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
