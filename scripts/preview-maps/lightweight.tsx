import "./console.mjs";
import React from "react";
import { createRoot } from "react-dom/client";
import { MetricCard } from "../../easy-ui-react/src/MetricCard";
import "../../.storybook/public/poppins.css";
import "../../easy-ui-react/src/styles/global.scss";
import "./preview.css";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
createRoot(document.getElementById("root")!).render(
  <ThemeProvider colorScheme="light">
    <main className="control">
      <h1>Lightweight metric</h1>
      <MetricCard
        label="On-time delivery"
        value="97.4%"
        supportingText="Preceding seven days"
      />
      <p>This metric entry has no chart or map runtime or basemap requests.</p>
      <a href="index.html">Open map examples</a>
    </main>
  </ThemeProvider>,
);
