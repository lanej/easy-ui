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
      sentiment: "negative",
      statusLabel: "Flagged",
    },
    {
      id: "ratio",
      label: "NDA / international label ratio",
      value: 0.26,
      sentiment: "warning",
      statusLabel: "Elevated",
    },
    {
      id: "burst",
      label: "NDA / international label burst",
      value: 3,
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
      signals: ["dimensions"],
      explanation:
        "In this sample model, missing dimensions contribute one point. The application supplies this value and its cap.",
    },
    {
      id: "international",
      label: "NDA / International",
      score: 1,
      maxScore: 2,
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
    supportingText: "$0.00 exposure",
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
