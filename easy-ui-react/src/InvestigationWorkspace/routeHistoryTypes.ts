import type { InvestigationSelection } from "./selection";

/** Formatted display fields for a single observation or an explicitly grouped source record. */
export type RouteHistoryAnnotation = {
  dayLabel?: string;
  referenceLabel?: string;
  /** Number of original scans represented by this row. Defaults to one. */
  scanCount?: number;
};

export type RouteHistorySelection = Extract<
  InvestigationSelection,
  { type: "event" | "location" }
> | null;
