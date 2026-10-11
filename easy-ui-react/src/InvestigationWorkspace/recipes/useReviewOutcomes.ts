import { useRef, useState } from "react";
import type { ReviewDraft } from "./ReviewOutcome";

type ReviewState = {
  outcome: string;
  notes: string;
  error: string;
  saving: boolean;
  saved: boolean;
};

export type ReviewOutcomeController = ReviewState & {
  setOutcome: (value: string) => void;
  setNotes: (value: string) => void;
  showError: (message: string) => void;
  submit: () => Promise<void>;
};

const empty: ReviewState = {
  outcome: "",
  notes: "",
  error: "",
  saving: false,
  saved: false,
};

/** Keep this application state mounted above case navigation. */
export function useReviewOutcomes(
  onSubmit: (draft: ReviewDraft) => Promise<void>,
): (caseId: string) => ReviewOutcomeController {
  const [states, setStates] = useState(() => new Map<string, ReviewState>());
  const pending = useRef(new Set<string>());
  const update = (caseId: string, patch: Partial<ReviewState>) => {
    setStates((previous) =>
      new Map(previous).set(caseId, {
        ...(previous.get(caseId) ?? empty),
        ...patch,
      }),
    );
  };
  return (caseId) => {
    const state = states.get(caseId) ?? empty;
    return {
      ...state,
      setOutcome: (outcome) => {
        if (!pending.current.has(caseId))
          update(caseId, { outcome, error: "", saved: false });
      },
      setNotes: (notes) => {
        if (!pending.current.has(caseId))
          update(caseId, { notes, error: "", saved: false });
      },
      showError: (error) => update(caseId, { error, saved: false }),
      submit: async () => {
        if (pending.current.has(caseId)) return;
        pending.current.add(caseId);
        update(caseId, { saving: true, saved: false, error: "" });
        try {
          await onSubmit({
            caseId,
            outcome: state.outcome,
            notes: state.notes.trim(),
          });
          update(caseId, { outcome: "", notes: "", saved: true });
        } catch {
          update(caseId, {
            error:
              "Review could not be saved. Your draft is retained. Try again.",
          });
        } finally {
          pending.current.delete(caseId);
          update(caseId, { saving: false });
        }
      },
    };
  };
}
