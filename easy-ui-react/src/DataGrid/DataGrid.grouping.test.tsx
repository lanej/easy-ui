import { fireEvent, screen, within } from "@testing-library/react";
import React, { useState } from "react";
import { vi } from "vitest";
import {
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
  userClick,
} from "../utilities/test";
import { DataGrid } from "./DataGrid";
import { DataGridProps } from "./types";

const columns = [
  { key: "carrier", name: "Carrier" },
  { key: "service", name: "Service level" },
  { key: "packages", name: "Packages" },
  { key: "spend", name: "Spend" },
];
const rows = [
  { key: "a", carrier: "USPS", service: "Ground", packages: 3, spend: 12.5 },
  { key: "b", carrier: "UPS", service: "Ground", packages: 2, spend: 20 },
  { key: "c", carrier: "USPS", service: "Priority", packages: 7, spend: 37.5 },
];
type Props = DataGridProps<(typeof columns)[number], (typeof rows)[number]>;
const grouping: NonNullable<Props["grouping"]> = {
  getGroupKey: (row) => row.carrier,
  aggregators: {
    packages: (groupRows) =>
      groupRows.reduce((sum, row) => sum + row.packages, 0),
    spend: (groupRows) => groupRows.reduce((sum, row) => sum + row.spend, 0),
  },
};
function grid(props: Partial<Props> = {}) {
  return (
    <DataGrid
      aria-label="Grouped shipments"
      columns={columns}
      rows={rows}
      grouping={grouping}
      renderColumnCell={(column) => column.name}
      renderRowCell={(cell) => String(cell)}
      {...props}
    />
  );
}
function bodyRows() {
  return within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");
}
function subtotalRows() {
  return bodyRows().filter((row) =>
    row.hasAttribute("data-ezui-data-grid-subtotal"),
  );
}
function cells(row: HTMLElement) {
  return [...row.children].map((cell) => cell.textContent);
}

describe("DataGrid grouping", () => {
  let restoreStyle: () => void;
  let restoreObserver: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    restoreStyle = mockGetComputedStyle();
    restoreObserver = mockIntersectionObserver();
  });
  afterEach(() => {
    restoreStyle();
    restoreObserver();
    vi.useRealTimers();
  });

  it("groups nonadjacent rows in first-seen order and inserts computed subtotals", () => {
    render(grid());
    expect(bodyRows().map(cells)).toEqual([
      ["USPS", "Ground", "3", "12.5"],
      ["USPS", "Priority", "7", "37.5"],
      ["USPS subtotal", "", "10", "50"],
      ["UPS", "Ground", "2", "20"],
      ["UPS subtotal", "", "2", "20"],
    ]);
    expect(subtotalRows()).toHaveLength(2);
    for (const subtotal of subtotalRows()) {
      expect(subtotal).toHaveAttribute(
        "class",
        expect.stringContaining("subtotal"),
      );
      expect(within(subtotal).getByRole("rowheader")).toBeInTheDocument();
    }
  });

  it("uses the same numeric column formatting for data and subtotal cells", () => {
    render(grid({ columnOptions: { spend: { isNumeric: true, width: 160 } } }));
    for (const row of bodyRows()) {
      const spend = row.lastElementChild;
      expect(spend).toHaveStyle({ textAlign: "end", width: "160px" });
      expect(spend?.firstElementChild).toHaveAttribute(
        "class",
        expect.stringContaining("numeric"),
      );
    }
  });

  it("passes group rows to caller aggregators and keeps subtotal rendering separate", () => {
    const aggregate = vi.fn((groupRows: readonly (typeof rows)[number][]) =>
      Math.max(...groupRows.map((row) => row.packages)),
    );
    const renderRowCell = vi.fn<Props["renderRowCell"]>((cell) => String(cell));
    const renderSubtotalCell = vi.fn<
      NonNullable<NonNullable<Props["grouping"]>["renderSubtotalCell"]>
    >((cell, columnKey, group) =>
      columnKey === "carrier"
        ? `${group.key}: ${group.rows.length} services`
        : String(cell ?? ""),
    );
    render(
      grid({
        renderRowCell,
        grouping: {
          ...grouping,
          aggregators: { packages: aggregate },
          renderSubtotalCell,
        },
      }),
    );
    expect(aggregate).toHaveBeenCalledWith([rows[0], rows[2]]);
    expect(aggregate).toHaveBeenCalledWith([rows[1]]);
    expect(subtotalRows().map(cells)).toEqual([
      ["USPS: 2 services", "", "7", ""],
      ["UPS: 1 services", "", "2", ""],
    ]);
    expect(
      renderRowCell.mock.calls.every((call) => rows.includes(call[2])),
    ).toBe(true);
    expect(renderSubtotalCell).toHaveBeenCalledWith(7, "packages", {
      key: "USPS",
      rows: [rows[0], rows[2]],
    });
  });

  it("preserves ungrouped row order and rendering when grouping is omitted or removed", () => {
    const { rerender } = render(grid({ grouping: undefined }));
    expect(bodyRows().map((row) => row.getAttribute("data-key"))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(subtotalRows()).toHaveLength(0);
    rerender(grid());
    expect(subtotalRows()).toHaveLength(2);
    rerender(grid({ grouping: undefined }));
    expect(subtotalRows()).toHaveLength(0);
    expect(bodyRows()).toHaveLength(3);
  });

  it("recomputes on new rows or aggregators and handles empty input", () => {
    const { rerender } = render(grid());
    rerender(grid({ rows: [{ ...rows[0], spend: 99, packages: 0 }] }));
    expect(subtotalRows().map(cells)).toEqual([
      ["USPS subtotal", "", "0", "99"],
    ]);
    rerender(
      grid({ grouping: { ...grouping, aggregators: { packages: () => 42 } } }),
    );
    expect(subtotalRows()[0]).toHaveTextContent("42");
    rerender(grid({ rows: [] }));
    expect(screen.getByText("No Data")).toBeInTheDocument();
    expect(subtotalRows()).toHaveLength(0);
  });

  it("distinguishes numeric and string group keys and avoids consumer key collisions", () => {
    render(
      grid({
        rows: [{ ...rows[0], key: "__ezui_subtotal_string:%221%22" }, rows[1]],
        grouping: {
          ...grouping,
          getGroupKey: (row) => (row.carrier === "USPS" ? "1" : 1),
        },
      }),
    );
    expect(bodyRows()).toHaveLength(4);
    expect(subtotalRows()).toHaveLength(2);
    expect(
      new Set(bodyRows().map((row) => row.getAttribute("data-key"))).size,
    ).toBe(4);
    expect(subtotalRows().map(cells)).toEqual([
      ["1 subtotal", "", "3", "12.5"],
      ["1 subtotal", "", "2", "20"],
    ]);
  });

  it("preserves accessible subtotal labels for group keys containing spaces", () => {
    render(
      grid({
        rows: [
          { ...rows[0], carrier: "DHL Express" },
          { ...rows[1], carrier: "DHLExpress" },
        ],
      }),
    );
    expect(screen.getByRole("row", { name: "DHL Express subtotal" })).toBe(
      subtotalRows()[0],
    );
    expect(screen.getByRole("row", { name: "DHLExpress subtotal" })).toBe(
      subtotalRows()[1],
    );
  });

  it("keeps subtotal identity stable when colliding keys and group order change", () => {
    const sourceRows = [rows[0], { ...rows[1], carrier: "USPS_" }];
    const { rerender } = render(grid({ rows: sourceRows }));
    const collidingKey = subtotalRows()[0].getAttribute("data-key")!;
    const collidingRows = [
      { ...sourceRows[0], key: collidingKey },
      sourceRows[1],
    ];
    rerender(grid({ rows: collidingRows }));
    const before = new Map(subtotalRows().map((row) => [cells(row)[0], row]));
    rerender(grid({ rows: [...collidingRows].reverse() }));
    for (const row of subtotalRows()) {
      expect(row).toBe(before.get(cells(row)[0]));
    }
  });

  it("keeps subtotals after their groups when the consumer sorts rows", async () => {
    const onSortChange = vi.fn();
    const props = { onSortChange, columnKeysAllowingSort: ["packages"] };
    const { user, rerender } = render(grid(props));
    const originalKeys = subtotalRows().map((row) =>
      row.getAttribute("data-key"),
    );
    await userClick(
      user,
      screen.getByRole("columnheader", { name: "Packages" }),
    );
    expect(onSortChange).toHaveBeenCalledWith({
      column: "packages",
      direction: "ascending",
    });
    rerender(
      grid({
        ...props,
        rows: [rows[1], rows[0], rows[2]],
        sortDescriptor: { column: "packages", direction: "ascending" },
      }),
    );
    expect(bodyRows().map(cells)).toEqual([
      ["UPS", "Ground", "2", "20"],
      ["UPS subtotal", "", "2", "20"],
      ["USPS", "Ground", "3", "12.5"],
      ["USPS", "Priority", "7", "37.5"],
      ["USPS subtotal", "", "10", "50"],
    ]);
    expect(subtotalRows().map((row) => row.getAttribute("data-key"))).toEqual(
      originalKeys.reverse(),
    );
    expect(
      screen.getByRole("columnheader", { name: "Packages" }),
    ).toHaveAttribute("aria-sort", "ascending");
  });

  it.each(["single", "multiple"] as const)(
    "excludes subtotals from %s selection and retains disabled rows",
    async (selectionMode) => {
      const onSelectionChange = vi.fn();
      const { user } = render(
        grid({ selectionMode, disabledKeys: ["b"], onSelectionChange }),
      );
      for (const subtotal of subtotalRows()) {
        expect(
          within(subtotal).queryByRole("checkbox"),
        ).not.toBeInTheDocument();
        await userClick(user, within(subtotal).getByRole("rowheader"));
      }
      expect(onSelectionChange).not.toHaveBeenCalled();
      const checkboxes = bodyRows().flatMap((row) =>
        within(row).queryAllByRole("checkbox"),
      );
      expect(checkboxes).toHaveLength(3);
      expect(checkboxes[2]).toBeDisabled();
      await userClick(user, checkboxes[0]);
      expect([...onSelectionChange.mock.lastCall![0]]).toEqual(["a"]);
      if (selectionMode === "multiple") {
        await userClick(
          user,
          screen.getByRole("checkbox", { name: "Select All" }),
        );
        expect(onSelectionChange.mock.lastCall![0]).toBe("all");
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
        await userClick(user, checkboxes[0]);
        expect([...onSelectionChange.mock.lastCall![0]]).toEqual(["c"]);
      }
    },
  );

  it.each(["selectedKeys", "defaultSelectedKeys"] as const)(
    "supports %s all without selecting subtotal rows",
    (prop) => {
      render(grid({ selectionMode: "multiple", [prop]: "all" }));
      expect(
        bodyRows().filter(
          (row) => row.getAttribute("aria-selected") === "true",
        ),
      ).toHaveLength(3);
      for (const subtotal of subtotalRows()) {
        expect(subtotal).not.toHaveAttribute("aria-selected", "true");
      }
    },
  );

  it("only expands data rows, including rows after a subtotal, and retains controlled expansion", async () => {
    const onExpandedChange = vi.fn();
    const renderExpandedRow = vi.fn((key) => <div>Details {key}</div>);
    const props = { renderExpandedRow, onExpandedChange };
    const { user, rerender } = render(grid(props));
    expect(screen.getAllByRole("button", { name: "Expand" })).toHaveLength(3);
    for (const subtotal of subtotalRows()) {
      expect(within(subtotal).queryByRole("button")).not.toBeInTheDocument();
    }
    await userClick(
      user,
      within(bodyRows()[3]).getByRole("button", { name: "Expand" }),
    );
    expect(onExpandedChange).toHaveBeenCalledWith("b");
    expect(screen.getByText("Details b")).toBeInTheDocument();
    rerender(grid({ ...props, expandedKey: "c" }));
    expect(screen.getByText("Details c")).toBeInTheDocument();
    expect(screen.queryByText("Details b")).not.toBeInTheDocument();
  });

  it.each(["pointer", "Enter", "Space"])(
    "does not dispatch standalone row actions from subtotal rows via %s",
    async (activation) => {
      const onRowAction = vi.fn();
      const { user } = render(grid({ onRowAction }));
      for (const subtotal of subtotalRows()) {
        await userClick(user, within(subtotal).getByRole("rowheader"));
        if (activation !== "pointer") {
          onRowAction.mockClear();
          await user.keyboard(activation === "Enter" ? "{Enter}" : " ");
        }
        expect(onRowAction).not.toHaveBeenCalled();
      }
      await userClick(user, within(bodyRows()[0]).getByRole("rowheader"));
      expect(onRowAction).toHaveBeenCalledWith("a");
    },
  );

  it("keeps subtotals keyboard-readable without selecting or activating them", async () => {
    const onRowAction = vi.fn();
    const onSelectionChange = vi.fn();
    const { user } = render(
      grid({ selectionMode: "multiple", onRowAction, onSelectionChange }),
    );
    await userClick(user, within(bodyRows()[1]).getByRole("rowheader"));
    onRowAction.mockClear();
    onSelectionChange.mockClear();
    await user.keyboard("{ArrowDown}");
    expect(subtotalRows()[0]).toContainElement(
      document.activeElement as HTMLElement,
    );
    await user.keyboard("{Enter} ");
    expect(onRowAction).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}");
    expect(bodyRows()[3]).toContainElement(
      document.activeElement as HTMLElement,
    );
    await user.keyboard(" ");
    expect(within(bodyRows()[3]).getByRole("checkbox")).toBeChecked();
  });

  it("never invokes row, cell, or menu actions for subtotals", async () => {
    const onRowAction = vi.fn();
    const onCellAction = vi.fn();
    const rowActions = vi.fn<NonNullable<Props["rowActions"]>>(() => []);
    const { user, rerender } = render(
      grid({ onRowAction, onCellAction, rowActions }),
    );
    expect(
      rowActions.mock.calls.every((call) => ["a", "b", "c"].includes(call[0])),
    ).toBe(true);
    for (const subtotal of subtotalRows()) {
      expect(within(subtotal).queryByRole("button")).not.toBeInTheDocument();
      await userClick(user, within(subtotal).getByRole("rowheader"));
      await user.keyboard("{Enter}");
    }
    expect(onRowAction).not.toHaveBeenCalled();
    expect(onCellAction).not.toHaveBeenCalled();
    await userClick(user, within(bodyRows()[0]).getByRole("rowheader"));
    expect(onCellAction).toHaveBeenCalled();
    rerender(grid({ onRowAction, rowActions }));
    await userClick(user, within(bodyRows()[0]).getByRole("rowheader"));
    expect(onRowAction).toHaveBeenCalledWith("a");
  });

  describe("Subtotal identity", () => {
    const columns = [
      { key: "carrier", name: "Carrier" },
      { key: "packages", name: "Packages" },
    ];
    type Shipment = { key: string; carrier: string | number; packages: number };
    const rows: Shipment[] = [
      { key: "a", carrier: "USPS", packages: 3 },
      { key: "b", carrier: "UPS", packages: 2 },
      { key: "c", carrier: "USPS", packages: 7 },
    ];
    type Props = DataGridProps<(typeof columns)[number], Shipment>;

    function StatefulSubtotalCell({ label }: { label: string }) {
      const [count, setCount] = useState(0);
      const [note, setNote] = useState("");
      return (
        <span>
          <button
            type="button"
            aria-label={`${label} count`}
            onClick={() => setCount((value) => value + 1)}
          >
            {count}
          </button>
          <input
            aria-label={`${label} note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </span>
      );
    }

    const grouping: NonNullable<Props["grouping"]> = {
      getGroupKey: (row) => row.carrier,
      aggregators: {},
      isCollapsible: true,
      renderSubtotalCell: (_value, columnKey, group) => (
        <StatefulSubtotalCell
          label={`${typeof group.key} ${group.key} ${columnKey}`}
        />
      ),
    };

    function grid(props: Partial<Props> = {}) {
      return (
        <DataGrid
          aria-label="Subtotal identity"
          columns={columns}
          rows={rows}
          grouping={grouping}
          renderColumnCell={(column) => column.name}
          renderRowCell={(value) => String(value)}
          {...props}
        />
      );
    }

    function note(group: string | number, column = "carrier") {
      return screen.getByRole("textbox", {
        name: `${typeof group} ${group} ${column} note`,
      });
    }

    function counter(group: string | number, column = "carrier") {
      return screen.getByRole("button", {
        name: `${typeof group} ${group} ${column} count`,
      });
    }

    function subtotal(group: string | number) {
      return note(group).closest("tr")!;
    }

    function dataRow(key: string) {
      return within(screen.getAllByRole("rowgroup")[1])
        .getAllByRole("row")
        .find((row) => row.getAttribute("data-key") === key)!;
    }

    it("preserves each subtotal cell's state as colliding rows appear, reorder, and disappear", async () => {
      const { user, rerender } = render(grid());
      const originalRow = subtotal("USPS");
      const originalNotes = [note("USPS"), note("USPS", "packages")];
      const originalCounters = [counter("USPS"), counter("USPS", "packages")];
      await user.type(originalNotes[0], "Carrier note");
      await user.type(originalNotes[1], "Package note");
      await userClick(user, originalCounters[0]);
      await userClick(user, originalCounters[1]);
      await userClick(user, originalCounters[1]);

      const assertState = () => {
        expect(subtotal("USPS")).toBe(originalRow);
        for (const [index, column] of ["carrier", "packages"].entries()) {
          expect(note("USPS", column)).toBe(originalNotes[index]);
          expect(counter("USPS", column)).toBe(originalCounters[index]);
          expect(originalCounters[index]).toHaveTextContent(String(index + 1));
        }
        expect(originalNotes[0]).toHaveValue("Carrier note");
        expect(originalNotes[1]).toHaveValue("Package note");
        expect(note("UPS")).toHaveValue("");
        expect(counter("UPS")).toHaveTextContent("0");
      };

      const firstCollision = {
        ...rows[0],
        key: originalRow.getAttribute("data-key")!,
      };
      rerender(grid({ rows: [...rows, firstCollision] }));
      expect(dataRow(firstCollision.key)).not.toHaveAttribute(
        "data-ezui-data-grid-subtotal",
      );
      assertState();

      const secondCollision = {
        ...rows[0],
        key: originalRow.getAttribute("data-key")!,
      };
      const collidingRows = [...rows, firstCollision, secondCollision];
      for (const nextRows of [
        collidingRows,
        [...collidingRows].reverse(),
        [...rows, secondCollision],
        rows,
      ]) {
        rerender(grid({ rows: nextRows }));
        assertState();
      }
    });

    it("keeps a subtotal input focused and navigates from its group after collision changes", async () => {
      const { user, rerender } = render(grid());
      const input = note("USPS", "packages");
      const collision = {
        ...rows[0],
        key: subtotal("USPS").getAttribute("data-key")!,
      };
      await userClick(user, input);
      fireEvent.change(input, { target: { value: "Keep focus here" } });
      expect(input).toHaveFocus();

      rerender(grid({ rows: [...rows, collision] }));
      expect(note("USPS", "packages")).toBe(input);
      expect(input).toHaveFocus();
      expect(input).toHaveValue("Keep focus here");
      await user.keyboard("{ArrowDown}");
      expect(dataRow("b")).toContainElement(
        document.activeElement as HTMLElement,
      );

      await userClick(user, input);
      rerender(grid());
      expect(input).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(dataRow("b")).toContainElement(
        document.activeElement as HTMLElement,
      );
    });

    it("does not take focus from an external control when subtotal keys change", async () => {
      const view = (nextRows: Shipment[]) => (
        <>
          <button type="button">Outside the grid</button>
          {grid({ rows: nextRows })}
        </>
      );
      const { user, rerender } = render(view(rows));
      const collision = {
        ...rows[0],
        key: subtotal("USPS").getAttribute("data-key")!,
      };
      await userClick(user, note("USPS", "packages"));
      const outside = screen.getByRole("button", { name: "Outside the grid" });
      await userClick(user, outside);

      rerender(view([...rows, collision]));
      expect(outside).toHaveFocus();
      rerender(view(rows));
      expect(outside).toHaveFocus();
    });

    it("keeps numeric and string group state distinct through reordering and collision changes", async () => {
      const typedRows: Shipment[] = [
        { key: "numeric", carrier: 1, packages: 3 },
        { key: "string", carrier: "1", packages: 2 },
      ];
      const { user, rerender } = render(grid({ rows: typedRows }));
      const numericRow = subtotal(1);
      const stringRow = subtotal("1");
      await user.type(note(1), "Numeric group");
      await user.type(note("1"), "String group");
      await userClick(user, counter(1, "packages"));
      const collision = {
        ...typedRows[0],
        key: numericRow.getAttribute("data-key")!,
      };

      for (const nextRows of [
        [...typedRows, collision].reverse(),
        [...typedRows].reverse(),
        typedRows,
      ]) {
        rerender(grid({ rows: nextRows }));
        expect(subtotal(1)).toBe(numericRow);
        expect(subtotal("1")).toBe(stringRow);
        expect(note(1)).toHaveValue("Numeric group");
        expect(note("1")).toHaveValue("String group");
        expect(counter(1, "packages")).toHaveTextContent("1");
        expect(counter("1", "packages")).toHaveTextContent("0");
      }
    });
  });
});
