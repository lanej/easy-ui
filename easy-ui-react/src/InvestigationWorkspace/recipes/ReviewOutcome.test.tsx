import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../utilities/test";
import {
  ReviewOutcome,
  type ReviewDraft,
  type ReviewOutcomeProps,
} from "./ReviewOutcome";
import { useReviewOutcomes } from "./useReviewOutcomes";
import { outcomeOptions, reviewHistory } from "./InvestigationRecipes.fixtures";

function ReviewHarness({
  onSubmit,
  visible = true,
  ...props
}: Omit<ReviewOutcomeProps, "review"> & {
  onSubmit: (draft: ReviewDraft) => Promise<void>;
  visible?: boolean;
}) {
  const reviewFor = useReviewOutcomes(onSubmit);
  return visible ? (
    <ReviewOutcome {...props} review={reviewFor(props.caseId)} />
  ) : null;
}

async function chooseOutcome(label: string) {
  await userEvent.click(screen.getByRole("button", { name: /Review outcome/ }));
  await userEvent.click(await screen.findByRole("option", { name: label }));
}

describe("ReviewOutcome recipe", () => {
  const props = {
    caseId: "A",
    options: outcomeOptions,
    records: reviewHistory,
    onSubmit: vi.fn().mockResolvedValue(undefined),
  };
  it("requires an explicit decision and nonblank note without deriving an outcome", async () => {
    const submit = vi.fn();
    render(<ReviewHarness {...props} onSubmit={submit} />);
    expect(
      screen.getByRole("button", { name: /Review outcome/ }),
    ).toHaveTextContent("Choose a review outcome");
    await userEvent.click(
      screen.getByRole("button", { name: "Record review" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a review outcome",
    );
    expect(
      screen.getByRole("button", { name: /Review outcome/ }),
    ).toHaveFocus();
    await chooseOutcome("No issue found");
    await userEvent.type(screen.getByLabelText("Review notes"), "   ");
    await userEvent.click(
      screen.getByRole("button", { name: "Record review" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Add a note");
    expect(submit).not.toHaveBeenCalled();
  });
  it("retains failed drafts, retries exact input and clears only after success", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    render(<ReviewHarness {...props} onSubmit={submit} />);
    await chooseOutcome("No issue found");
    await userEvent.type(
      screen.getByLabelText("Review notes"),
      "  Independently confirmed.  ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Record review" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your draft is retained",
    );
    expect(screen.getByLabelText("Review notes")).toHaveValue(
      "  Independently confirmed.  ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Record review" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Review recorded."),
    );
    expect(submit).toHaveBeenLastCalledWith({
      caseId: "A",
      outcome: "clear",
      notes: "Independently confirmed.",
    });
    expect(screen.getByLabelText("Review notes")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /Review outcome/ }),
    ).toHaveTextContent("Choose a review outcome");
    // The recipe never invents a reviewer, timestamp, or persisted history entry.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
  it("blocks concurrent submissions and keeps a completing request attached to its original case", async () => {
    let complete!: () => void;
    const submit = vi.fn(
      (_draft: ReviewDraft) =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const { rerender } = render(<ReviewHarness {...props} onSubmit={submit} />);
    await chooseOutcome("Inconclusive");
    await userEvent.type(
      screen.getByLabelText("Review notes"),
      "Needs more evidence.",
    );
    const form = screen.getByLabelText("Review notes").closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Saving review…" }),
    ).toHaveAttribute("aria-disabled", "true");
    rerender(
      <ReviewHarness {...props} caseId="B" records={[]} onSubmit={submit} />,
    );
    await chooseOutcome("No issue found");
    await userEvent.type(
      screen.getByLabelText("Review notes"),
      "Separate case.",
    );
    await act(async () => complete());
    expect(screen.getByLabelText("Review notes")).toHaveValue("Separate case.");
    expect(submit.mock.calls[0][0]).toEqual({
      caseId: "A",
      outcome: "inconclusive",
      notes: "Needs more evidence.",
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
  it("retains a pending draft across form unmounts and blocks another save on reopening", async () => {
    let complete!: () => void;
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const { rerender } = render(<ReviewHarness {...props} onSubmit={submit} />);
    await chooseOutcome("No issue found");
    await userEvent.type(screen.getByLabelText("Review notes"), "Same case.");
    await userEvent.click(
      screen.getByRole("button", { name: "Record review" }),
    );
    rerender(<ReviewHarness {...props} visible={false} onSubmit={submit} />);
    rerender(<ReviewHarness {...props} onSubmit={submit} />);
    expect(screen.getByLabelText("Review notes")).toHaveValue("Same case.");
    expect(screen.getByLabelText("Review notes")).toHaveAttribute("readonly");
    expect(
      screen.getByRole("button", { name: /Review outcome/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Saving review…" }),
    ).toHaveAttribute("aria-disabled", "true");
    fireEvent.submit(screen.getByLabelText("Review notes").closest("form")!);
    fireEvent.click(screen.getByRole("button", { name: "Saving review…" }));
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => complete());
    expect(screen.getByRole("status")).toHaveTextContent("Review recorded.");
    expect(screen.getByLabelText("Review notes")).toHaveValue("");
  });
  it("keeps a rejected request and its draft with the hidden case without moving another case's focus", async () => {
    let reject!: (error: Error) => void;
    const submit = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const { rerender } = render(<ReviewHarness {...props} onSubmit={submit} />);
    await chooseOutcome("Inconclusive");
    await userEvent.type(
      screen.getByLabelText("Review notes"),
      "Original case.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Record review" }),
    );
    rerender(
      <ReviewHarness {...props} caseId="B" records={[]} onSubmit={submit} />,
    );
    await userEvent.type(
      screen.getByLabelText("Review notes"),
      "Another case.",
    );
    await act(async () => reject(new Error("offline")));
    expect(screen.getByLabelText("Review notes")).toHaveFocus();
    expect(screen.getByLabelText("Review notes")).toHaveValue("Another case.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(<ReviewHarness {...props} onSubmit={submit} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your draft is retained",
    );
    expect(screen.getByLabelText("Review notes")).toHaveValue("Original case.");
    expect(
      screen.getByRole("button", { name: /Review outcome/ }),
    ).toHaveTextContent("Inconclusive");
  });
  it("keeps keyboard focus on the submit button through a rejected save and successful retry", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    render(<ReviewHarness {...props} onSubmit={submit} />);
    await chooseOutcome("No issue found");
    await userEvent.type(screen.getByLabelText("Review notes"), "Retained.");
    const button = screen.getByRole("button", { name: "Record review" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your draft is retained",
    );
    expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Review recorded."),
    );
    expect(button).toHaveFocus();
  });
});
