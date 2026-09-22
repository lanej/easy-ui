import "./audit/console.mjs";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ThemeProvider,
  createTheme,
  defaultTheme,
} from "../../easy-ui-react/src/Theme";
import {
  ScoreComposition,
  ScoreContribution,
  ScoreSignal,
  ScoreResult,
} from "../../easy-ui-react/src/ScoreComposition";
import { scoreCompositionExample } from "../../easy-ui-react/src/ScoreComposition/ScoreComposition.examples";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";
import "./score-composition.css";

// Easy UI's default palette is light. Exercise the public theme override API
// explicitly so the dark review tests changed tokens, not just context state.
const reviewTheme = createTheme((preferences) => ({
  ...defaultTheme(preferences),
  ...(preferences.colorScheme === "dark"
    ? {
        "color.neutral.900": "var(--ezui-color-gray-050)",
        "color.neutral.800": "var(--ezui-color-gray-100)",
        "color.neutral.700": "var(--ezui-color-gray-200)",
        "color.neutral.600": "var(--ezui-color-gray-300)",
        "color.neutral.500": "var(--ezui-color-gray-400)",
        "color.neutral.400": "var(--ezui-color-gray-500)",
        "color.neutral.300": "var(--ezui-color-gray-600)",
        "color.neutral.200": "var(--ezui-color-gray-700)",
        "color.neutral.100": "var(--ezui-color-gray-800)",
        "color.neutral.000": "var(--ezui-color-gray-900)",
        "color.primary.100": "var(--ezui-color-blue-800)",
        "color.primary.300": "var(--ezui-color-blue-600)",
        "color.primary.500": "var(--ezui-color-blue-200)",
        "color.primary.600": "var(--ezui-color-blue-100)",
        "color.primary.700": "var(--ezui-color-blue-050)",
        "color.negative.600": "var(--ezui-color-red-200)",
        "color.positive.600": "var(--ezui-color-green-800)",
      }
    : {}),
}));

function Preview() {
  const [large, setLarge] = useState(false);
  const [dark, setDark] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [rtl, setRtl] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  return (
    <ThemeProvider colorScheme={dark ? "dark" : "light"} theme={reviewTheme}>
      <main className="score-review">
        <h1>Explainable scores</h1>
        <p className="score-intro">
          Observed signals, transparent contributions, and a clear result.
        </p>
        <div className="score-options">
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
          <label>
            <input
              id="narrow-container"
              type="checkbox"
              checked={narrow}
              onChange={(event) => setNarrow(event.target.checked)}
            />
            Narrow container
          </label>
          <label>
            <input
              id="rtl-layout"
              type="checkbox"
              checked={rtl}
              onChange={(event) => setRtl(event.target.checked)}
            />
            Right to left
          </label>
          <label>
            <input
              id="refresh-data"
              type="checkbox"
              checked={refreshed}
              onChange={(event) => setRefreshed(event.target.checked)}
            />
            Updated observations
          </label>
        </div>
        <div
          data-score-example=""
          style={{ maxWidth: narrow ? 360 : undefined }}
          dir={rtl ? "rtl" : "ltr"}
        >
          <ScoreComposition
            {...scoreCompositionExample}
            signals={
              refreshed
                ? [...scoreCompositionExample.signals]
                    .reverse()
                    .map((signal) => ({ ...signal, value: 0 }))
                : [...scoreCompositionExample.signals]
            }
            contributions={
              refreshed
                ? scoreCompositionExample.contributions.map((contribution) => ({
                    ...contribution,
                    score: 0,
                  }))
                : [...scoreCompositionExample.contributions]
            }
            result={
              refreshed
                ? { score: 0, maxScore: 3, disposition: "Review complete" }
                : scoreCompositionExample.result
            }
            typography={
              large
                ? {
                    title: 24,
                    description: 20,
                    label: 18,
                    detail: 18,
                    control: 20,
                  }
                : undefined
            }
          />
        </div>
        <section
          className="score-primitives"
          aria-labelledby="primitives-heading"
        >
          <h2 id="primitives-heading">
            Independent primitives and data states
          </h2>
          <div className="score-primitive-grid">
            <ScoreSignal
              label="International documentation has been reviewed and confirmed for this shipment"
              value={false}
              description="Long labels retain their full meaning."
            />
            <ScoreContribution
              label="Signed adjustment"
              score={-1}
              maxScore={2}
              sourceLabels={["Application adjustment"]}
            />
            <ScoreResult
              label="Awaiting evaluation"
              score={null}
              supportingText="Missing data remains explicit."
            />
          </div>
        </section>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
