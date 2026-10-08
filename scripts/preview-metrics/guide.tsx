import React from "react";
import { createRoot } from "react-dom/client";
import {
  PricingExample,
  EncodingExamples,
} from "../../easy-ui-react/src/examples/DesignGuide.examples";
import {
  modes,
  tasks,
  proposals,
  Mode,
  Task,
} from "../../easy-ui-react/src/examples/DesignGuide.fixtures";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";
const params = new URLSearchParams(location.search);
const mode = Object.hasOwn(modes, params.get("mode") || "")
  ? (params.get("mode") as Mode)
  : "compact";
const task = Object.hasOwn(tasks, params.get("task") || "")
  ? (params.get("task") as Task)
  : "routine";
const open = (params.get("open") || "")
  .split(",")
  .filter((id) => proposals.some((p) => p.id === id));
createRoot(document.getElementById("root")!).render(
  location.pathname.endsWith("encodings.html") ? (
    <EncodingExamples />
  ) : (
    <PricingExample
      initialMode={mode}
      initialTask={task}
      initialOpen={open}
      syncURL
    />
  ),
);
