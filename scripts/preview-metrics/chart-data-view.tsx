import "./audit/console.mjs";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import { RichChartDataExample } from "../../easy-ui-react/src/Chart/RichDataTable.examples";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";

function Preview() {
  const [large, setLarge] = useState(false);
  return (
    <ThemeProvider>
      <main
        style={{
          padding: "clamp(16px, 3vw, 40px)",
          maxWidth: 1440,
          margin: "0 auto",
          minWidth: 0,
        }}
      >
        <h1 style={{ fontSize: 24 }}>Rich chart data disclosure</h1>
        <p style={{ fontSize: 14 }}>
          Expand “View data table” below the chart. The richer table is part of
          that existing disclosure.
        </p>
        <label
          style={{ display: "flex", gap: 8, fontSize: 14, marginBlock: 16 }}
        >
          <input
            type="checkbox"
            checked={large}
            onChange={(event) => setLarge(event.target.checked)}
          />
          Larger text
        </label>
        <RichChartDataExample largeText={large} />
      </main>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
