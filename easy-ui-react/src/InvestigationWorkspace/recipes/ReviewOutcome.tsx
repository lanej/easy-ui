import React, { useId, useRef, useState } from "react";
import { RadioGroup } from "../../RadioGroup";
import { Textarea } from "../../Textarea";
import { Button } from "../../Button";
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
  /** Resolve only after persistence succeeds. The application supplies identity and timestamps. */
  onSubmit: (draft: ReviewDraft) => Promise<void>;
};

/** Application recipe; changing cases starts a separate draft. */
export function ReviewOutcome(props: ReviewOutcomeProps) {
  return <ReviewOutcomeForm key={props.caseId} {...props} />;
}

function ReviewOutcomeForm({
  caseId,
  options,
  records,
  onSubmit,
}: ReviewOutcomeProps) {
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const errorId = useId();
  const clearMessage = () => {
    setError("");
    setSaved(false);
  };
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
          if (inFlight.current) return;
          setSaved(false);
          const validOutcome = options.some(
            (option) => option.value === outcome,
          );
          if (!validOutcome || !notes.trim()) {
            setError(
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
          inFlight.current = true;
          setSaving(true);
          setError("");
          try {
            await onSubmit({ caseId, outcome, notes: notes.trim() });
            setOutcome("");
            setNotes("");
            setSaved(true);
          } catch {
            setError(
              "Review could not be saved. Your draft is retained. Try again.",
            );
          } finally {
            inFlight.current = false;
            setSaving(false);
          }
        }}
      >
        <RadioGroup
          label="Review outcome"
          value={outcome}
          onChange={(value) => {
            setOutcome(value);
            clearMessage();
          }}
          isDisabled={saving}
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
          onChange={(value) => {
            setNotes(value);
            clearMessage();
          }}
          rows={3}
          isRequired
          isDisabled={saving}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <p id={errorId} role="alert" className={styles.message}>
            {error}
          </p>
        )}
        <div className={styles.saveRow}>
          <Button type="submit" isDisabled={saving || !options.length}>
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
