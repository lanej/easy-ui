import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import { DependencyGraph } from "../../easy-ui-react/src/DependencyGraph";
import type { DependencyGraphProps } from "../../easy-ui-react/src/DependencyGraph";
import {
  subgraphNodes,
  subgraphEdges,
  subgraphGroups,
} from "../../easy-ui-react/src/DependencyGraph/DependencyGraph.groups.fixtures";
import {
  attributeDependencyNodes,
  attributeDependencyEdges,
  relationshipChangeNodes,
  relationshipChangeEdges,
} from "../../easy-ui-react/src/DependencyGraph/DependencyGraph.fixtures";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";

const query = new URLSearchParams(location.search);
const story = query.get("id")?.split("--").at(-1) ?? "nested-subgraphs";
const cases: Record<string, DependencyGraphProps> = {
  "nested-subgraphs": {
    nodes: subgraphNodes,
    edges: subgraphEdges,
    groups: subgraphGroups,
    showDetails: false,
    height: 650,
  },
  "collapsed-subgraphs": {
    nodes: subgraphNodes,
    edges: subgraphEdges,
    groups: subgraphGroups,
    defaultCollapsedGroupIds: ["production"],
    defaultSelection: { type: "group", id: "production" },
    height: 650,
  },
  "attribute-dependencies": {
    nodes: attributeDependencyNodes,
    edges: attributeDependencyEdges,
    defaultExpandedChangeNodeIds: ["database", "api"],
    defaultSelection: { type: "node", id: "api" },
    height: 780,
  },
  "relationship-changes": {
    nodes: relationshipChangeNodes,
    edges: relationshipChangeEdges,
    defaultExpandedChangeNodeIds: ["azurerm_container_app.api"],
    defaultSelection: { type: "node", id: "azurerm_container_app.api" },
    height: 720,
  },
  "cyclic-relationships": {
    nodes: [
      { id: "a", label: "Service A" },
      { id: "b", label: "Service B", change: "update" },
      { id: "c", label: "Service C" },
    ],
    edges: [
      { id: "a-b", source: "a", target: "b" },
      { id: "b-c", source: "b", target: "c" },
      { id: "c-a", source: "c", target: "a", variant: "dashed" },
    ],
  },
};
if (!cases[story]) throw new Error(`Unknown dependency fixture: ${story}`);
createRoot(document.getElementById("root")!).render(
  <ThemeProvider
    colorScheme={query.get("globals")?.includes("colorScheme:dark") ? "dark" : "light"}
  >
    <main style={{ padding: 16, minHeight: "100vh", background: "var(--ezui-color-neutral-000)" }}>
      <DependencyGraph {...cases[story]} />
    </main>
  </ThemeProvider>,
);
