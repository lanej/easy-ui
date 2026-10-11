import React, { useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../Button";
import { RiskScore } from "../../RiskScore";
import { Badge } from "../../Badge";
import { ComparisonExample } from "../../PathComparison/PathComparison.examples";
import { InvestigationQueue } from "./InvestigationQueue";
import {
  ReviewOutcome,
  type ReviewDraft,
  type ReviewRecord,
} from "./ReviewOutcome";
import {
  cases,
  caseCategories,
  outcomeOptions,
  reviewHistory,
} from "./InvestigationRecipes.fixtures";
import styles from "./InvestigationRecipes.module.scss";
import { useReviewOutcomes } from "./useReviewOutcomes";
import { caseComparisons } from "./InvestigationCaseComparisons.fixtures";

function exampleRecord(draft: ReviewDraft): ReviewRecord {
  // A real application returns an authenticated reviewer, server ID and timestamp.
  return {
    id: crypto.randomUUID(),
    outcomeLabel: outcomeOptions.find(
      (option) => option.value === draft.outcome,
    )!.label,
    notes: draft.notes,
    reviewer: "Jordan Lee",
    recordedAt: "2026-10-10T14:30:00Z",
    recordedAtLabel: "10 Oct 2026, 14:30 UTC",
  };
}

export function ReviewExample({
  failFirst = false,
  empty = false,
}: {
  failFirst?: boolean;
  empty?: boolean;
}) {
  const [records, setRecords] = useState<ReviewRecord[]>(
    empty ? [] : reviewHistory,
  );
  const attempts = useRef(0);
  const reviewFor = useReviewOutcomes(async (draft) => {
    attempts.current += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (failFirst && attempts.current === 1)
      throw new Error("Example service unavailable");
    setRecords((previous) => [exampleRecord(draft), ...previous]);
  });
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 12 }}>
      <div className={styles.saveRow}>
        <strong>CASE-1042</strong>
        <Badge variant="inverse" accessibilityLabel="Case category:">
          {caseCategories.delivery.label}
        </Badge>
        <RiskScore
          value={82}
          assessment="high"
          size="sm"
          showBar={false}
          accessibilityLabel="Risk score for CASE-1042"
        />
      </div>
      <ReviewOutcome
        caseId="CASE-1042"
        options={outcomeOptions}
        records={records}
        review={reviewFor("CASE-1042")}
      />
    </div>
  );
}

export function QueueExample({
  empty = false,
  loading = false,
  error = false,
}: {
  empty?: boolean;
  loading?: boolean;
  error?: boolean;
}) {
  const [opened, setOpened] = useState<string | null>(null);
  const [failed, setFailed] = useState(error);
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gap: 16 }}>
      <InvestigationQueue
        cases={empty ? [] : cases}
        isLoading={loading}
        error={failed ? "Cases could not be loaded." : undefined}
        onRetry={() => setFailed(false)}
        onOpenCase={setOpened}
      />
      {opened && <p role="status">Opened {opened}</p>}
    </div>
  );
}

/** A complete local example; no customer data is fetched or persisted. */
export function InvestigationWorkflow({
  saveDelay = 300,
  failFirst = false,
}: {
  saveDelay?: number;
  failFirst?: boolean;
}) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, ReviewRecord[]>>({
    "CASE-1042": reviewHistory,
  });
  const attempts = useRef<Record<string, number>>({});
  const reviewFor = useReviewOutcomes(async (draft) => {
    const attempt = (attempts.current[draft.caseId] ?? 0) + 1;
    attempts.current[draft.caseId] = attempt;
    await new Promise((resolve) => setTimeout(resolve, saveDelay));
    if (failFirst && attempt === 1)
      throw new Error("Example service unavailable");
    const record = exampleRecord(draft);
    setHistories((previous) => ({
      ...previous,
      [draft.caseId]: [record, ...(previous[draft.caseId] ?? [])],
    }));
  });
  const queue = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = cases.find((item) => item.id === caseId);
  const comparison = active ? caseComparisons[active.id] : undefined;
  const lastOpened = useRef<string | null>(null);
  const open = (id: string) => {
    lastOpened.current = id;
    setCaseId(id);
  };
  const close = () => setCaseId(null);
  useLayoutEffect(() => {
    if (caseId) heading.current?.focus();
    else if (lastOpened.current) {
      const trigger = queue.current?.querySelector<HTMLButtonElement>(
        `button[aria-label="Open case ${lastOpened.current}"]`,
      );
      (
        trigger ??
        queue.current?.querySelector<HTMLInputElement>('input[type="search"]')
      )?.focus();
    }
  }, [caseId]);
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
      <div ref={queue} hidden={caseId !== null}>
        <h2>Investigation queue</h2>
        <InvestigationQueue
          cases={cases.map((item) => ({
            ...item,
            reviewStatus: histories[item.id]?.some(
              (record) => record.id !== "review-001",
            )
              ? "Reviewed"
              : item.reviewStatus,
          }))}
          onOpenCase={open}
        />
      </div>
      {active && (
        <div style={{ display: "grid", gap: 12 }}>
          <div className={styles.saveRow}>
            <Button size="sm" variant="outlined" onPress={close}>
              Back to queue
            </Button>
            <h2 ref={heading} tabIndex={-1} style={{ margin: 0 }}>
              {active.id}
            </h2>
            <Badge variant="inverse" accessibilityLabel="Case category:">
              {active.category.label}
            </Badge>
            <RiskScore
              value={active.risk}
              assessment={active.assessment}
              size="sm"
              showBar={false}
              accessibilityLabel={`Risk score for ${active.id}`}
            />
          </div>
          <p className={styles.muted}>{active.trackingCode}</p>
          {comparison ? (
            <ComparisonExample key={active.id} data={comparison} withMap />
          ) : (
            <section className={styles.panel} aria-label="Case observations">
              <h3 className={styles.subheading}>No observations available</h3>
              <p>No tracking observations were supplied for this case.</p>
            </section>
          )}
          <ReviewOutcome
            caseId={active.id}
            options={outcomeOptions}
            records={histories[active.id] ?? []}
            review={reviewFor(active.id)}
          />
        </div>
      )}
    </div>
  );
}
