/** A real application fixture: every UI import resolves from the installed tarball. */
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "@easypost/easy-ui/Provider";
import { Button } from "@easypost/easy-ui/Button";
import {
  WorkspaceTabs,
  useWorkspaceTabIds,
  type WorkspaceTab,
  type WorkspaceTabIds,
  type WorkspaceTabsProps,
} from "@easypost/easy-ui/WorkspaceTabs";
import "@easypost/easy-ui/style.css";

const pinned: WorkspaceTab[] = [
  { id: "overview", label: "Overview", count: 12 },
  { id: "unassigned", label: "Unassigned", count: 0 },
  { id: "archived", label: "Archived", isDisabled: true },
];
const initial: WorkspaceTab[] = [
  { id: "order/a", label: "Order A", count: 3 },
  { id: "order_002fa", label: "Order B" },
  {
    id: "long",
    label: "International replenishment and fulfillment — West region",
  },
  { id: "disabled", label: "Locked order", isDisabled: true },
];

function Workspace({
  variant,
  title,
}: {
  variant: WorkspaceTabsProps["variant"];
  title: string;
}) {
  const ids: WorkspaceTabIds = useWorkspaceTabIds();
  const nextOrder = useRef(1);
  const [openTabs, setOpenTabs] = useState(initial);
  const [selectedKey, setSelectedKey] = useState<string | null>("overview");
  const [activations, setActivations] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [defer, setDefer] = useState(false);
  const [width, setWidth] = useState(960);
  function remove(id: string) {
    setOpenTabs((tabs) => tabs.filter((tab) => tab.id !== id));
    if (selectedKey === id) setSelectedKey("overview");
    setPending(null);
  }
  return (
    <section aria-label={title} style={{ minWidth: 0 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>{title}</h2>
      <div
        data-workspace-frame
        style={{
          width,
          maxWidth: "100%",
          transition: "width 250ms ease",
          minWidth: 0,
        }}
      >
        <WorkspaceTabs
          aria-label="Workspace views"
          ids={ids}
          pinnedTabs={pinned}
          openTabs={openTabs}
          selectedKey={selectedKey}
          onSelectionChange={(id) => {
            setSelectedKey(id);
            setActivations((n) => n + 1);
          }}
          onClose={(id) => (defer ? setPending(id) : remove(id))}
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
        {[...pinned, ...openTabs].map((tab) => (
          <section
            key={tab.id}
            role="tabpanel"
            id={ids.panelId(tab.id)}
            aria-labelledby={ids.tabId(tab.id)}
            hidden={selectedKey !== tab.id}
            tabIndex={0}
            style={{ padding: "20px 12px", minHeight: 108 }}
          >
            <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{tab.label}</p>
            <p style={{ margin: 0 }}>
              Application-owned content, selection, and close policy.
            </p>
          </section>
        ))}
      </div>
      <div
        data-test-controls
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 12,
          fontSize: 12,
        }}
      >
        <label>
          Workspace width{" "}
          <input
            aria-label="Workspace width"
            type="range"
            min="180"
            max="960"
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={defer}
            onChange={(event) => setDefer(event.target.checked)}
          />
          Defer close
        </label>
        <button
          onClick={() => {
            if (pending) remove(pending);
          }}
        >
          Apply pending close
        </button>
        <button
          onClick={() => {
            if (selectedKey) remove(selectedKey);
          }}
        >
          Remove selected externally
        </button>
        <button
          onClick={() =>
            setOpenTabs((tabs) =>
              tabs.map((tab) =>
                tab.id === selectedKey ? { ...tab, isDisabled: true } : tab,
              ),
            )
          }
        >
          Disable selected externally
        </button>
        <p data-outside style={{ margin: 0 }}>
          Outside content
        </p>
        <output aria-label="Activation count">{activations}</output>
      </div>
    </section>
  );
}

const theme =
  new URLSearchParams(location.search).get("theme") === "dark"
    ? "dark"
    : "light";
createRoot(document.getElementById("root")!).render(
  <Provider colorScheme={theme}>
    <main
      style={{
        padding: 20,
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "var(--ezui-color-neutral-000)",
        color: "var(--ezui-color-neutral-900)",
        fontFamily: 'Poppins, "Poppins Fallback", sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <div style={{ maxWidth: 1100, display: "grid", gap: 40 }}>
        <Workspace variant="primary" title="Primary workspace" />
        <Workspace variant="secondary" title="Secondary views" />
      </div>
    </main>
  </Provider>,
);
