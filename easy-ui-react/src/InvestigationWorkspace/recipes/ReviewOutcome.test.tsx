import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../utilities/test";
import { ReviewOutcome, type ReviewDraft } from "./ReviewOutcome";
import { outcomeOptions, reviewHistory } from "./InvestigationRecipes.fixtures";

describe("ReviewOutcome recipe", () => {
  const props = {
    caseId: "A",
    options: outcomeOptions,
    records: reviewHistory,
    onSubmit: vi.fn().mockResolvedValue(undefined),
  };
  it("requires an explicit decision and nonblank note without deriving an outcome", async () => {
    const submit = vi.fn();
    render(<ReviewOutcome {...props} onSubmit={submit} />);
    expect(
      screen.queryByRole("radio", { checked: true }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Record review" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a review outcome",
    );
    expect(
      screen.getByRole("radio", { name: "Confirmed issue" }),
    ).toHaveFocus();
    await userEvent.click(
      screen.getByRole("radio", { name: "No issue found" }),
    );
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
    render(<ReviewOutcome {...props} onSubmit={submit} />);
    await userEvent.click(
      screen.getByRole("radio", { name: "No issue found" }),
    );
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
    const { rerender } = render(<ReviewOutcome {...props} onSubmit={submit} />);
    await userEvent.click(screen.getByRole("radio", { name: "Inconclusive" }));
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
    ).toBeDisabled();
    rerender(
      <ReviewOutcome {...props} caseId="B" records={[]} onSubmit={submit} />,
    );
    await userEvent.click(
      screen.getByRole("radio", { name: "No issue found" }),
    );
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
});
