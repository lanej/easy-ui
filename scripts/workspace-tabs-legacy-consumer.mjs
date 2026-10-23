// Shared, synthetic fixture for independently installed React 16/17 consumers.
// No imports from the workspace: both renderers supply the packed public API.
export function createApp(
  React,
  { WorkspaceTabs, useWorkspaceTabIds },
  SSRProvider,
) {
  const h = React.createElement;
  const keys = [
    "order/a",
    "order_002fa",
    "order-002f-a",
    "",
    "💌",
    "\ud800",
    "\\ud800",
  ];
  const tabs = keys.map((id, index) => ({ id, label: `View ${index + 1}` }));

  function Workspace({ name, ids }) {
    const [selectedKey, setSelectedKey] = React.useState(keys[0]);
    return h(
      "section",
      { "aria-label": name },
      h(WorkspaceTabs, {
        "aria-label": `${name} views`,
        ids,
        panelId: ids ? undefined : `${name}-shared-panel`,
        openTabs: tabs,
        selectedKey,
        onSelectionChange: setSelectedKey,
      }),
      ids
        ? tabs.map(({ id, label }) =>
            h(
              "section",
              {
                key: id,
                id: ids.panelId(id),
                role: "tabpanel",
                "aria-labelledby": ids.tabId(id),
                hidden: id !== selectedKey,
              },
              `${name} ${label}`,
            ),
          )
        : h("section", {
            id: `${name}-shared-panel`,
            role: "tabpanel",
            "aria-label": `${name} content`,
          }),
    );
  }

  function SharedWorkspace({ name }) {
    const ids = useWorkspaceTabIds();
    return h(Workspace, { name, ids });
  }

  function SuppliedWorkspace({ name }) {
    const ids = React.useMemo(
      () => ({
        tabId: (key) => `${name}-tab-${keys.indexOf(key)}`,
        panelId: (key) => `${name}-panel-${keys.indexOf(key)}`,
      }),
      [name],
    );
    return h(Workspace, { name, ids });
  }

  return function App({ withProvider = true }) {
    const [revision, setRevision] = React.useState(0);
    const content = h(
      React.StrictMode,
      null,
      h(
        "main",
        null,
        h("h1", null, "Workspace compatibility"),
        h("button", { onClick: () => setRevision(revision + 1) }, "Rerender"),
        h("output", { "aria-label": "Revision" }, revision),
        ...[1, 2].flatMap((instance) => [
          h(SharedWorkspace, {
            key: `shared-${instance}`,
            name: `shared-${instance}`,
          }),
          h(Workspace, {
            key: `generated-${instance}`,
            name: `generated-${instance}`,
          }),
          h(SuppliedWorkspace, {
            key: `supplied-${instance}`,
            name: `supplied-${instance}`,
          }),
        ]),
      ),
    );
    return withProvider ? h(SSRProvider, null, content) : content;
  };
}
