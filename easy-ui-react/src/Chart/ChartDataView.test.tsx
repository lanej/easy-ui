import React, { useState } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../utilities/test";
import { ChartDataView } from "./ChartDataView";
import type { ChartDataTable } from "./types";

const rows = [
  { id: "zero", values: ["Monday", 0] },
  { id: "missing", values: ["Tuesday", null] },
];

it("renders rich cells from original records and preserves exact-value fallbacks and row actions", async () => {
  const select = vi.fn();
  const renderCell = vi.fn<NonNullable<ChartDataTable["renderCell"]>>(
    (value, index) =>
      index === 1 && typeof value === "number" ? (
        <strong>${value.toFixed(2)}</strong>
      ) : null,
  );
  const user = userEvent.setup();
  render(
    <ChartDataView
      title="Costs"
      dataTable={{
        columns: ["Day", "Cost"],
        rows,
        renderCell,
        columnOptions: { 1: { isNumeric: true, minWidth: 160 } },
        maxHeight: "none",
      }}
      missingValueLabel="Not reported"
      onRowSelect={select}
    />,
  );
  expect(screen.getByRole("cell", { name: "$0.00" })).toBeInTheDocument();
  expect(
    screen.getByRole("cell", { name: "Not reported" }),
  ).toBeInTheDocument();
  expect(renderCell).toHaveBeenCalledWith(0, 1, rows[0]);
  expect(screen.getByRole("columnheader", { name: "Cost" })).toHaveStyle({
    textAlign: "end",
    minWidth: "160px",
  });
  expect(screen.getByRole("cell", { name: "$0.00" })).toHaveStyle({
    textAlign: "end",
    minWidth: "160px",
  });
  expect(screen.getByRole("region", { name: "Costs" })).toHaveStyle({
    maxHeight: "none",
  });
  screen.getByRole("button", { name: "Select row: Monday" }).focus();
  await user.keyboard("{Enter}");
  expect(select).toHaveBeenCalledWith("zero");
});

it("keeps the native disclosure folded and defers rich content until opening, then retains its state", async () => {
  const user = userEvent.setup();
  function Note() {
    const [note, setNote] = useState("");
    return (
      <input
        aria-label="Row note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
    );
  }
  const renderCell = vi.fn<NonNullable<ChartDataTable["renderCell"]>>(
    (_, index) => (index === 1 ? <Note /> : undefined),
  );
  const { container, rerender } = render(
    <ChartDataView
      disclosureLabel="View data table"
      dataTable={{ columns: ["Day", "Cost"], rows: [rows[0]], renderCell }}
    />,
  );
  const disclosure = container.querySelector("details")!;
  expect(disclosure.open).toBe(false);
  expect(renderCell).not.toHaveBeenCalled();
  await user.click(screen.getByText("View data table"));
  const note = await screen.findByRole("textbox", { name: "Row note" });
  fireEvent.change(note, { target: { value: "Investigate this charge" } });
  await user.click(screen.getByText("View data table"));
  expect(note).toBeInTheDocument();
  await user.click(screen.getByText("View data table"));
  expect(screen.getByRole("textbox", { name: "Row note" })).toHaveValue(
    "Investigate this charge",
  );
  const refreshed = { id: "zero", values: ["Monday", 8] };
  rerender(
    <ChartDataView
      disclosureLabel="View data table"
      dataTable={{ columns: ["Day", "Cost"], rows: [refreshed], renderCell }}
    />,
  );
  await waitFor(() => expect(renderCell).toHaveBeenCalledWith(8, 1, refreshed));
  expect(screen.getByRole("textbox", { name: "Row note" })).toHaveValue(
    "Investigate this charge",
  );
});
