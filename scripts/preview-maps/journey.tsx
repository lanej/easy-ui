import "./console.mjs";
import React from "react";
import { VisuallyHidden } from "react-aria";
import { createRoot } from "react-dom/client";
import "../../.storybook/public/poppins.css";
import "../../easy-ui-react/src/styles/global.scss";
import "maplibre-gl/dist/maplibre-gl.css";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import { JourneyZoomExample } from "../../easy-ui-react/src/NetworkMap/NetworkMapZoomSections.examples";
const query = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(
  <ThemeProvider colorScheme={query.get("theme") === "dark" ? "dark" : "light"}>
    <main>
      {["none", "description"].includes(query.get("heading") ?? "") && (
        <VisuallyHidden>
          <h1>Journey map example</h1>
        </VisuallyHidden>
      )}
      <JourneyZoomExample
        title={
          ["none", "description"].includes(query.get("heading") ?? "")
            ? null
            : undefined
        }
        description={
          ["none", "title"].includes(query.get("heading") ?? "")
            ? null
            : undefined
        }
        localBasemap={query.has("local")}
        largeText={query.has("large")}
        narrow={query.has("narrow")}
        emptySection={query.has("empty")}
        clustered={query.has("clustered")}
        sectionHeight={query.has("tall") ? 1000 : undefined}
        weighted={query.has("weighted")}
        surfaceMetrics={query.has("metrics")}
      />
    </main>
  </ThemeProvider>,
);
