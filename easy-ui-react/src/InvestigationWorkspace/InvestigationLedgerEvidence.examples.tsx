import React from "react";
import {
  DurationDistribution,
  type DurationHistogramBin,
} from "../DurationDistribution";
import { EventMetrics } from "../EventMetrics";
import type { EventTimelineEvent } from "../EventTimeline";
import { HealthAssessment } from "../HealthAssessment";
import { Text } from "../Text";
import styles from "./InvestigationLedgerEvidence.examples.module.scss";

type LedgerEvidenceProps = { event: EventTimelineEvent };
type ScanIntervalEvidence = {
  /** Exact minutes between occurrences on a supplied candidate connection. */
  minutes: number;
  valueLabel: string;
  previousObservation: string;
  pair: string;
  domain: readonly [number, number];
  bins: readonly DurationHistogramBin[];
};

const referenceWindow = "Sep 3–Oct 21, 2026 · UTC";
const referenceDays = 49;

function histogram(counts: readonly number[], width: number) {
  return counts.map((count, index) => ({
    from: index * width,
    to: (index + 1) * width,
    count,
  }));
}

/**
 * Entirely synthetic references for this example. Counts cover the full displayed
 * domain and the same 49-day window. No health policy or event risk is derived
 * from these distributions. Only these two events have supplied measurements.
 *
 * The intervals follow Candidate A's explicit connections, not adjacent rows:
 * Hammond Oct 22 12:23 -> Avondale Oct 23 20:19 = 31 h 56 m;
 * Wellton Oct 24 04:20 -> Avondale Oct 24 11:25 = 7 h 05 m.
 * Neither interval establishes time spent at a facility or the traveled route.
 */
const evidence: Readonly<Record<string, ScanIntervalEvidence>> = {
  "a-transit": {
    minutes: 1916,
    valueLabel: "31 h 56 m",
    previousObservation: "Hammond · Oct 22, 12:23 UTC",
    pair: "Hammond → Avondale",
    domain: [0, 48],
    bins: histogram([4, 9, 18, 30, 42, 45, 40, 29, 17, 10, 6, 2], 4),
  },
  revisit: {
    minutes: 425,
    valueLabel: "7 h 05 m",
    previousObservation: "Wellton · Oct 24, 04:20 UTC",
    pair: "Wellton → Avondale",
    domain: [0, 24],
    bins: histogram([6, 18, 32, 44, 36, 24, 16, 10, 6, 4, 2, 2], 2),
  },
};

export function hasLedgerEvidence(eventId: string) {
  return evidence[eventId] !== undefined;
}

function sampleCount(interval: ScanIntervalEvidence) {
  return interval.bins.reduce((total, bin) => total + bin.count, 0);
}

function referenceDescription(interval: ScanIntervalEvidence) {
  return `Synthetic ${interval.pair} reported scan intervals · ${referenceWindow} (${referenceDays} days) · n=${sampleCount(interval)}`;
}

function IntervalReference({
  interval,
  compact = false,
}: {
  interval: ScanIntervalEvidence;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? styles.rowReference : styles.selectedReference}
      title={compact ? referenceDescription(interval) : undefined}
    >
      <DurationDistribution
        value={interval.minutes / 60}
        unit="h"
        domain={interval.domain}
        bins={interval.bins}
        sampleCount={sampleCount(interval)}
        label={`Candidate A scan interval reference · ${interval.pair} · ${referenceWindow}`}
        description={
          compact ? undefined : (
            <>
              <Text as="p" variant="caption" color="subdued">
                {interval.pair} · {referenceDays}-day reference
              </Text>
              <Text as="p" variant="caption" color="subdued">
                {referenceWindow} · n={sampleCount(interval)} reported intervals
              </Text>
            </>
          )
        }
        visualization="histogram"
        distributionStyle="binned"
        showScale={!compact}
        showCountAxis={!compact}
        showHealthBands={false}
        showPercentiles={false}
        showDataTable={!compact}
        stretch={false}
        formatValue={(value) =>
          Number.isInteger(value) ? String(value) : value.toFixed(2)
        }
        labels={{
          elapsed: "Candidate A scan interval",
          count: "Intervals",
          observations: "reported intervals",
          referenceValues: "Reference values",
          missingValue: "Scan interval unavailable",
          emptyDistribution: "No reported intervals in this reference",
        }}
      />
    </div>
  );
}

/** One compact measurement/reference strip; no empty-state content in event rows. */
export function LedgerRowEvidence({ event }: LedgerEvidenceProps) {
  const interval = evidence[event.id];
  if (!interval) return null;

  return (
    <div
      className={styles.rowEvidence}
      role="group"
      aria-label="Candidate A interval evidence"
    >
      <EventMetrics
        variant="minimal"
        ariaLabel="Candidate A scan interval"
        metrics={[
          {
            id: "candidate-a-scan-interval",
            label: "A · Scan interval",
            valueLabel: interval.valueLabel,
            assessment: null,
            assessmentLabel: "Measurement not assessed",
          },
        ]}
      />
      <IntervalReference interval={interval} compact />
    </div>
  );
}

/** The inspector adds provenance, scale, counts and exact bins to the row summary. */
export function LedgerSelectedEvidence({ event }: LedgerEvidenceProps) {
  const interval = evidence[event.id];
  if (!interval) {
    return (
      <Text as="p" variant="caption" color="subdued">
        No scan-interval reference supplied for this observation.
      </Text>
    );
  }

  return (
    <section className={styles.selectedEvidence} aria-label="Interval evidence">
      <Text as="h3" variant="subtitle2">
        Scan interval reference
      </Text>
      <Text as="p" variant="caption" color="subdued">
        Supplied Candidate A connection from {interval.previousObservation} to
        this observation. Elapsed between reported scans; facility dwell is
        unavailable.
      </Text>
      <HealthAssessment
        variant="detailed"
        accessibilityLabel="Scan interval reference"
        health={{ assessment: null }}
        reference={<IntervalReference interval={interval} />}
      />
      <Text as="p" variant="caption" color="subdued">
        Blue marker: this candidate interval. Bars: synthetic reference counts.
        No measurement assessment supplied.
      </Text>
    </section>
  );
}
