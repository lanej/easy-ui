import type { ReactNode } from "react";
import type { VisualizationTypography } from "../visualization/typography";

/** An observed input. IDs are unique within the signals of one composition. */
export type ScoreSignalData = {
  id: string;
  label: string;
  /** null means unavailable; false and zero are real observations. */
  value: string | number | boolean | null;
  /** Application formatting for an available, valid observation. */
  displayValue?: string;
  /** Application-owned meaning; never inferred from the observation. Defaults to neutral. */
  sentiment?: "neutral" | "positive" | "warning" | "negative";
  /** Visible meaning alongside the value. Colored states have localizable defaults. */
  statusLabel?: string;
  /** Optional context displayed below the signal. */
  description?: ReactNode;
};

/** An application-calculated contribution, with an explicit cap and sources. */
export type ScoreContributionData = {
  /** Unique within the contributions of one composition. */
  id: string;
  label: string;
  /** Signed exact value. null means unavailable. */
  score: number | null;
  /** A positive finite cap enables the zero-based meter. */
  maxScore: number;
  /** Signal IDs; several contributions may reference the same signal. */
  signals: readonly string[];
  /** Optional explanation, disclosed on demand. */
  explanation?: ReactNode;
};

/** The supplied result; Easy UI never sums contributions or infers a decision. */
export type ScoreResultData = {
  score: number | null;
  /** Optional application-supplied maximum; never inferred from contributions. */
  maxScore?: number;
  /** Defaults to "Total score". */
  label?: string;
  /** Application-owned outcome, for example "Review required" or "Eligible". */
  disposition?: string;
  /** Business meaning is explicit and independent of the score's direction. */
  sentiment?: "neutral" | "positive" | "negative";
  /** Units, coverage, exposure, or other application-owned context. */
  supportingText?: ReactNode;
};

/** Localizable interface text. Record labels and explanations belong to the caller. */
export type ScoreCompositionLabels = {
  signals?: string;
  contributions?: string;
  result?: string;
  noSignals?: string;
  noContributions?: string;
  missingValue?: string;
  invalidValue?: string;
  invalidScale?: string;
  outsideScale?: string;
  basedOn?: string;
  noSources?: string;
  unavailableSignal?: string;
  explanation?: string;
  yes?: string;
  no?: string;
  positiveSignal?: string;
  warningSignal?: string;
  negativeSignal?: string;
};

/** Formatting and typography shared by the composition and its primitives. */
export type ScorePresentationProps = {
  /** Formats finite scores and caps. Defaults to two decimal places. */
  formatScore?: (value: number) => string;
  labels?: ScoreCompositionLabels;
  typography?: VisualizationTypography;
};

export type ScoreCompositionProps = ScorePresentationProps & {
  signals: readonly ScoreSignalData[];
  contributions: readonly ScoreContributionData[];
  result: ScoreResultData;
  /** Optional visible heading. Without a name, the region uses "Score composition". */
  title?: string;
  description?: ReactNode;
  /** Version, timestamp, or coverage; rendered quietly below the heading. */
  metadata?: ReactNode;
  /** Scope or provenance displayed after the composition. */
  footer?: ReactNode;
  /** Use bare inside an application-owned card. Defaults to card. */
  variant?: "card" | "bare";
  /** Accessible name when the visible title is omitted or differs. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};
