import React, { useId, useRef } from "react";
import { RadioGroup } from "../../RadioGroup";
import { Textarea } from "../../Textarea";
import { Button } from "../../Button";
import type { ReviewOutcomeController } from "./useReviewOutcomes";
import styles from "./InvestigationRecipes.module.scss";

export type ReviewDraft = { caseId: string; outcome: string; notes: string };
export type ReviewRecord = {
  id: string;
  outcomeLabel: string;
  notes: string;
  reviewer: string;
  recordedAt: string;
  recordedAtLabel: string;
};
export type ReviewOutcomeProps = {
  caseId: string;
  options: readonly { value: string; label: string }[];
  /** Application-confirmed history, in display order. */
  records: readonly ReviewRecord[];
  /** Case state owned above navigation, including drafts and pending requests. */
  review: ReviewOutcomeController;
};

/** Application recipe; each case uses its own application-owned review state. */
export function ReviewOutcome(props: ReviewOutcomeProps) {
  return <ReviewOutcomeForm key={props.caseId} {...props} />;
}

function ReviewOutcomeForm({
  caseId,
  options,
  records,
  review,
}: ReviewOutcomeProps) {
  const { outcome, notes, error, saved, saving } = review;
  const form = useRef<HTMLFormElement>(null);
  const errorId = useId();
  return (
    <section
      className={styles.review}
      aria-label={`Review outcome for ${caseId}`}
    >
      <form
        ref={form}
        noValidate
        aria-busy={saving}
        className={styles.panel}
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          const validOutcome = options.some(
            (option) => option.value === outcome,
          );
          if (!validOutcome || !notes.trim()) {
            review.showError(
              !validOutcome
                ? "Choose a review outcome."
                : "Add a note explaining this review.",
            );
            form.current
              ?.querySelector<HTMLElement>(
                !validOutcome ? 'input[type="radio"]' : "textarea",
              )
              ?.focus();
            return;
          }
          await review.submit();
        }}
      >
        <RadioGroup
          label="Review outcome"
          value={outcome}
          onChange={review.setOutcome}
          isReadOnly={saving}
          aria-describedby={error ? errorId : undefined}
        >
          {options.map((option) => (
            <RadioGroup.Item key={option.value} value={option.value}>
              {option.label}
            </RadioGroup.Item>
          ))}
        </RadioGroup>
        <Textarea
          label="Review notes"
          value={notes}
          onChange={review.setNotes}
          rows={3}
          isRequired
          isReadOnly={saving}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <p id={errorId} role="alert" className={styles.message}>
            {error}
          </p>
        )}
        <div className={styles.saveRow}>
          <Button
            type="submit"
            isDisabled={!options.length}
            aria-disabled={saving || undefined}
            onClick={(event) => {
              if (saving) event.preventDefault();
            }}
          >
            {saving ? "Saving review…" : "Record review"}
          </Button>
          <span role="status">{saved ? "Review recorded." : ""}</span>
        </div>
      </form>
      <div className={styles.panel}>
        <h3 className={styles.subheading}>Review history</h3>
        {!records.length ? (
          <p className={styles.muted}>No recorded reviews.</p>
        ) : (
          <ol className={styles.history} aria-label="Review history">
            {records.map((record) => (
              <li key={record.id}>
                <strong>{record.outcomeLabel}</strong>
                <span className={styles.muted}>
                  {record.reviewer} ·{" "}
                  <time dateTime={record.recordedAt}>
                    {record.recordedAtLabel}
                  </time>
                </span>
                <p>{record.notes}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
