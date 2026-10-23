import React, { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../Button";
import {
  WorkspaceTabs,
  WorkspaceTab,
  useWorkspaceTabIds,
} from "./WorkspaceTabs";

const pinned: WorkspaceTab[] = [
  { id: "overview", label: "Overview", count: 12 },
  { id: "unassigned", label: "Unassigned", count: 0 },
  { id: "archived", label: "Archived", count: 4, isDisabled: true },
];
const orders: WorkspaceTab[] = [
  { id: "order/a", label: "Order A", count: 3 },
  {
    id: "order_002fa",
    label: "Order B — international replenishment and fulfillment",
  },
  { id: "locked", label: "Locked order", isDisabled: true },
];

function WorkspaceExample({
  variant = "primary",
  narrow = false,
  transition = false,
}: {
  variant?: "primary" | "secondary";
  narrow?: boolean;
  transition?: boolean;
}) {
  const ids = useWorkspaceTabIds();
  const nextOrder = useRef(1);
  const [openTabs, setOpenTabs] = useState(orders);
  const [selectedKey, setSelectedKey] = useState<string | null>("overview");
  const [width, setWidth] = useState(840);
  const tabs = [...pinned, ...openTabs];
  function close(id: string) {
    setOpenTabs((previous) => previous.filter((tab) => tab.id !== id));
    if (selectedKey === id) setSelectedKey("overview");
  }
  return (
    <div
      style={{
        maxWidth: "100%",
        width: narrow ? 320 : transition ? width : 1000,
        transition: "width 300ms ease",
      }}
    >
      {transition && (
        <label style={{ display: "block", marginBottom: 16 }}>
          Workspace width{" "}
          <input
            aria-label="Workspace width"
            type="range"
            min="240"
            max="1000"
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
      )}
      <WorkspaceTabs
        aria-label="Workspace views"
        ids={ids}
        pinnedTabs={pinned}
        openTabs={openTabs}
        selectedKey={selectedKey}
        onSelectionChange={setSelectedKey}
        onClose={close}
        variant={variant}
        trailing={
          <Button
            size="sm"
            onPress={() => {
              const number = nextOrder.current++;
              setOpenTabs((tabs) => [
                ...tabs,
                { id: `new-${number}`, label: `Order ${number}` },
              ]);
            }}
          >
            Open order
          </Button>
        }
      />
      {tabs.map((tab) => (
        <section
          key={tab.id}
          role="tabpanel"
          id={ids.panelId(tab.id)}
          aria-labelledby={ids.tabId(tab.id)}
          hidden={tab.id !== selectedKey}
          tabIndex={0}
          style={{ padding: "24px 12px", minHeight: 120 }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{tab.label}</p>
          <p style={{ margin: 0 }}>
            The application owns this view and its selection policy.
          </p>
        </section>
      ))}
    </div>
  );
}

const meta: Meta<typeof WorkspaceTabs> = {
  title: "Organisms/Navigation/WorkspaceTabs",
  component: WorkspaceTabs,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof WorkspaceTabs>;

export const Default: Story = {
  render: () => <WorkspaceExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const overview = canvas.getByRole("tab", { name: "Overview 12" });
    overview.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(
      canvas.getByRole("tab", { name: "Unassigned 0" }),
    ).toHaveFocus();
    await expect(overview).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}{Enter}");
    await expect(
      canvas.getByRole("tab", { name: "Order A 3" }),
    ).toHaveAttribute("aria-selected", "true");
    await userEvent.click(
      canvas.getByRole("button", { name: "Close Order A tab" }),
    );
    await expect(
      canvas.queryByRole("tab", { name: "Order A 3" }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: /Order B/ })).toHaveFocus();
  },
};
export const Secondary: Story = {
  render: () => <WorkspaceExample variant="secondary" />,
};
export const Narrow: Story = { render: () => <WorkspaceExample narrow /> };
export const WidthTransition: Story = {
  render: () => <WorkspaceExample transition />,
};
export const Empty: Story = {
  args: {
    "aria-label": "Workspace views",
    selectedKey: null,
    onSelectionChange: () => {},
    trailing: <Button size="sm">Open order</Button>,
  },
};

export const Presentation: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 32, maxWidth: 1000 }}>
      <div>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Primary workspace</h2>
        <WorkspaceExample />
      </div>
      <div>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Secondary views</h2>
        <WorkspaceExample variant="secondary" />
      </div>
    </div>
  ),
};
