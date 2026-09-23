import React from "react";
import { ScoreComposition } from "./ScoreComposition";
import type { ScoreCompositionProps } from "./types";

/** Synthetic explanation shared by Storybook and the browser review fixture. */
export const scoreCompositionExample: ScoreCompositionProps = {
  title: "Score composition",
  description: "How observed signals contribute to this decision.",
  metadata: "Scoring model v1.12.0 · September 22, 2026, 12:35 UTC",
  signals: [
    {
      id: "dimensions",
      label: "Missing package dimensions",
      value: true,
      triggered: true,
      sentiment: "negative",
      statusLabel: "Flagged",
    },
    {
      id: "weight",
      label: "Declared weight mismatch",
      value: false,
      triggered: false,
      sentiment: "positive",
      statusLabel: "Clear",
    },
    {
      id: "ratio",
      label: "NDA / international label ratio",
      value: 0.26,
      triggered: true,
      sentiment: "warning",
      statusLabel: "Elevated",
    },
    {
      id: "burst",
      label: "NDA / international label burst",
      value: 3,
      triggered: true,
      sentiment: "warning",
      statusLabel: "Elevated",
    },
  ],
  contributions: [
    {
      id: "underdeclaration",
      label: "Underdeclaration",
      score: 1,
      maxScore: 1,
      sentiment: "negative",
      signals: ["dimensions", "weight"],
      explanation:
        "Missing dimensions contribute one point in this sample model. The weight-mismatch signal is clear and adds no points. The application supplies the combined score and cap.",
    },
    {
      id: "international",
      label: "NDA / International",
      score: 1,
      maxScore: 2,
      sentiment: "warning",
      signals: ["ratio", "burst"],
      explanation:
        "The application evaluates the ratio and burst together. Their combined contribution is one point out of a possible two.",
    },
  ],
  result: {
    score: 2,
    maxScore: 3,
    disposition: "Disable",
    sentiment: "negative",
    supportingText: "USD 0.00 exposure",
  },
  footer: "Synthetic example. This score reflects only the mechanisms shown.",
};

export function ScoreCompositionExample({
  largeText = false,
}: {
  largeText?: boolean;
}) {
  return (
    <ScoreComposition
      {...scoreCompositionExample}
      typography={
        largeText
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
  );
}
