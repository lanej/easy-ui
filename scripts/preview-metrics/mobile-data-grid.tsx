import "./audit/console.mjs";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import { MobileDataGridExample } from "../../easy-ui-react/src/DataGrid/MobileDataGrid.examples";
import { DataGrid } from "../../easy-ui-react/src/DataGrid";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";
import "./mobile-charts.css";

function Preview() {
  const [large, setLarge] = useState(false);
  return (
    <ThemeProvider>
      <main className="mobile-chart-review" style={{ maxWidth: 1440 }}>
        <h1>Tables in small spaces</h1>
        <p>
          Compare ten columns across eight zones. Scroll within the table on
          smaller screens, with zone labels always visible. Synthetic data.
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
        </div>
        <div data-mobile-grid>
          {new URLSearchParams(location.search).has("expanded") ? (
            <DataGrid
              aria-label="Wrapped row details"
              size="sm"
              headerVariant="secondary"
              columns={[
                { key: "zone", name: "Zone" },
                { key: "note", name: "Delivery notes and sample details" },
              ]}
              rows={[
                {
                  key: "a",
                  zone: "Zone 1",
                  note: "Review the supplied shipment sample before comparing this delivery estimate.",
                },
                { key: "b", zone: "Zone 2", note: "Another sample" },
              ]}
              columnOptions={{
                zone: { whiteSpace: "nowrap" },
                note: { whiteSpace: "normal" },
              }}
              renderColumnCell={(column) => column.name}
              renderRowCell={(value) => (
                <span style={{ fontSize: large ? 24 : 16, lineHeight: 1.5 }}>
                  {String(value)}
                </span>
              )}
              renderExpandedRow={() => (
                <button style={{ minHeight: 44 }}>Inspect sample</button>
              )}
            />
          ) : (
            <MobileDataGridExample largeText={large} />
          )}
        </div>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
