import React, { useState } from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../utilities/test";
import { ChartDataView } from "./ChartDataView";
import type { ChartDataTable } from "./types";

const rows = [
  { id: "zero", values: ["Monday", 0] },
  { id: "missing", values: ["Tuesday", null] },
];

it("remeasures the replacement table when switching between standalone and disclosed layouts", () => {
  const observed = new Set<Element>();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      elements: Element[] = [];
      observe(element: Element) {
        this.elements.push(element);
        observed.add(element);
      }
      disconnect() {
        this.elements.forEach((element) => observed.delete(element));
      }
    },
  );
  try {
    const dataTable = { columns: ["Day", "Cost"], rows, pinnedColumnCount: 1 };
    const { container, rerender, unmount } = render(
      <ChartDataView dataTable={dataTable} />,
    );
    const original = container.querySelector('[role="region"]')!;
    expect(observed.has(original)).toBe(true);
    rerender(
      <ChartDataView disclosureLabel="View data table" dataTable={dataTable} />,
    );
    expect(observed.has(original)).toBe(false);
    expect(observed.has(container.querySelector('[role="region"]')!)).toBe(
      true,
    );
    unmount();
    expect(observed.size).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});

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

it("sorts raw numbers stably, keeps missing values last, and restores application order without changing records", async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  const onSortChange = vi.fn();
  const data = [
    { id: "ten", values: ["A", 10] },
    { id: "missing", values: ["B", null] },
    { id: "two", values: ["C", 2] },
    { id: "zero", values: ["D", 0] },
    { id: "two-again", values: ["E", 2] },
  ];
  const names = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent);
  render(
    <ChartDataView
      onRowSelect={select}
      dataTable={{
        columns: ["Name", "Cost"],
        rows: data,
        columnOptions: { 1: { isNumeric: true, allowsSorting: true } },
        renderCell: (value, index) =>
          index === 1 && typeof value === "number" ? (
            <strong>${value.toFixed(2)}</strong>
          ) : null,
        onSortChange,
      }}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Name" }),
  ).not.toBeInTheDocument();
  const sort = screen.getByRole("button", { name: "Cost" });
  sort.focus();
  await user.keyboard("{Enter}");
  expect(names()).toEqual(["D", "C", "E", "A", "B"]);
  expect(screen.getByRole("columnheader", { name: "Cost" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  expect(onSortChange).toHaveBeenLastCalledWith({
    column: 1,
    direction: "ascending",
  });
  await user.click(screen.getByRole("button", { name: "Select row: D" }));
  expect(select).toHaveBeenCalledWith("zero");
  await user.click(sort);
  expect(names()).toEqual(["A", "C", "E", "D", "B"]);
  expect(screen.getByRole("columnheader", { name: "Cost" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await user.click(sort);
  expect(names()).toEqual(["A", "B", "C", "D", "E"]);
  expect(
    screen.getByRole("columnheader", { name: "Cost" }),
  ).not.toHaveAttribute("aria-sort");
  expect(onSortChange).toHaveBeenLastCalledWith(null);
  expect(data.map((row) => row.id)).toEqual([
    "ten",
    "missing",
    "two",
    "zero",
    "two-again",
  ]);
});

it("honors controlled sort, explicit null, refreshed values, and disabled sorting", async () => {
  const user = userEvent.setup();
  const onSortChange = vi.fn();
  const dataTable: ChartDataTable = {
    columns: ["Cost"],
    rows: [
      { id: "ten", values: [10] },
      { id: "two", values: [2] },
    ],
    columnOptions: { 0: { allowsSorting: true } },
    defaultSortDescriptor: { column: 0, direction: "ascending" },
    sortDescriptor: null,
    onSortChange,
  };
  const { rerender } = render(<ChartDataView dataTable={dataTable} />);
  const values = () =>
    screen.getAllByRole("cell").map((cell) => cell.textContent);
  await user.click(screen.getByRole("button", { name: "Cost" }));
  expect(onSortChange).toHaveBeenCalledWith({
    column: 0,
    direction: "ascending",
  });
  expect(values()).toEqual(["10", "2"]);
  const sorted: ChartDataTable = {
    ...dataTable,
    sortDescriptor: { column: 0, direction: "ascending" },
  };
  rerender(<ChartDataView dataTable={sorted} />);
  expect(values()).toEqual(["2", "10"]);
  rerender(
    <ChartDataView
      dataTable={{
        ...sorted,
        rows: [{ id: "ten", values: [1] }, dataTable.rows[1]],
      }}
    />,
  );
  expect(values()).toEqual(["1", "2"]);
  expect(onSortChange).toHaveBeenCalledTimes(1);
  rerender(
    <ChartDataView dataTable={{ ...sorted, columnOptions: undefined }} />,
  );
  expect(values()).toEqual(["10", "2"]);
  expect(
    screen.queryByRole("button", { name: "Cost" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader")).not.toHaveAttribute("aria-sort");
  rerender(<ChartDataView dataTable={dataTable} />);
  expect(values()).toEqual(["10", "2"]);
});

it("uses supplied sort values for preformatted cells and retains cell state across sorting", async () => {
  const user = userEvent.setup();
  const records = [
    { id: "missing", values: ["A", "Not reported"] },
    { id: "ten", values: ["B", "$10.00"] },
    { id: "two", values: ["C", "$2.00"] },
  ];
  const amounts: Record<string, number | null> = {
    missing: null,
    ten: 10,
    two: 2,
  };
  const getSortValue = vi.fn((_, row) => amounts[row.id]);
  render(
    <ChartDataView
      dataTable={{
        columns: ["Note", "Cost"],
        rows: records,
        defaultSortDescriptor: { column: 1, direction: "descending" },
        columnOptions: { 1: { allowsSorting: true, getSortValue } },
        renderCell: (_, index, row) =>
          index === 0 ? (
            <input aria-label={`Note for ${row.id}`} defaultValue="" />
          ) : null,
      }}
    />,
  );
  const values = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[1].textContent);
  expect(values()).toEqual(["$10.00", "$2.00", "Not reported"]);
  expect(getSortValue).toHaveBeenCalledWith("$2.00", records[2]);
  await user.type(
    screen.getByRole("textbox", { name: "Note for two" }),
    "Check charge",
  );
  await user.click(screen.getByRole("button", { name: "Cost" }));
  expect(values()).toEqual(["Not reported", "$10.00", "$2.00"]);
  await user.click(screen.getByRole("button", { name: "Cost" }));
  expect(values()).toEqual(["$2.00", "$10.00", "Not reported"]);
  expect(screen.getByRole("textbox", { name: "Note for two" })).toHaveValue(
    "Check charge",
  );
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
