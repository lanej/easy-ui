import "./audit/console.mjs";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import { MobileChartsExample } from "../../easy-ui-react/src/Chart/MobileCharts.examples";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";
import "./mobile-charts.css";

const query = new URLSearchParams(location.search);
Object.assign(window, {
  __mobileChart: async () => {
    const { getInstanceByDom } = await import("echarts/core");
    const element = document.querySelector<HTMLElement>(
      "[data-chart-state] > div",
    );
    const engine = element && getInstanceByDom(element);
    return engine?.getOption();
  },
});
function Preview() {
  const [large, setLarge] = useState(query.has("large"));
  const [dark, setDark] = useState(false);
  return (
    <ThemeProvider colorScheme={dark ? "dark" : "light"}>
      <main className="mobile-chart-review">
        <h1>Charts in small spaces</h1>
        <p>
          Synthetic transit counts. Toggle a service in the legend, or expand
          the table for every exact value.
        </p>
        <div className="mobile-chart-options">
          <label>
            <input
              id="large-text"
              type="checkbox"
              checked={large}
              onChange={(event) => setLarge(event.target.checked)}
            />
            Larger text
          </label>
          <label>
            <input
              id="dark-theme"
              type="checkbox"
              checked={dark}
              onChange={(event) => setDark(event.target.checked)}
            />
            Dark theme
          </label>
        </div>
        <div data-mobile-chart>
          <MobileChartsExample
            largeText={large}
            renderer={query.get("renderer") === "canvas" ? "canvas" : "svg"}
            layout={query.has("native") ? "native" : "auto"}
          />
        </div>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
