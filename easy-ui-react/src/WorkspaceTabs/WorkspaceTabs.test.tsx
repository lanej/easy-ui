import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { WorkspaceTabs, useWorkspaceTabIds } from "./WorkspaceTabs";

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
  const keys = ["order/a", "order_002fa", "order-002f-a", "", "💌", "\\ud800"];
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
