import React from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  render,
  mockIntersectionObserver,
  mockGetComputedStyle,
} from "../../utilities/test";
import { InvestigationQueue } from "./InvestigationQueue";
import { cases } from "./InvestigationRecipes.fixtures";

describe("InvestigationQueue recipe", () => {
  let restoreIntersection: () => void;
  let restoreStyle: () => void;
  beforeEach(() => {
    restoreIntersection = mockIntersectionObserver();
    restoreStyle = mockGetComputedStyle();
  });
  afterEach(() => {
    restoreIntersection();
    restoreStyle();
  });
  it("sorts the supplied scores and opens a stable case ID", async () => {
    const open = vi.fn();
    render(<InvestigationQueue cases={cases} onOpenCase={open} />);
    const buttons = screen.getAllByRole("button", { name: /Open case/ });
    expect(buttons.map((button) => button.textContent)).toEqual([
      "CASE-1042",
      "CASE-1003",
      "CASE-1038",
      "CASE-1008",
      "CASE-1029",
    ]);
    await userEvent.click(buttons[0]);
    expect(open).toHaveBeenCalledWith("CASE-1042");
  });
  it("searches exact identifiers and resets an empty filter without losing records", async () => {
    render(<InvestigationQueue cases={cases} onOpenCase={vi.fn()} />);
    await userEvent.type(
      screen.getByLabelText("Find a case"),
      "9400111899223847261954",
    );
    expect(screen.getAllByRole("button", { name: /Open case/ })).toHaveLength(
      1,
    );
    expect(
      screen.getByRole("button", { name: "Open case CASE-1014" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not scored")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Find a case"));
    await userEvent.type(screen.getByLabelText("Find a case"), "missing-query");
    expect(
      screen.getByText("No cases match these filters."),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear filters" }),
    );
    expect(screen.getAllByRole("button", { name: /Open case/ })).toHaveLength(
      5,
    );
  });
  it("does not offer stale case actions while loading or after a load failure", () => {
    const { rerender } = render(
      <InvestigationQueue cases={cases} onOpenCase={vi.fn()} isLoading />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading cases…");
    expect(
      screen.queryByRole("button", { name: /Open case/ }),
    ).not.toBeInTheDocument();
    rerender(
      <InvestigationQueue
        cases={cases}
        onOpenCase={vi.fn()}
        error="Could not load cases"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load cases");
    expect(
      screen.queryByRole("button", { name: /Open case/ }),
    ).not.toBeInTheDocument();
  });
  it("paginates and recovers when the supplied snapshot becomes shorter", async () => {
    const { rerender } = render(
      <InvestigationQueue cases={cases} onOpenCase={vi.fn()} />,
    );
    const pages = screen.getByRole("navigation", { name: "Case pages" });
    await userEvent.click(within(pages).getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("button", { name: "Open case CASE-1014" }),
    ).toBeInTheDocument();
    rerender(
      <InvestigationQueue cases={cases.slice(0, 1)} onOpenCase={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: "Open case CASE-1042" }),
    ).toBeInTheDocument();
  });
});
