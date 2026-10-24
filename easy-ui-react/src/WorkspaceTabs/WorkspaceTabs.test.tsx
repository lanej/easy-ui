import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import {
  WorkspaceTabs,
  useWorkspaceTabIds,
  type WorkspaceTab,
} from "./WorkspaceTabs";

const pinnedTabs = [
  { id: "overview", label: "Overview", count: 0, isClosable: true },
  { id: "disabled", label: "Unavailable", isDisabled: true },
];
const openTabs = [
  { id: "order/a", label: "Order A", count: 12 },
  { id: "order_002fa", label: "Order B" },
  { id: "blocked", label: "Blocked", isDisabled: true },
];
const setup = () => ({
  "aria-label": "Workspace views",
  pinnedTabs,
  openTabs,
  selectedKey: "overview",
  onSelectionChange: vi.fn(),
  onClose: vi.fn(),
});

it("retains zero counts, controlled selection, and separate named close buttons", async () => {
  const user = userEvent.setup();
  const props = setup();
  render(<WorkspaceTabs {...props} trailing={<button>Open order</button>} />);
  expect(
    screen.getByRole("tablist", { name: "Workspace views" }),
  ).toBeVisible();
  expect(screen.getByRole("tab", { name: "Overview 0" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const order = screen.getByRole("tab", { name: "Order A 12" });
  expect(within(order).queryByRole("button")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Close Overview tab" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close Order A tab" }));
  expect(props.onClose).toHaveBeenCalledExactlyOnceWith("order/a");
  expect(props.onSelectionChange).not.toHaveBeenCalled();
  await user.click(order);
  expect(props.onSelectionChange).toHaveBeenCalledExactlyOnceWith("order/a");
  expect(order).toHaveAttribute("aria-selected", "false");
  expect(screen.getByRole("button", { name: "Open order" })).toBeVisible();
});

it("roves through enabled tabs without selecting and activates once with Enter/Space", async () => {
  const user = userEvent.setup();
  const props = setup();
  render(<WorkspaceTabs {...props} />);
  await user.tab();
  expect(screen.getByRole("tab", { name: "Overview 0" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  const firstOrder = screen.getByRole("tab", { name: "Order A 12" });
  expect(firstOrder).toHaveFocus();
  expect(firstOrder).toHaveAttribute("tabindex", "0");
  expect(screen.getByRole("tab", { name: "Overview 0" })).toHaveAttribute(
    "tabindex",
    "-1",
  );
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Order B" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Overview 0" })).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("tab", { name: "Order B" })).toHaveFocus();
  await user.keyboard("{Home}{ArrowRight}");
  expect(firstOrder).toHaveFocus();
  expect(props.onSelectionChange).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(props.onSelectionChange).toHaveBeenCalledExactlyOnceWith("order/a");
  props.onSelectionChange.mockClear();
  await user.keyboard(" ");
  expect(props.onSelectionChange).toHaveBeenCalledExactlyOnceWith("order/a");
});

it("disabled tabs cannot activate or close and non-closable open tabs have no close control", async () => {
  const user = userEvent.setup();
  const props = setup();
  render(
    <WorkspaceTabs
      {...props}
      openTabs={[
        ...openTabs,
        { id: "fixed", label: "Fixed", isClosable: false },
      ]}
    />,
  );
  await user.click(screen.getByRole("tab", { name: "Blocked" }));
  await user.click(screen.getByRole("button", { name: "Close Blocked tab" }));
  expect(props.onSelectionChange).not.toHaveBeenCalled();
  expect(props.onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("tab", { name: "Blocked" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Close Fixed tab" }),
  ).not.toBeInTheDocument();
});

it("enters at a later selected tab and tabs only through its roving close control", async () => {
  const user = userEvent.setup();
  const props = setup();
  render(
    <WorkspaceTabs
      {...props}
      selectedKey="order_002fa"
      trailing={<button>Open order</button>}
    />,
  );
  const orderA = screen.getByRole("tab", { name: "Order A 12" });
  const orderB = screen.getByRole("tab", { name: "Order B" });
  const closeA = screen.getByRole("button", { name: "Close Order A tab" });
  const closeB = screen.getByRole("button", { name: "Close Order B tab" });
  expect(closeA).toHaveAttribute("tabindex", "-1");
  await user.tab();
  expect(orderB).toHaveFocus();
  await user.tab();
  expect(closeB).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Open order" })).toHaveFocus();
  await user.tab({ shift: true });
  expect(closeB).toHaveFocus();
  await user.tab({ shift: true });
  expect(orderB).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  expect(orderA).toHaveFocus();
  expect(closeB).toHaveAttribute("tabindex", "-1");
  await user.tab();
  expect(closeA).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(props.onClose).toHaveBeenCalledExactlyOnceWith("order/a");
  expect(props.onSelectionChange).not.toHaveBeenCalled();
});

it.each(["overview", "blocked"])(
  "skips every close control when the entry point is pinned (selection %s)",
  async (selectedKey) => {
    const user = userEvent.setup();
    render(
      <WorkspaceTabs
        {...setup()}
        selectedKey={selectedKey}
        trailing={<button>Open order</button>}
      />,
    );
    await user.tab();
    expect(screen.getByRole("tab", { name: "Overview 0" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Open order" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("tab", { name: "Overview 0" })).toHaveFocus();
  },
);

it.each(["tab", "close"])(
  "recovers %s focus after delayed controlled removal without changing selection",
  async (control) => {
    const user = userEvent.setup();
    const props = setup();
    const { rerender } = render(<WorkspaceTabs {...props} />);
    const target =
      control === "tab"
        ? screen.getByRole("tab", { name: "Order A 12" })
        : screen.getByRole("button", { name: "Close Order A tab" });
    act(() => target.focus());
    if (control === "close") await user.click(target);
    // The application retains the tab while a close confirmation or save is pending.
    expect(target).toHaveFocus();
    rerender(<WorkspaceTabs {...props} openTabs={openTabs.slice(1)} />);
    expect(screen.getByRole("tab", { name: "Order B" })).toHaveFocus();
    expect(props.onSelectionChange).not.toHaveBeenCalled();
  },
);

it("falls back backward, skips disabled neighbors, and focuses the empty bar after its last removal", () => {
  const props = setup();
  const { rerender } = render(<WorkspaceTabs {...props} />);
  act(() => screen.getByRole("tab", { name: "Order B" }).focus());
  rerender(<WorkspaceTabs {...props} openTabs={[openTabs[0], openTabs[2]]} />);
  expect(screen.getByRole("tab", { name: "Order A 12" })).toHaveFocus();
  rerender(
    <WorkspaceTabs
      {...props}
      pinnedTabs={[]}
      openTabs={[]}
      selectedKey={null}
    />,
  );
  expect(screen.getByRole("tablist")).toHaveFocus();
});

it.each(["tab", "close"])(
  "recovers a focused %s control that becomes disabled",
  (control) => {
    const props = setup();
    const { rerender } = render(<WorkspaceTabs {...props} />);
    const target =
      control === "tab"
        ? screen.getByRole("tab", { name: "Order A 12" })
        : screen.getByRole("button", { name: "Close Order A tab" });
    act(() => target.focus());
    rerender(
      <WorkspaceTabs
        {...props}
        openTabs={openTabs.map((tab) => ({ ...tab, isDisabled: true }))}
      />,
    );
    expect(screen.getByRole("tab", { name: "Overview 0" })).toHaveFocus();
  },
);

it("does not steal focus after moving outside while a removal is pending", async () => {
  const user = userEvent.setup();
  const props = setup();
  const Example = ({ remove = false }: { remove?: boolean }) => (
    <>
      <WorkspaceTabs
        {...props}
        openTabs={remove ? openTabs.slice(1) : openTabs}
      />
      <button>Elsewhere</button>
    </>
  );
  const { rerender } = render(<Example />);
  await user.click(screen.getByRole("button", { name: "Close Order A tab" }));
  await user.click(screen.getByRole("button", { name: "Elsewhere" }));
  rerender(<Example remove />);
  expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
});

it("does not steal focus after clicking nonfocusable outside content", async () => {
  const user = userEvent.setup();
  const props = setup();
  const Example = ({ remove = false }: { remove?: boolean }) => (
    <>
      <WorkspaceTabs
        {...props}
        openTabs={remove ? openTabs.slice(1) : openTabs}
      />
      <p>Outside content</p>
    </>
  );
  const { rerender } = render(<Example />);
  await user.click(screen.getByRole("button", { name: "Close Order A tab" }));
  await user.click(screen.getByText("Outside content"));
  rerender(<Example remove />);
  expect(screen.getByRole("tab", { name: "Order B" })).not.toHaveFocus();
});

it("updates the entry point on external selection without overriding manual focus", async () => {
  const user = userEvent.setup();
  const props = setup();
  const { rerender } = render(<WorkspaceTabs {...props} />);
  rerender(<WorkspaceTabs {...props} selectedKey="order/a" />);
  await user.tab();
  expect(screen.getByRole("tab", { name: "Order A 12" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  rerender(<WorkspaceTabs {...props} selectedKey="overview" />);
  expect(screen.getByRole("tab", { name: "Order B" })).toHaveFocus();
});

it("shares collision-safe, stable IDs with external panels and separates instances", () => {
  const keys = [
    "order/a",
    "order_002fa",
    "order-002f-a",
    "",
    "💌",
    "\ud800",
    "\\ud800",
  ];
  function Example() {
    const ids = useWorkspaceTabIds();
    return (
      <>
        <WorkspaceTabs
          aria-label="Orders"
          ids={ids}
          selectedKey={keys[0]}
          onSelectionChange={() => {}}
          openTabs={keys.map((id) => ({ id, label: id || "Empty" }))}
        />
        {keys.map((id) => (
          <section
            key={id}
            id={ids.panelId(id)}
            role="tabpanel"
            aria-labelledby={ids.tabId(id)}
          />
        ))}
      </>
    );
  }
  const { container, rerender } = render(
    <>
      <Example />
      <Example />
    </>,
  );
  const before = Array.from(container.querySelectorAll("[id]")).map(
    (node) => node.id,
  );
  expect(new Set(before).size).toBe(before.length);
  for (const tab of screen.getAllByRole("tab")) {
    const panel = document.getElementById(tab.getAttribute("aria-controls")!);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  }
  rerender(
    <>
      <Example />
      <Example />
    </>,
  );
  expect(
    Array.from(container.querySelectorAll("[id]")).map((node) => node.id),
  ).toEqual(before);
});

it("uses explicitly supplied IDs for every ownership and external-panel relationship", () => {
  const ids = {
    tabId: (key: string) => `custom-tab-${key}`,
    panelId: (key: string) => `custom-panel-${key}`,
  };
  render(<WorkspaceTabs {...setup()} ids={ids} />);
  const tabs = screen.getAllByRole("tab");
  expect(screen.getByRole("tablist")).toHaveAttribute(
    "aria-owns",
    tabs.map((tab) => tab.id).join(" "),
  );
  for (const [index, tab] of tabs.entries()) {
    const key = [...pinnedTabs, ...openTabs][index].id;
    expect(tab).toHaveAttribute("id", ids.tabId(key));
    expect(tab).toHaveAttribute("aria-controls", ids.panelId(key));
  }
});

it("supports a single application-owned shared panel and localized close labels", () => {
  render(
    <WorkspaceTabs
      {...setup()}
      panelId="shared-panel"
      getCloseLabel={(tab) => `Dismiss ${tab.label}`}
      variant="secondary"
    />,
  );
  for (const tab of screen.getAllByRole("tab"))
    expect(tab).toHaveAttribute("aria-controls", "shared-panel");
  expect(screen.getByRole("button", { name: "Dismiss Order A" })).toBeVisible();
});

it("reveals focused and externally selected tabs by scrolling only its own viewport", () => {
  const props = setup();
  const { rerender } = render(<WorkspaceTabs {...props} />);
  const viewport = screen.getByRole("tablist").parentElement!;
  const item = screen.getByRole("tab", { name: "Order B" }).parentElement!;
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 200,
  } as DOMRect);
  vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
    left: 240,
    right: 340,
  } as DOMRect);
  fireEvent.focus(screen.getByRole("tab", { name: "Order B" }));
  expect(viewport.scrollLeft).toBe(140);
  viewport.scrollLeft = 0;
  rerender(<WorkspaceTabs {...props} selectedKey="order_002fa" />);
  expect(viewport.scrollLeft).toBe(140);
});

it("moves focus from an empty bar into newly available tabs", async () => {
  const user = userEvent.setup();
  const props = setup();
  const { rerender } = render(
    <WorkspaceTabs
      {...props}
      pinnedTabs={[]}
      openTabs={[]}
      selectedKey={null}
    />,
  );
  await user.tab();
  expect(screen.getByRole("tablist")).toHaveFocus();
  rerender(<WorkspaceTabs {...props} />);
  expect(screen.getByRole("tab", { name: "Overview 0" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Order A 12" })).toHaveFocus();
});

describe("geometry observation", () => {
  const observers: {
    callback: () => void;
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];

  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function (callback: () => void) {
        const observer = {
          callback,
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        };
        observers.push(observer);
        return observer;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("preserves deliberate scrolling and observations across equivalent parent updates", () => {
    const example = () => (
      <>
        <WorkspaceTabs
          {...setup()}
          pinnedTabs={pinnedTabs.map((tab) => ({ ...tab }))}
          openTabs={openTabs.map((tab) => ({ ...tab }))}
          onSelectionChange={() => {}}
          onClose={() => {}}
        />
        <button>Elsewhere</button>
      </>
    );
    const { rerender, unmount } = render(example());
    const viewport = screen.getByRole("tablist").parentElement!;
    const overview = screen.getByRole("tab", {
      name: "Overview 0",
    }).parentElement!;
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 200,
    } as DOMRect);
    vi.spyOn(overview, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          left: -viewport.scrollLeft,
          right: 100 - viewport.scrollLeft,
        }) as DOMRect,
    );
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    viewport.scrollLeft = 100;
    const targets = [viewport, ...viewport.children];
    expect(observers).toHaveLength(1);
    expect(observers[0].observe.mock.calls.map(([node]) => node)).toEqual(
      targets,
    );
    for (let revision = 0; revision < 3; revision++) {
      rerender(example());
      expect(viewport.scrollLeft).toBe(100);
      expect(observers).toHaveLength(1);
      expect(observers[0].observe).toHaveBeenCalledTimes(targets.length);
      expect(observers[0].unobserve).not.toHaveBeenCalled();
      expect(observers[0].disconnect).not.toHaveBeenCalled();
    }
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("uses committed selection and current focus for width, label, and count geometry changes", () => {
    const props = setup();
    const example = (
      selectedKey = "overview",
      tabs: WorkspaceTab[] = openTabs,
    ) => (
      <>
        <WorkspaceTabs {...props} selectedKey={selectedKey} openTabs={tabs} />
        <button>Elsewhere</button>
      </>
    );
    const { rerender } = render(example());
    const viewport = screen.getByRole("tablist").parentElement!;
    let viewportWidth = 200;
    vi.spyOn(viewport, "getBoundingClientRect").mockImplementation(
      () => ({ left: 0, right: viewportWidth }) as DOMRect,
    );
    const orderA = screen.getByRole("tab", { name: "Order A 12" });
    const orderB = screen.getByRole("tab", { name: "Order B" });
    let start = 260;
    let size = 100;
    vi.spyOn(orderA.parentElement!, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          left: start - viewport.scrollLeft,
          right: start + size - viewport.scrollLeft,
        }) as DOMRect,
    );
    vi.spyOn(orderB.parentElement!, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          left: 600 - viewport.scrollLeft,
          right: 700 - viewport.scrollLeft,
        }) as DOMRect,
    );
    const outside = screen.getByRole("button", { name: "Elsewhere" });
    act(() => outside.focus());
    rerender(example("order/a"));
    expect(viewport.scrollLeft).toBe(160);
    viewport.scrollLeft = 0;
    act(() => observers[0].callback());
    expect(viewport.scrollLeft).toBe(160); // Not the mount-time Overview selection.

    start = 330;
    size = 150;
    viewport.scrollLeft = 0;
    const renamed = openTabs.map((tab) =>
      tab.id === "order/a" ? { ...tab, label: "Renamed order" } : tab,
    );
    rerender(example("order/a", renamed));
    expect(viewport.scrollLeft).toBe(0); // The same DOM targets need no immediate reset.
    act(() => observers[0].callback());
    expect(viewport.scrollLeft).toBe(280);
    size = 180;
    viewport.scrollLeft = 0;
    rerender(
      example(
        "order/a",
        renamed.map((tab) => ({ ...tab, count: 999 })),
      ),
    );
    act(() => observers[0].callback());
    expect(viewport.scrollLeft).toBe(310);
    viewportWidth = 120;
    act(() => observers[0].callback());
    expect(viewport.scrollLeft).toBe(390);

    viewportWidth = 200;
    act(() => orderB.focus());
    viewport.scrollLeft = 0;
    act(() => observers[0].callback());
    expect(viewport.scrollLeft).toBe(500); // Current focus takes priority over selection.
    act(() => outside.focus());
    viewport.scrollLeft = 0;
    act(() => observers[0].callback());
    expect(viewport.scrollLeft).toBe(310); // Outside focus returns to the current selection.
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledTimes(
      viewport.children.length + 1,
    );
    expect(observers[0].unobserve).not.toHaveBeenCalled();
    expect(observers[0].disconnect).not.toHaveBeenCalled();
  });

  it.each(["tab", "close", "outside"])(
    "applies reveal priority with %s focus across external selection changes",
    (control) => {
      const props = setup();
      const example = (selectedKey = "overview") => (
        <>
          <WorkspaceTabs {...props} selectedKey={selectedKey} />
          <button>Elsewhere</button>
        </>
      );
      const { rerender } = render(example());
      const viewport = screen.getByRole("tablist").parentElement!;
      const orderA = screen.getByRole("tab", { name: "Order A 12" });
      const orderB = screen.getByRole("tab", { name: "Order B" });
      vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
        left: 0,
        right: 200,
      } as DOMRect);
      vi.spyOn(
        orderA.parentElement!,
        "getBoundingClientRect",
      ).mockImplementation(
        () =>
          ({
            left: -viewport.scrollLeft,
            right: 100 - viewport.scrollLeft,
          }) as DOMRect,
      );
      vi.spyOn(
        orderB.parentElement!,
        "getBoundingClientRect",
      ).mockImplementation(
        () =>
          ({
            left: 500 - viewport.scrollLeft,
            right: 600 - viewport.scrollLeft,
          }) as DOMRect,
      );
      const target =
        control === "tab"
          ? orderB
          : control === "close"
            ? screen.getByRole("button", { name: "Close Order B tab" })
            : screen.getByRole("button", { name: "Elsewhere" });
      act(() => target.focus());
      viewport.scrollLeft = 400;
      rerender(example("order/a"));
      expect(orderA).toHaveAttribute("aria-selected", "true");
      expect(target).toHaveFocus();
      expect(viewport.scrollLeft).toBe(control === "outside" ? 0 : 400);
      expect(observers).toHaveLength(1);
      expect(observers[0].disconnect).not.toHaveBeenCalled();
    },
  );

  it("reconciles only changed DOM targets and reveals after insertion, reordering, and removal", () => {
    const props = { ...setup(), selectedKey: "order_002fa" };
    const { rerender } = render(<WorkspaceTabs {...props} />);
    const viewport = screen.getByRole("tablist").parentElement!;
    const orderB = screen.getByRole("tab", { name: "Order B" });
    let start = 400;
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 200,
    } as DOMRect);
    vi.spyOn(orderB.parentElement!, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          left: start - viewport.scrollLeft,
          right: start + 100 - viewport.scrollLeft,
        }) as DOMRect,
    );
    const initialTargets = viewport.children.length + 1;
    const inserted = { id: "new", label: "New order" };
    rerender(<WorkspaceTabs {...props} openTabs={[inserted, ...openTabs]} />);
    expect(viewport.scrollLeft).toBe(300);
    const newItem = screen.getByRole("tab", {
      name: "New order",
    }).parentElement!;
    expect(observers[0].observe).toHaveBeenCalledTimes(initialTargets + 1);
    expect(observers[0].observe).toHaveBeenLastCalledWith(newItem);
    expect(observers[0].unobserve).not.toHaveBeenCalled();
    start = 500;
    rerender(<WorkspaceTabs {...props} openTabs={[...openTabs, inserted]} />);
    expect(viewport.scrollLeft).toBe(400);
    expect(observers[0].observe).toHaveBeenCalledTimes(initialTargets + 1);
    expect(observers[0].unobserve).not.toHaveBeenCalled();
    start = 600;
    rerender(<WorkspaceTabs {...props} />);
    expect(viewport.scrollLeft).toBe(500);
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledTimes(initialTargets + 1);
    expect(observers[0].unobserve).toHaveBeenCalledExactlyOnceWith(newItem);
    expect(observers[0].disconnect).not.toHaveBeenCalled();
  });

  it("disconnects and re-observes correctly during StrictMode effect replay", () => {
    const { unmount } = render(
      <React.StrictMode>
        <WorkspaceTabs {...setup()} />
      </React.StrictMode>,
    );
    const viewport = screen.getByRole("tablist").parentElement!;
    const targets = [viewport, ...viewport.children];
    expect(observers).toHaveLength(2);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(observers[1].observe.mock.calls.map(([node]) => node)).toEqual(
      targets,
    );
    expect(observers[1].disconnect).not.toHaveBeenCalled();
    unmount();
    expect(observers[1].disconnect).toHaveBeenCalledTimes(1);
  });
});
