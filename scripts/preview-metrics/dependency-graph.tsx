import "./audit/console.mjs";
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "../../easy-ui-react/src/Provider";
import { DependencyGraphReviewExample } from "../../easy-ui-react/src/DependencyGraph/DependencyGraph.examples";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";

const query = new URLSearchParams(location.search);
if (query.get("large") === "1")
  document.documentElement.style.fontSize = "20px";
createRoot(document.getElementById("root")!).render(
  <Provider colorScheme={query.get("dark") === "1" ? "dark" : "light"}>
    <main
      style={{
        padding: 16,
        maxWidth: 1440,
        margin: "0 auto",
        background: "var(--ezui-color-neutral-000)",
        minHeight: "100vh",
      }}
    >
      <DependencyGraphReviewExample />
    </main>
  </Provider>,
);
