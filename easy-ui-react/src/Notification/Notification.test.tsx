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

  it.each(["height", "width"] as const)(
    "offers a persistent focused fallback for a timed item clipped by one pixel in %s",
    (axis) => {
      let callback: IntersectionObserverCallback;
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
        render(
          <NotificationProvider
            notificationOptions={{ stacking: true, timeout: 80 }}
          >
            <Controls />
          </NotificationProvider>,
        );
        act(() =>
          notification.showSuccessToast({
            message: "One pixel clipped",
            isDismissable: false,
          }),
        );
        const node = screen.getByRole("alertdialog");
        vi.spyOn(node.parentElement!, "getBoundingClientRect").mockReturnValue(
          new DOMRect(0, 0, 100, 100),
        );
        const observe = (size: number, ratio: number) =>
          act(() =>
            callback(
              [
                {
                  target: node,
                  isIntersecting: true,
                  intersectionRatio: ratio,
                  boundingClientRect: new DOMRect(
                    0,
                    0,
                    axis === "width" ? size : 100,
                    axis === "height" ? size : 100,
                  ),
                  intersectionRect: new DOMRect(0, 0, 100, 100),
                  rootBounds: null,
                  time: 0,
                } as IntersectionObserverEntry,
              ],
              {} as IntersectionObserver,
            ),
          );
        observe(101, 100 / 101);
        act(() => vi.advanceTimersByTime(1000));
        const close = screen.getByRole("button", {
          name: "Dismiss One pixel clipped",
        });
        expect(node).toHaveAttribute(
          "class",
          expect.stringContaining("oversized"),
        );
        act(() => close.focus());
        observe(100, 1);
        expect(node).not.toHaveAttribute(
          "class",
          expect.stringContaining("oversized"),
        );
        expect(
          screen.getByRole("button", { name: "Dismiss One pixel clipped" }),
        ).toBe(close);
        expect(close).toHaveFocus();
        act(() => vi.advanceTimersByTime(1000));
        expect(close).toHaveFocus();
        act(() =>
          screen.getByRole("button", { name: "Outside notifications" }).focus(),
        );
        act(() => vi.advanceTimersByTime(79));
        expect(screen.getByText("One pixel clipped")).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.queryByText("One pixel clipped")).not.toBeInTheDocument();
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it("gives every fully intersecting stacked arrival its short duration only after its own entrance completes", () => {
    enableReactTransitionGroup();
    const callbacks = new Map<Element, IntersectionObserverCallback>();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        node?: Element;
        constructor(private callback: IntersectionObserverCallback) {}
        observe(node: Element) {
          this.node = node;
          callbacks.set(node, this.callback);
        }
        disconnect() {
          if (this.node) callbacks.delete(this.node);
        }
      },
    );
    try {
      const { unmount } = render(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 80 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      act(() => {
        notification.showSuccessToast({ message: "Lower rapid arrival" });
        notification.showSuccessToast({ message: "Leading rapid arrival" });
      });
      for (const node of screen.getAllByRole("alertdialog")) {
        act(() =>
          callbacks.get(node)!(
            [
              {
                target: node,
                isIntersecting: true,
                intersectionRatio: 1,
                boundingClientRect: node.getBoundingClientRect(),
                intersectionRect: node.getBoundingClientRect(),
                rootBounds: null,
                time: 0,
              } as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
          ),
        );
      }
      act(() => vi.advanceTimersByTime(80));
      expect(screen.getAllByRole("status")).toHaveLength(2);
      act(() => vi.advanceTimersByTime(69));
      expect(screen.getAllByRole("status")).toHaveLength(2);
      act(() => vi.advanceTimersByTime(1));
      act(() => vi.advanceTimersByTime(79));
      expect(screen.getAllByRole("status")).toHaveLength(2);
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(150));
      expect(screen.queryByText("Lower rapid arrival")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Leading rapid arrival"),
      ).not.toBeInTheDocument();
      unmount();
      expect(callbacks.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("tracks entrance completion independently for staggered arrivals without recreating observers", () => {
    enableReactTransitionGroup();
    const visibility = mockNotificationVisibility();
    try {
      render(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 80 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      act(() => notification.showSuccessToast({ message: "Earlier entrance" }));
      visibility.observe(screen.getByRole("alertdialog"));
      act(() => vi.advanceTimersByTime(100));
      act(() => notification.showSuccessToast({ message: "Later entrance" }));
      visibility.observe(
        screen.getByText("Later entrance").closest("[data-notification-key]")!,
      );
      act(() => vi.advanceTimersByTime(50));
      act(() => vi.advanceTimersByTime(79));
      expect(screen.getAllByRole("status")).toHaveLength(2);
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole("status")).toHaveTextContent("Later entrance");
      act(() => vi.advanceTimersByTime(20));
      act(() => vi.advanceTimersByTime(79));
      expect(screen.getByRole("status")).toHaveTextContent("Later entrance");
      expect(visibility.creations()).toBe(2);
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserves remaining presentation time through clipping and reflow after entrance, and cleans up exits", () => {
    enableReactTransitionGroup();
    const visibility = mockNotificationVisibility();
    try {
      const { unmount, rerender } = render(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 80 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      act(() =>
        notification.showSuccessToast({ message: "Reflow after entry" }),
      );
      const node = screen.getByRole("alertdialog");
      visibility.observe(node, 0.5);
      act(() => vi.advanceTimersByTime(150));
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByRole("status")).toHaveTextContent(
        "Reflow after entry",
      );
      visibility.observe(node);
      act(() => vi.advanceTimersByTime(30));
      visibility.observe(node, 0.5);
      act(() => vi.advanceTimersByTime(1000));
      rerender(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 5000 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      visibility.observe(node);
      visibility.observe(node);
      act(() => vi.advanceTimersByTime(49));
      expect(screen.getByRole("status")).toHaveTextContent(
        "Reflow after entry",
      );
      act(() => vi.advanceTimersByTime(1));
      expect(node).toHaveAttribute("aria-hidden", "true");
      visibility.observe(node);
      act(() => vi.advanceTimersByTime(150));
      expect(node).not.toBeInTheDocument();
      expect(visibility.callbacks.size).toBe(0);
      expect(visibility.creations()).toBe(1);
      act(() =>
        notification.showSuccessToast({ message: "Unmount during entry" }),
      );
      visibility.observe(screen.getByRole("alertdialog"));
      unmount();
      act(() => vi.advanceTimersByTime(10000));
      expect(visibility.callbacks.size).toBe(0);
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retains entrance gating when stacking is disabled, then preserves immediate replacement timing", () => {
    enableReactTransitionGroup();
    const visibility = mockNotificationVisibility();
    try {
      const { rerender } = render(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 80 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      act(() =>
        notification.showSuccessToast({ message: "Retained entering item" }),
      );
      visibility.observe(screen.getByRole("alertdialog"));
      act(() => vi.advanceTimersByTime(40));
      rerender(
        <NotificationProvider
          notificationOptions={{ stacking: false, timeout: 80 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      act(() => vi.advanceTimersByTime(110));
      act(() => vi.advanceTimersByTime(79));
      expect(screen.getByRole("status")).toHaveTextContent(
        "Retained entering item",
      );
      act(() =>
        notification.showSuccessToast({ message: "Immediate replacement" }),
      );
      act(() => vi.advanceTimersByTime(79));
      expect(screen.getByRole("status")).toHaveTextContent(
        "Immediate replacement",
      );
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("waits for stacked entrance without IntersectionObserver but leaves nonstacked default timing unchanged", () => {
    enableReactTransitionGroup();
    const { rerender } = render(
      <NotificationProvider
        notificationOptions={{ stacking: true, timeout: 80 }}
      >
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showSuccessToast({ message: "No observer entry" }));
    act(() => vi.advanceTimersByTime(149));
    expect(screen.getByRole("status")).toHaveTextContent("No observer entry");
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(79));
    expect(screen.getByRole("status")).toHaveTextContent("No observer entry");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(150));
    rerender(
      <NotificationProvider>
        <Controls />
      </NotificationProvider>,
    );
    act(() =>
      notification.showSuccessToast({ message: "Default replacement" }),
    );
    act(() => vi.advanceTimersByTime(150));
    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT_DURATION - 151));
    expect(screen.getByRole("status")).toHaveTextContent("Default replacement");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not complete an entrance for a bubbled child or non-opacity transition", () => {
    enableReactTransitionGroup();
    render(
      <NotificationProvider
        notificationOptions={{ stacking: true, timeout: 80 }}
      >
        <Controls />
      </NotificationProvider>,
    );
    act(() =>
      notification.showSuccessToast({ message: <span>Child transition</span> }),
    );
    const node = screen.getByRole("alertdialog");
    const transitionEnd = (target: Element, propertyName: string) => {
      const event = new Event("transitionend", { bubbles: true });
      Object.defineProperty(event, "propertyName", { value: propertyName });
      fireEvent(target, event);
    };
    act(() => vi.advanceTimersByTime(20));
    transitionEnd(screen.getByText("Child transition"), "opacity");
    transitionEnd(node, "transform");
    act(() => vi.advanceTimersByTime(80));
    expect(screen.getByRole("status")).toHaveTextContent("Child transition");
    act(() => vi.advanceTimersByTime(50));
    act(() => vi.advanceTimersByTime(79));
    expect(screen.getByRole("status")).toHaveTextContent("Child transition");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    transitionEnd(node, "opacity");
    expect(node).not.toBeInTheDocument();
  });

  it("ignores a disconnected observer's queued clipping after returning to nonstacked layout", () => {
    const visibility = mockNotificationVisibility();
    try {
      const { rerender } = render(
        <NotificationProvider notificationOptions={{ timeout: 80 }}>
          <Controls />
        </NotificationProvider>,
      );
      act(() => notification.showSuccessToast({ message: "Layout toggle" }));
      act(() => vi.advanceTimersByTime(20));
      rerender(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 80 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      const node = screen.getByRole("alertdialog");
      const staleCallback = visibility.callbacks.get(node)!;
      visibility.observe(node, 0.5);
      rerender(
        <NotificationProvider
          notificationOptions={{ stacking: false, timeout: 80 }}
        >
          <Controls />
        </NotificationProvider>,
      );
      expect(visibility.callbacks.size).toBe(0);
      act(() =>
        staleCallback(
          [notificationIntersection(node, 0.5)],
          {} as IntersectionObserver,
        ),
      );
      act(() => vi.advanceTimersByTime(59));
      expect(screen.getByRole("status")).toHaveTextContent("Layout toggle");
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores a disconnected portal observer that would bypass the remounted item's entrance", () => {
    enableReactTransitionGroup();
    const visibility = mockNotificationVisibility();
    const firstPortal = document.createElement("div");
    const secondPortal = document.createElement("div");
    document.body.append(firstPortal, secondPortal);
    try {
      const { unmount, rerender } = render(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 80 }}
          notificationPlacement={{ getContainer: () => firstPortal }}
        >
          <Controls />
        </NotificationProvider>,
      );
      act(() => notification.showSuccessToast({ message: "Portal remount" }));
      const oldNode = screen.getByRole("alertdialog");
      const staleCallback = visibility.callbacks.get(oldNode)!;
      visibility.observe(oldNode);
      act(() => vi.advanceTimersByTime(150));
      act(() => vi.advanceTimersByTime(20));
      rerender(
        <NotificationProvider
          notificationOptions={{ stacking: true, timeout: 80 }}
          notificationPlacement={{ getContainer: () => secondPortal }}
        >
          <Controls />
        </NotificationProvider>,
      );
      const newNode = screen.getByRole("alertdialog");
      expect(newNode).not.toBe(oldNode);
      visibility.observe(newNode);
      act(() =>
        staleCallback(
          [notificationIntersection(oldNode)],
          {} as IntersectionObserver,
        ),
      );
      act(() => vi.advanceTimersByTime(60));
      expect(screen.getByRole("status")).toHaveTextContent("Portal remount");
      act(() => vi.advanceTimersByTime(90));
      act(() => vi.advanceTimersByTime(59));
      expect(screen.getByRole("status")).toHaveTextContent("Portal remount");
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      unmount();
    } finally {
      firstPortal.remove();
      secondPortal.remove();
      vi.unstubAllGlobals();
    }
  });

  it("retains an oversized timed item's focused fallback after resize and resumes its captured duration", () => {
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
      const { unmount, rerender } = render(
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
      act(() => close.focus());
      vi.mocked(node.getBoundingClientRect).mockReturnValue({
        width: 200,
        height: 100,
      } as DOMRect);
      act(() => onResize([], {} as ResizeObserver));
      expect(node).not.toHaveAttribute(
        "class",
        expect.stringContaining("oversized"),
      );
      expect(
        screen.getByRole("button", {
          name: "Dismiss Oversized timed message",
        }),
      ).toBe(close);
      expect(close).toHaveFocus();
      rerender(
        <NotificationProvider
          notificationOptions={{ stacking: false, isDismissable: false }}
          notificationPlacement={{
            offset: {
              top: "auto",
              left: "auto",
              bottom: "16px",
              right: "16px",
            },
          }}
        >
          <Controls />
        </NotificationProvider>,
      );
      expect(close).toHaveFocus();
      expect(close).toBeInTheDocument();
      act(() =>
        callback(
          [
            {
              target: node,
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: node.getBoundingClientRect(),
              intersectionRect: node.getBoundingClientRect(),
              rootBounds: null,
              time: 0,
            },
          ],
          {} as IntersectionObserver,
        ),
      );
      act(() => vi.advanceTimersByTime(60000));
      expect(close).toHaveFocus();
      act(() =>
        screen.getByRole("button", { name: "Outside notifications" }).focus(),
      );
      act(() => vi.advanceTimersByTime(4999));
      expect(close).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
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

  it("treats auto as an unset stack edge while preserving authored placement", () => {
    const bottomPlacement = {
      offset: { top: "auto", left: "auto", bottom: "16px", right: "16px" },
    };
    const { rerender } = render(
      <NotificationProvider
        notificationOptions={{ stacking: true }}
        notificationPlacement={bottomPlacement}
      >
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showSuccessToast({ message: "Auto edges" }));
    const container = screen.getByRole("region").parentElement!;
    // jsdom's CSS parser drops auto inset values; the browser harness checks
    // the authored auto edges as well as the resulting viewport geometry.
    expect(container.style.getPropertyValue("--easy-ui-notification-top")).toBe(
      "16px",
    );
    expect(
      container.style.getPropertyValue("--easy-ui-notification-left"),
    ).toBe("16px");
    expect(container.style.justifyContent).toBe("flex-end");
    rerender(
      <NotificationProvider
        notificationOptions={{ stacking: true }}
        notificationPlacement={{
          offset: { top: "0", left: "0", bottom: "auto", right: "auto" },
        }}
      >
        <Controls />
      </NotificationProvider>,
    );
    expect(
      container.style.getPropertyValue("--easy-ui-notification-bottom"),
    ).toBe("16px");
    expect(
      container.style.getPropertyValue("--easy-ui-notification-right"),
    ).toBe("16px");
    expect(container.style.justifyContent).toBe("flex-start");
    rerender(
      <NotificationProvider
        notificationOptions={{ stacking: false }}
        notificationPlacement={bottomPlacement}
      >
        <Controls />
      </NotificationProvider>,
    );
    act(() => notification.showSuccessToast({ message: "Replacement" }));
    const replacement = screen.getByRole("region").parentElement!;
    expect(replacement.style.bottom).toBe("16px");
    expect(replacement.style.right).toBe("16px");
    expect(
      replacement.style.getPropertyValue("--easy-ui-notification-top"),
    ).toBe("");
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

function mockNotificationVisibility() {
  const callbacks = new Map<Element, IntersectionObserverCallback>();
  let creations = 0;
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
        if (this.node) callbacks.delete(this.node);
      }
    },
  );
  return {
    callbacks,
    creations: () => creations,
    observe: (node: Element, ratio = 1) =>
      act(() =>
        callbacks.get(node)!(
          [notificationIntersection(node, ratio)],
          {} as IntersectionObserver,
        ),
      ),
  };
}

function notificationIntersection(
  node: Element,
  ratio = 1,
): IntersectionObserverEntry {
  const bounds = node.getBoundingClientRect();
  return {
    target: node,
    isIntersecting: ratio > 0,
    intersectionRatio: ratio,
    boundingClientRect: bounds,
    intersectionRect: bounds,
    rootBounds: null,
    time: 0,
  };
}
