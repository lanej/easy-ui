import React from "react";
import { createRoot } from "react-dom/client";
import { NetworkGuideExample } from "../../easy-ui-react/src/examples/NetworkGuide.examples";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";
createRoot(document.getElementById("root")!).render(
  <NetworkGuideExample
    initialMode={
      new URLSearchParams(location.search).get("mode") === "fragmented"
        ? "fragmented"
        : "coordinated"
    }
    syncURL
  />,
);
