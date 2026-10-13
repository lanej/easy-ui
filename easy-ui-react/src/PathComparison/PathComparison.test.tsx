import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../utilities/test";
import { PathComparison, type PathComparisonProps } from "./PathComparison";
import { investigationRecords } from "../InvestigationWorkspace/InvestigationWorkspace.fixtures";
import { comparisonRows } from "./PathComparison.fixtures";

const props: PathComparisonProps = {
  ...investigationRecords,
  rows: comparisonRows,
  selection: null,
  onSelectionChange: vi.fn(),
};
describe("PathComparison", () => {
  it("retains duplicate observations, supplied alignment and both conflicting locations", () => {
    render(<PathComparison {...props} />);
    expect(
      screen.getAllByRole("rowheader").map((row) => row.textContent),
    ).toEqual([
      "Origin",
      "Shared exchangeTwo separate observations",
      "Divergent locationsConflicting observations at 14:10",
      "Destination",
    ]);
    expect(
      screen.getAllByRole("button", { name: /Arrived at exchange/ }),
    ).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: /Processed at North Gate/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Processed at South Gate/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("No observation supplied")).toHaveLength(2);
  });
  it("requests a scoped event selection without changing controlled state", () => {
    const change = vi.fn();
    const { rerender } = render(
      <PathComparison
        {...props}
        selection={{ type: "path", pathId: "north" }}
        onSelectionChange={change}
      />,
    );
    const south = screen.getByRole("button", {
      name: /Processed at South Gate/,
    });
    fireEvent.click(south);
    expect(change).toHaveBeenCalledWith({
      type: "path",
      pathId: "south",
      eventId: "south-scan",
    });
    expect(south).not.toHaveAttribute("aria-current");
    rerender(
      <PathComparison
        {...props}
        selection={{ type: "path", pathId: "south", eventId: "south-scan" }}
        onSelectionChange={change}
      />,
    );
    expect(south).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Via South Gate" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  it("supports keyboard path selection without choosing a most likely path", async () => {
    const change = vi.fn();
    render(<PathComparison {...props} onSelectionChange={change} />);
    const button = screen.getByRole("button", {
      name: "Via South Gate",
    });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(change).toHaveBeenCalledWith({ type: "path", pathId: "south" });
    expect(
      screen.queryByRole("button", { pressed: true }),
    ).not.toBeInTheDocument();
  });
  it("shows a shared external selection in both candidates while scoped selection stays in one", () => {
    const { rerender } = render(
      <PathComparison
        {...props}
        selection={{ type: "event", eventId: "accepted" }}
      />,
    );
    expect(screen.getAllByRole("button", { current: true })).toHaveLength(2);
    rerender(
      <PathComparison
        {...props}
        selection={{ type: "path", pathId: "south", eventId: "accepted" }}
      />,
    );
    expect(screen.getAllByRole("button", { current: true })).toHaveLength(1);
  });
  it("retains missing record references as unavailable, without making them selectable", () => {
    render(
      <PathComparison {...props} events={[]} rows={[comparisonRows[0]]} />,
    );
    expect(
      screen.getAllByText("Observation unavailable: accepted"),
    ).toHaveLength(2);
    expect(
      within(screen.getAllByRole("row")[1]).queryByRole("button"),
    ).not.toBeInTheDocument();
  });
  it("handles empty candidates and empty aligned rows explicitly", () => {
    const { rerender } = render(<PathComparison {...props} paths={[]} />);
    expect(screen.getByText("No candidate paths supplied")).toBeInTheDocument();
    rerender(<PathComparison {...props} rows={[]} />);
    expect(screen.getByText("No comparison rows supplied")).toBeInTheDocument();
  });
  it("includes visible locations in accessible names for otherwise matching observations", () => {
    render(
      <PathComparison
        {...props}
        paths={[{ id: "candidate", label: "Candidate" }]}
        events={[
          {
            id: "a",
            label: "Processed",
            timeLabel: "14:10",
            locationLabel: "North Gate",
          },
          {
            id: "b",
            label: "Processed",
            timeLabel: "14:10",
            locationLabel: "South Gate",
          },
          { id: "unknown", label: "Processed", timeLabel: "14:10" },
        ]}
        rows={[
          {
            id: "processing",
            label: "Processing",
            cells: [{ pathId: "candidate", eventIds: ["a", "b", "unknown"] }],
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Processed · 14:10 · North Gate · Candidate",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Processed · 14:10 · South Gate · Candidate",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Processed · 14:10 · Candidate" }),
    ).toBeInTheDocument();
  });
});
