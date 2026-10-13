import "./audit/console.mjs";
import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import { DependencyGraphReviewExample } from "../../easy-ui-react/src/DependencyGraph/DependencyGraph.examples";
import { DependencyGraphChanges } from "../../easy-ui-react/src/DependencyGraph/DependencyGraphChanges";
import { DependencyGraph } from "../../easy-ui-react/src/DependencyGraph";
import {
  relationshipChangeNodes,
  relationshipChangeEdges,
  attributeDependencyNodes,
  attributeDependencyEdges,
  dependencyNodes,
  dependencyEdges,
  dependencyGroups,
  subnetId,
} from "../../easy-ui-react/src/DependencyGraph/DependencyGraph.fixtures";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";

const query = new URLSearchParams(location.search);
if (query.get("large") === "1")
  document.documentElement.style.fontSize = "20px";
createRoot(document.getElementById("root")!).render(
  <ThemeProvider colorScheme={query.get("dark") === "1" ? "dark" : "light"}>
    <main
      style={{
        padding: 16,
        maxWidth: 1440,
        margin: "0 auto",
        background: "var(--ezui-color-neutral-000)",
        minHeight: "100vh",
      }}
    >
      {query.get("anchors") === "1" ? (
        <DependencyGraph
          title="Attribute dependencies"
          nodes={attributeDependencyNodes}
          edges={attributeDependencyEdges}
          defaultExpandedChangeNodeIds={["database", "api"]}
          defaultSelection={{ type: "node", id: "api" }}
          height={780}
        />
      ) : query.get("responsive") === "1" ? (
        <div style={{ maxWidth: 960 }}>
          <h2>Shipping API changes</h2>
          <DependencyGraphChanges
            node={dependencyNodes[2]}
            compact
            defaultPresentation="diff"
            showPresentationControls={false}
          />
        </div>
      ) : query.get("links") === "1" ? (
        <DependencyGraph
          title="Connection changes"
          nodes={relationshipChangeNodes}
          edges={relationshipChangeEdges}
          defaultExpandedChangeNodeIds={["azurerm_container_app.api"]}
          defaultSelection={{ type: "node", id: "azurerm_container_app.api" }}
          height={720}
        />
      ) : query.get("inline") === "1" ? (
        <DependencyGraph
          height={720}
          title="Resource dependencies"
          nodes={dependencyNodes}
          edges={dependencyEdges}
          groups={dependencyGroups}
          defaultExpandedChangeNodeIds={[subnetId, "azurerm_container_app.api"]}
          defaultView={{ scope: "dependents", nodeId: subnetId, depth: 1 }}
          defaultCollapsedGroupIds={["data", "observability"]}
          showDetails={false}
        />
      ) : query.get("specific") === "1" ? (
        <DependencyGraph
          title="Resource dependencies"
          nodes={dependencyNodes}
          edges={dependencyEdges}
          groups={dependencyGroups}
          defaultSelection={{ type: "node", id: "azurerm_container_app.api" }}
          defaultChangePresentation="diff"
          defaultView={{ scope: "changes", depth: 0 }}
        />
      ) : (
        <DependencyGraphReviewExample
          defaultCollapsedNodeIds={
            query.get("folded") === "1" ? [subnetId] : []
          }
          defaultExpandedChangeNodeIds={
            query.get("overview") === "1" ? [] : [subnetId]
          }
          defaultView={
            query.get("overview") === "1"
              ? { scope: "all" }
              : { scope: "dependents", nodeId: subnetId, depth: 1 }
          }
          defaultChangePresentation={
            query.get("summary") === "1" ? "summary" : "diff"
          }
        />
      )}
    </main>
  </ThemeProvider>,
);
