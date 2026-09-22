import type { ScoreCompositionLabels } from "./types";

export const defaultLabels: Required<ScoreCompositionLabels> = {
  signals: "Signals",
  contributions: "Contributions",
  result: "Result",
  noSignals: "No signals supplied",
  noContributions: "No contributions supplied",
  missingValue: "No data",
  invalidValue: "Invalid value",
  invalidScale: "Invalid scale",
  outsideScale: "Outside scale",
  basedOn: "Based on",
  noSources: "No source signals supplied",
  unavailableSignal: "Unavailable signal",
  explanation: "Explanation",
  yes: "Yes",
  no: "No",
  positiveSignal: "Positive",
  warningSignal: "Caution",
  negativeSignal: "Negative",
  fullContribution: "Full",
  partialContribution: "Partial",
  noContribution: "None",
};

export const defaultFormatScore = (value: number) => value.toFixed(2);

export function scoreText(
  value: number | null,
  format: (value: number) => string,
  labels: Required<ScoreCompositionLabels>,
  signed = false,
) {
  if (value === null) return labels.missingValue;
  if (!Number.isFinite(value)) return labels.invalidValue;
  return `${signed && value > 0 ? "+" : ""}${format(value)}`;
}
